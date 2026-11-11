import assert from 'node:assert/strict';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';

export async function verifyProvisionalAccounting(context: IntegrationContext, bookingId: string) {
  const { admin } = context.clients;
  const beforeFinal = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(beforeFinal.status, 200, JSON.stringify(beforeFinal.body));
  assert.equal(
    beforeFinal.body.some((entry: { bookingId?: string }) => entry.bookingId === bookingId),
    false,
    'Une réservation avec devis provisoire ne doit pas créer de revenu comptable.',
  );
}

export async function verifyProvisionalQuoteCreation(
  context: IntegrationContext,
  bookingId: string,
) {
  const { admin } = context.clients;
  const bookingResponse = await admin.get(`/api/bookings/${bookingId}`).set(integrationHeader);
  assert.equal(bookingResponse.status, 200, JSON.stringify(bookingResponse.body));
  const version = bookingResponse.body.version as number;
  const initialBookingData =
    bookingResponse.body as import('../../src/domain/shared/model.js').Booking;
  assert.ok(
    initialBookingData.pricingSnapshot,
    'La réservation doit conserver son instantané tarifaire.',
  );
  const originalVehicle = await context.db.vehicule.findUniqueOrThrow({
    where: { id: 'sprinter' },
  });
  const currentVehiclePrices = originalVehicle.tarifs as [number, number, number];
  const tollPoint = await context.db.pointPeage.findFirstOrThrow();
  const tollVehiclePrices = tollPoint.tarifsVehicules as Record<string, number>;
  const tollUnitPrice = tollVehiclePrices.sprinter ?? tollPoint.tarifLourd;
  const created = await admin
    .post(`/api/bookings/${bookingId}/quotes`)
    .set(integrationHeader)
    .send({
      kind: 'provisional',
      trips: 2,
      customPrice: null,
      discount: 10,
      discountType: 'pct',
      discountReason: 'Test remise en pourcentage',
      notes: 'Test de devis provisoire',
      extraLines: [{ label: 'Manutention spéciale', quantity: 2, unitPrice: 2_500 }],
      tolls: [{ tollPointId: tollPoint.id, direction: 'round-trip', quantity: 2 }],
      options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
      version,
    });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const savedBooking = await context.db.reservation.findUniqueOrThrow({
    where: { id: bookingId },
  });
  const savedData = savedBooking.donnees as import('../../src/domain/shared/model.js').Booking;
  const quote = savedData.quotes.at(-1);
  assert.ok(quote);
  const lineSubtotal = quote.price.lines.reduce((sum, line) => sum + line.total, 0);
  const expectedDiscount = Math.round((lineSubtotal * 10) / 100);
  assert.equal(quote.kind, 'provisional');
  assert.equal(
    quote.price.lines.find((line) => line.label.startsWith('Transport'))?.unitPrice,
    initialBookingData.pricingSnapshot?.vehiclePrices.sprinter?.[1],
    'Un devis rouvre le tarif véhicule mémorisé même si le catalogue a changé.',
  );
  assert.equal(quote.price.trips, 2);
  assert.equal(quote.price.discountType, 'pct');
  assert.equal(quote.price.discountValue, 10);
  assert.equal(quote.price.discount, expectedDiscount);
  assert.equal(quote.price.total, lineSubtotal - expectedDiscount);
  const transportLines = quote.price.lines.filter(
    (line) =>
      line.label.startsWith('Transport') || line.label.startsWith('Allers-retours suivants'),
  );
  assert.equal(
    transportLines.reduce((sum, line) => sum + line.quantity, 0),
    2,
    'Les lignes de transport doivent représenter les deux trajets facturés.',
  );
  assert.equal(
    transportLines.reduce((sum, line) => sum + line.total, 0),
    transportLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    'Les montants unitaires doivent appliquer la réduction des trajets suivants.',
  );
  const manualExtraLine = quote.price.lines.find((line) => line.label === 'Manutention spéciale');
  assert.ok(manualExtraLine);
  assert.equal(manualExtraLine.quantity, 2);
  assert.equal(manualExtraLine.total, 5_000);
  assert.ok(quote.tolls);
  assert.equal(quote.tolls.length, 1);
  assert.equal(quote.tolls[0]?.quantity, 2);
  assert.equal(quote.tolls[0]?.unitPrice, tollUnitPrice);
  assert.equal(
    quote.price.total,
    lineSubtotal - expectedDiscount,
    'Les péages doivent rester distincts du total du devis et être affichés à part.',
  );

  const savedQuote = await context.db.devis.findUniqueOrThrow({
    where: { id: quote.id },
    include: { lignes: { orderBy: { position: 'asc' } } },
  });
  assert.equal(savedQuote.nature, 'provisoire');
  assert.equal(savedQuote.montantTotal, lineSubtotal - expectedDiscount);
  assert.equal(savedQuote.remise, expectedDiscount);
  assert.equal(
    savedQuote.lignes.reduce((sum, line) => sum + line.montant, 0),
    lineSubtotal,
    'Les lignes persistées doivent correspondre au montant avant remise.',
  );
  assert.deepEqual(
    savedQuote.lignes.map((line) => [line.libelle, line.quantite, line.prixUnitaire, line.montant]),
    quote.price.lines.map((line) => [line.label, line.quantity, line.unitPrice, line.total]),
    'Les lignes du devis doivent être persistées à l’identique du calcul affiché.',
  );

  const detailedQuoteResponse = await admin
    .post(`/api/bookings/${bookingId}/quotes`)
    .set(integrationHeader)
    .send({
      kind: 'provisional',
      trips: 3,
      customPrice: null,
      discount: 1_250,
      discountType: 'fcfa',
      discountReason: 'Geste commercial',
      notes: 'Options et lignes détaillées',
      extraLines: [
        { label: 'Protection spéciale', quantity: 3, unitPrice: 1_200 },
        { label: 'Stationnement', quantity: 1, unitPrice: 2_000 },
      ],
      tolls: [{ tollPointId: tollPoint.id, direction: 'one-way', quantity: 1 }],
      options: { labour: 2, desk: 1, wardrobe: 1, bed: 1 },
      labourUnitPriceOverride: 8_000,
      version: savedBooking.version,
    });
  assert.equal(detailedQuoteResponse.status, 201, JSON.stringify(detailedQuoteResponse.body));
  const detailedBooking = await context.db.reservation.findUniqueOrThrow({
    where: { id: bookingId },
  });
  const detailedData =
    detailedBooking.donnees as import('../../src/domain/shared/model.js').Booking;
  const detailedQuote = detailedData.quotes.at(-1);
  assert.ok(detailedQuote);
  assert.equal(detailedQuote.kind, 'provisional');
  assert.equal(detailedQuote.price.trips, 3);
  assert.equal(detailedQuote.price.discountType, 'fcfa');
  assert.equal(detailedQuote.price.discountValue, 1_250);
  assert.equal(detailedQuote.price.discount, 1_250);
  assert.equal(
    detailedQuote.price.total,
    detailedQuote.price.lines.reduce((sum, line) => sum + line.total, 0) - 1_250,
  );
  assert.equal(detailedQuote.options?.labour, 2);
  assert.equal(detailedQuote.options?.desk, 1);
  assert.equal(detailedQuote.options?.wardrobe, 1);
  assert.equal(detailedQuote.options?.bed, 1);
  assert.ok(
    detailedQuote.price.lines.some(
      (line) =>
        line.label.startsWith('Manœuvre') && line.quantity === 2 && line.unitPrice === 8_000,
    ),
  );
  for (const label of ['Menuisier · bureau', 'Menuisier · armoire', 'Menuisier · lit']) {
    assert.ok(
      detailedQuote.price.lines.some((line) => line.label.startsWith(label) && line.quantity === 1),
      `L’option ${label} doit devenir une ligne de devis.`,
    );
  }
  assert.equal(
    detailedQuote.price.lines.find((line) => line.label === 'Protection spéciale')?.total,
    3_600,
  );
  assert.equal(
    detailedQuote.price.lines.find((line) => line.label === 'Stationnement')?.total,
    2_000,
  );
  assert.equal(detailedQuote.tolls?.length, 1);
  assert.equal(detailedQuote.tolls?.[0]?.quantity, 1);
  assert.equal(
    await context.db.ecritureComptable.count({ where: { sourceDevisId: detailedQuote.id } }),
    0,
    'Un deuxième devis provisoire ne doit pas générer de lignes comptables.',
  );

  const invalidRoundTrip = await admin
    .post(`/api/bookings/${bookingId}/quotes`)
    .set(integrationHeader)
    .send({
      kind: 'provisional',
      trips: 1,
      customPrice: null,
      discount: 0,
      notes: 'Aller-retour invalide',
      tolls: [{ tollPointId: tollPoint.id, direction: 'round-trip', quantity: 1 }],
      version: detailedBooking.version,
    });
  assert.equal(invalidRoundTrip.status, 400, JSON.stringify(invalidRoundTrip.body));
  assert.equal(
    await context.db.devis.count({ where: { reservationId: bookingId } }),
    3,
    'Un aller-retour avec un nombre impair de passages doit être refusé sans persistance.',
  );
  assert.equal(
    await context.db.ecritureComptable.count({ where: { sourceDevisId: quote.id } }),
    0,
    'Un devis provisoire ne doit pas créer de revenu ni de charge comptable.',
  );

  const stale = await admin.post(`/api/bookings/${bookingId}/quotes`).set(integrationHeader).send({
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: 'Version périmée',
    version,
  });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.equal(
    await context.db.devis.count({ where: { reservationId: bookingId } }),
    3,
    'Une requête périmée ne doit pas ajouter un devis en base.',
  );

  const latestBooking = await admin.get(`/api/bookings/${bookingId}`).set(integrationHeader);
  assert.equal(latestBooking.status, 200, JSON.stringify(latestBooking.body));
  const applied = await admin
    .post(`/api/bookings/${bookingId}/pricing-snapshot/apply-current`)
    .set(integrationHeader)
    .send({ version: latestBooking.body.version });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  const appliedData = applied.body as import('../../src/domain/shared/model.js').Booking;
  assert.deepEqual(appliedData.pricingSnapshot?.vehiclePrices.sprinter, currentVehiclePrices);
  assert.deepEqual(appliedData.vehicle.prices, currentVehiclePrices);
  const persistedApplied = await context.db.reservation.findUniqueOrThrow({
    where: { id: bookingId },
  });
  assert.deepEqual(
    (persistedApplied.donnees as import('../../src/domain/shared/model.js').Booking).pricingSnapshot
      ?.vehiclePrices.sprinter,
    currentVehiclePrices,
    'Le remplacement explicite des tarifs doit être persisté dans la réservation.',
  );
}

export async function verifyCancelledAccounting(
  context: IntegrationContext,
  cancelledBookingId: string,
) {
  const { admin, first } = context.clients;
  const booking = await context.db.reservation.findUniqueOrThrow({
    where: { id: cancelledBookingId },
  });
  const cancellation = await admin
    .patch(`/api/bookings/${cancelledBookingId}/status`)
    .set(integrationHeader)
    .send({ status: 'cancelled', version: booking.version });
  assert.equal(cancellation.status, 200, JSON.stringify(cancellation.body));
  const afterCancellation = await first.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(afterCancellation.status, 403, 'Un client ne peut pas consulter la comptabilité.');
  const activeEntries = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(activeEntries.status, 200, JSON.stringify(activeEntries.body));
  assert.equal(
    activeEntries.body.some(
      (entry: { bookingId?: string }) => entry.bookingId === cancelledBookingId,
    ),
    false,
    'Une réservation annulée ne doit pas créer de revenu comptable.',
  );
}

export async function verifyAccountingJournal(
  context: IntegrationContext,
  quoteId: string,
  quoteAmount: number,
) {
  const { admin, first } = context.clients;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const initial = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(initial.status, 200, JSON.stringify(initial.body));
  const finalRevenues = initial.body.filter(
    (entry: { id: string; type: string; amount: number }) =>
      entry.id === quoteId && entry.type === 'revenu' && entry.amount === quoteAmount,
  );
  assert.equal(finalRevenues.length, 1, 'Le devis final doit produire un seul revenu automatique.');
  const booking = await context.db.reservation.findFirstOrThrow({
    where: { devis: { some: { id: quoteId } } },
  });
  const bookingData = booking.donnees as import('../../src/domain/shared/model.js').Booking;
  const quoteSnapshot = bookingData.quotes.find((quote) => quote.id === quoteId);
  const quoteCosts = quoteSnapshot?.accountingCosts;
  assert.ok(quoteCosts, 'Le devis final doit conserver son instantané de charges.');
  const quoteRow = await context.db.devis.findUniqueOrThrow({ where: { id: quoteId } });
  const quoteMonth = quoteRow.creeLe.toISOString().slice(0, 7);
  const expectedLabourTotal = quoteCosts.moverAmount + quoteCosts.carpenterAmount;
  const quoteCharges = initial.body.filter(
    (entry: { reference?: string; type: string }) =>
      entry.reference === quoteId && entry.type === 'charge',
  );
  assert.equal(
    quoteCharges.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0),
    expectedLabourTotal,
    'La somme des charges liées au devis doit égaler son instantané comptable figé.',
  );
  assert.equal(
    quoteCharges.length,
    Number(quoteCosts.moverAmount > 0) + Number(quoteCosts.carpenterAmount > 0),
    'Le devis ne doit produire aucune ligne de charge en doublon.',
  );
  for (const [category, amount] of [
    ['Manœuvres', quoteCosts.moverAmount],
    ['Menuisier', quoteCosts.carpenterAmount],
  ] as const) {
    if (amount <= 0) continue;
    assert.equal(
      initial.body.filter(
        (entry: {
          reference?: string;
          category: string;
          amount: number;
          quantity?: number;
          type: string;
          automatic: boolean;
        }) =>
          entry.reference === quoteId &&
          entry.category === category &&
          entry.amount === amount &&
          entry.quantity ===
            (category === 'Manœuvres' ? quoteCosts.movers : quoteCosts.carpenters) &&
          entry.type === 'charge' &&
          entry.automatic,
      ).length,
      1,
      `Le journal doit enregistrer une seule charge automatique ${category} au montant figé du devis.`,
    );
  }
  const quoteMonthEntries = await admin
    .get(`/api/admin/accounting?month=${quoteMonth}`)
    .set(integrationHeader);
  assert.equal(quoteMonthEntries.status, 200, JSON.stringify(quoteMonthEntries.body));
  assert.equal(
    quoteMonthEntries.body.some((entry: { id: string }) => entry.id === quoteId),
    true,
    'Le revenu doit apparaître dans le mois du devis final.',
  );
  const quotePreviousMonthDate = new Date(`${quoteMonth}-01T00:00:00Z`);
  quotePreviousMonthDate.setUTCMonth(quotePreviousMonthDate.getUTCMonth() - 1);
  const quotePreviousMonth = quotePreviousMonthDate.toISOString().slice(0, 7);
  const quotePreviousMonthEntries = await admin
    .get(`/api/admin/accounting?month=${quotePreviousMonth}`)
    .set(integrationHeader);
  assert.equal(
    quotePreviousMonthEntries.status,
    200,
    JSON.stringify(quotePreviousMonthEntries.body),
  );
  assert.equal(
    quotePreviousMonthEntries.body.some(
      (entry: { id: string; reference?: string }) =>
        entry.id === quoteId || entry.reference === quoteId,
    ),
    false,
    'Aucune recette ou charge du devis ne doit fuiter dans le mois précédent.',
  );
  assert.equal(
    (await admin.delete(`/api/admin/accounting/${quoteId}`).set(integrationHeader)).status,
    404,
    'Un revenu automatique lié au devis ne doit pas être supprimé comme écriture manuelle.',
  );
  assert.equal(
    (
      await first.post('/api/admin/accounting').set(integrationHeader).send({
        type: 'charge',
        category: 'Carburant',
        label: 'Refus client',
        amount: 1,
        date: today,
      })
    ).status,
    403,
    'Un client ne peut pas créer une écriture comptable.',
  );

  const invalidLabel = `${context.prefix} montant invalide`;
  const beforeInvalid = await context.db.ecritureComptable.count({
    where: { libelle: invalidLabel },
  });
  const invalid = await admin
    .post('/api/admin/accounting')
    .set(integrationHeader)
    .send({ type: 'charge', category: 'Carburant', label: invalidLabel, amount: 0, date: today });
  assert.equal(invalid.status, 400);
  assert.equal(
    await context.db.ecritureComptable.count({ where: { libelle: invalidLabel } }),
    beforeInvalid,
    'Un montant invalide ne doit rien enregistrer en base.',
  );

  const label = `${context.prefix} écriture comptable à annuler`;
  const created = await admin
    .post('/api/admin/accounting')
    .set(integrationHeader)
    .send({ type: 'charge', category: 'Carburant', label, amount: 12_345, date: today });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const entryId = created.body.id as string;
  context.testAccountingEntryIds.push(entryId);
  assert.equal(created.body.amount, 12_345);

  const monthEntries = await admin
    .get(`/api/admin/accounting?month=${month}`)
    .set(integrationHeader);
  assert.equal(monthEntries.status, 200, JSON.stringify(monthEntries.body));
  assert.equal(
    monthEntries.body.filter((entry: { id: string }) => entry.id === entryId).length,
    1,
    'La charge doit être persistée une seule fois et apparaître dans son mois.',
  );
  const previousMonthDate = new Date(`${month}-01T12:00:00Z`);
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const previousMonthEntries = await admin
    .get(`/api/admin/accounting?month=${previousMonth}`)
    .set(integrationHeader);
  assert.equal(previousMonthEntries.status, 200, JSON.stringify(previousMonthEntries.body));
  assert.equal(
    previousMonthEntries.body.some((entry: { id: string }) => entry.id === entryId),
    false,
    'Le filtre mensuel ne doit pas exposer une charge dans le mauvais mois.',
  );

  const voided = await admin.delete(`/api/admin/accounting/${entryId}`).set(integrationHeader);
  assert.equal(voided.status, 204);
  assert.equal(
    (await admin.delete(`/api/admin/accounting/${entryId}`).set(integrationHeader)).status,
    404,
    'Une écriture déjà annulée ne doit pas être annulée une seconde fois.',
  );
  const activeEntries = await admin
    .get(`/api/admin/accounting?month=${month}`)
    .set(integrationHeader);
  assert.equal(activeEntries.status, 200, JSON.stringify(activeEntries.body));
  assert.equal(
    activeEntries.body.some((entry: { id: string }) => entry.id === entryId),
    false,
    'Une écriture annulée ne doit plus apparaître dans le journal actif.',
  );
  const persistedVoid = await context.db.ecritureComptable.findUniqueOrThrow({
    where: { id: entryId },
  });
  assert.ok(persistedVoid.annuleLe, 'L’annulation doit rester enregistrée en base.');
}

export async function verifyArchivedFinalRevenue(
  context: IntegrationContext,
  bookingId: string,
  quoteId: string,
  quoteAmount: number,
) {
  const { admin } = context.clients;
  const quote = await context.db.devis.findUniqueOrThrow({
    where: { id: quoteId },
    include: { reservation: true },
  });
  const bookingData = quote.reservation
    .donnees as import('../../src/domain/shared/model.js').Booking;
  const quoteSnapshot = bookingData.quotes.find((item) => item.id === quoteId);
  const quoteCosts = quoteSnapshot?.accountingCosts;
  assert.ok(quoteCosts);
  const expectedLabel = `Devis final ${quote.reference} · ${quote.reservation.reference} · ${context.prefix} Client`;

  assert.equal(
    (await admin.delete(`/api/bookings/${bookingId}`).set(integrationHeader)).status,
    204,
  );
  const trashedEntries = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(trashedEntries.status, 200, JSON.stringify(trashedEntries.body));
  assert.equal(
    trashedEntries.body.filter(
      (entry: { id: string; type: string; amount: number }) =>
        entry.id === quoteId && entry.type === 'revenu' && entry.amount === quoteAmount,
    ).length,
    1,
    'Mettre une réservation en corbeille ne doit pas effacer son revenu final.',
  );
  for (const [category, amount] of [
    ['Manœuvres', quoteCosts.moverAmount],
    ['Menuisier', quoteCosts.carpenterAmount],
  ] as const) {
    if (amount <= 0) continue;
    assert.equal(
      trashedEntries.body.filter(
        (entry: {
          reference?: string;
          category: string;
          amount: number;
          type: string;
          automatic: boolean;
        }) =>
          entry.reference === quoteId &&
          entry.category === category &&
          entry.amount === amount &&
          entry.type === 'charge' &&
          entry.automatic,
      ).length,
      1,
      `La charge ${category} doit rester visible dans le journal après mise en corbeille.`,
    );
  }

  assert.equal(
    (await admin.post(`/api/bookings/${bookingId}/restore`).set(integrationHeader)).status,
    204,
  );
  const restoredEntries = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(restoredEntries.status, 200, JSON.stringify(restoredEntries.body));
  assert.equal(
    restoredEntries.body.filter(
      (entry: { id: string; type: string }) => entry.id === quoteId && entry.type === 'revenu',
    ).length,
    1,
    'La restauration doit rétablir le devis dans le journal sans doublon.',
  );
  assert.equal(
    (await admin.delete(`/api/bookings/${bookingId}`).set(integrationHeader)).status,
    204,
  );
  assert.equal(
    (await admin.delete(`/api/bookings/${bookingId}/purge`).set(integrationHeader)).status,
    204,
  );

  const archived = await context.db.ecritureComptable.findMany({
    where: { sourceDevisId: quoteId },
  });
  context.testAccountingEntryIds.push(...archived.map((entry) => entry.id));
  const archivedRevenue = archived.find((entry) => entry.sourceQuoteKind === 'revenue');
  assert.equal(
    archived.length,
    1 + Number(quoteCosts.moverAmount > 0) + Number(quoteCosts.carpenterAmount > 0),
    'Chaque devis doit archiver exactement son revenu et ses seules charges non nulles.',
  );
  assert.ok(archivedRevenue, 'Le revenu final doit être archivé en base.');
  assert.equal(archivedRevenue.type, 'revenu');
  assert.equal(archivedRevenue.categorie, 'Déménagement');
  assert.equal(archivedRevenue.montant, quoteAmount);
  assert.equal(archivedRevenue.libelle, expectedLabel);
  for (const [kind, category, amount] of [
    ['movers', 'Manœuvres', quoteCosts.moverAmount],
    ['assembly', 'Menuisier', quoteCosts.carpenterAmount],
  ] as const) {
    const row = archived.find((entry) => entry.sourceQuoteKind === kind);
    if (amount > 0) {
      assert.ok(row, `La charge ${category} doit être archivée en base.`);
      assert.equal(row.categorie, category);
      assert.equal(row.montant, amount);
      assert.equal(
        row.sourceQuoteQuantity,
        kind === 'movers' ? quoteCosts.movers : quoteCosts.carpenters,
      );
    } else {
      assert.equal(row, undefined, `Aucune charge ${category} n’est créée pour un coût nul.`);
    }
  }
  assert.equal(
    (await admin.delete(`/api/admin/accounting/${archivedRevenue.id}`).set(integrationHeader))
      .status,
    404,
    'Le revenu archivé d’un devis ne doit pas être annulable comme une charge manuelle.',
  );
  assert.equal(
    (await admin.delete(`/api/bookings/${bookingId}/purge`).set(integrationHeader)).status,
    404,
    'Une réservation déjà purgée ne doit pas pouvoir archiver son devis une seconde fois.',
  );

  const afterPurge = await admin.get('/api/admin/accounting').set(integrationHeader);
  assert.equal(afterPurge.status, 200, JSON.stringify(afterPurge.body));
  const retainedRevenue = afterPurge.body.filter(
    (entry: { label: string; type: string; amount: number; automatic: boolean }) =>
      entry.label === expectedLabel &&
      entry.type === 'revenu' &&
      entry.amount === quoteAmount &&
      entry.automatic,
  );
  assert.equal(retainedRevenue.length, 1, 'La purge doit archiver le revenu final sans doublon.');
  for (const [category, amount] of [
    ['Manœuvres', quoteCosts.moverAmount],
    ['Menuisier', quoteCosts.carpenterAmount],
  ] as const) {
    if (amount <= 0) continue;
    assert.equal(
      afterPurge.body.filter(
        (entry: {
          reference?: string;
          category: string;
          amount: number;
          quantity?: number;
          type: string;
          automatic: boolean;
        }) =>
          entry.reference === quoteId &&
          entry.category === category &&
          entry.amount === amount &&
          entry.quantity ===
            (category === 'Manœuvres' ? quoteCosts.movers : quoteCosts.carpenters) &&
          entry.type === 'charge' &&
          entry.automatic,
      ).length,
      1,
      `La purge doit conserver une seule charge ${category} sans changer son montant.`,
    );
  }
  assert.equal(await context.db.devis.findUnique({ where: { id: quoteId } }), null);
}
