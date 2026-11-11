import assert from 'node:assert/strict';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';

const proof = '/assets/test-proof.jpg';

export async function runVehicleInspection(context: IntegrationContext) {
  const response = await context.clients.driver
    .post('/api/driver/vehicle-inspections')
    .set(integrationHeader)
    .send({
      levels: {
        engineOil: 'good',
        coolant: 'good',
        brakeFluid: 'good',
        powerSteering: 'good',
        washerFluid: 'good',
      },
      condition: 'good',
      notes: '',
      photos: {
        engineOil: proof,
        coolant: proof,
        brakeFluid: proof,
        powerSteering: proof,
        washerFluid: proof,
        condition: [proof],
      },
    });
  assert.equal(response.status, 201, JSON.stringify(response.body));
}

export async function completeRecordedTrips(context: IntegrationContext, bookingId: string) {
  const admin = context.clients.admin;
  const driver = context.clients.driver;
  let current = (await context.clients.admin.get('/api/bookings/' + bookingId)).body as {
    trips: { finishedAt: string | null; loadingPhotos: string[] }[];
  };
  while (current.trips.filter((trip) => trip.finishedAt).length < 2) {
    if (!current.trips.some((trip) => !trip.finishedAt)) {
      const started = await admin
        .post('/api/bookings/' + bookingId + '/trips/start')
        .set(integrationHeader)
        .send({ photos: [] });
      assert.equal(started.status, 201, JSON.stringify(started.body));
    }
    const finished = await admin
      .post('/api/bookings/' + bookingId + '/trips/finish')
      .set(integrationHeader)
      .send({ photos: [] });
    assert.equal(finished.status, 200, JSON.stringify(finished.body));
    current = finished.body;
  }
  for (const kind of ['retrait', 'depot'] as const) {
    const employeeProof = await driver
      .post(`/api/driver/bookings/${bookingId}/proofs`)
      .set(integrationHeader)
      .send({ kind, photos: [proof] });
    assert.equal(employeeProof.status, 200, JSON.stringify(employeeProof.body));
  }
  const response = await admin
    .post('/api/bookings/' + bookingId + '/driver-finished')
    .set(integrationHeader);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body as { version: number };
}

export async function createFinalQuoteAndClose(
  context: IntegrationContext,
  bookingId: string,
  version: number,
) {
  const admin = context.clients.admin;
  const tollPoint = await context.db.pointPeage.findFirstOrThrow();
  const finalQuote = await admin
    .post('/api/bookings/' + bookingId + '/quotes')
    .set(integrationHeader)
    .send({
      kind: 'final',
      trips: 2,
      discount: 1_000,
      customPrice: null,
      notes: 'Terminé',
      tolls: [{ tollPointId: tollPoint.id, direction: 'one-way', quantity: 2 }],
      version,
    });
  assert.equal(finalQuote.status, 201, JSON.stringify(finalQuote.body));
  assert.equal(finalQuote.body.status, 'completed');
  const createdQuote = (
    finalQuote.body.quotes as {
      id: string;
      kind: string;
      price: {
        total: number;
        discount: number;
        lines: { total: number }[];
      };
      tolls?: { tollPointId: string; quantity: number; unitPrice: number }[];
    }[]
  ).find((quote) => quote.kind === 'final');
  assert.ok(createdQuote, 'Le devis final doit apparaître dans la réservation.');
  assert.equal(
    createdQuote.price.total,
    createdQuote.price.lines.reduce((sum, line) => sum + line.total, 0) -
      createdQuote.price.discount,
    'Le total final doit reprendre ses lignes et sa remise après les remises de référence.',
  );
  assert.equal(createdQuote.tolls?.length, 1);
  assert.equal(createdQuote.tolls?.[0]?.tollPointId, tollPoint.id);
  assert.equal(createdQuote.tolls?.[0]?.quantity, 2);
  const tollPrices = tollPoint.tarifsVehicules as Record<string, number>;
  assert.equal(
    createdQuote.tolls?.[0]?.unitPrice,
    tollPrices.sprinter ?? tollPoint.tarifLourd,
    'Le tarif du péage final doit être figé avec le tarif du véhicule choisi.',
  );
  return {
    version: finalQuote.body.version as number,
    quoteId: createdQuote.id,
    amount: createdQuote.price.total,
  };
}

export async function verifyQuoteSnapshots(
  context: IntegrationContext,
  bookingId: string,
  quoteId: string,
  version: number,
) {
  const { db } = context;
  await db.vehicule.update({
    where: { id: 'sprinter' },
    data: { tarifs: [60_000, 74_000, 88_000] },
  });
  await db.parametreApplication.update({ where: { id: 'main' }, data: { tarifManoeuvre: 10_000 } });
  const quote = await db.devis.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lignes: true },
  });
  const persisted = (await context.clients.first.get('/api/bookings/' + bookingId)).body;
  assert.equal(persisted.status, 'completed');
  const finalQuote = (
    persisted.quotes as {
      id: string;
      kind: string;
      price: {
        total: number;
        discount: number;
        lines: { label: string; quantity: number; unitPrice: number; total: number }[];
      };
    }[]
  ).find((item) => item.id === quoteId && item.kind === 'final');
  assert.ok(finalQuote);
  assert.equal(quote.montantTotal, finalQuote.price.total);
  assert.equal(quote.lignes.length, finalQuote.price.lines.length);
  const savedQuote = await db.devis.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lignes: { orderBy: { position: 'asc' } } },
  });
  assert.ok(savedQuote.montantTotal !== null);
  assert.deepEqual(
    savedQuote.lignes.map((line) => [line.libelle, line.quantite, line.prixUnitaire, line.montant]),
    finalQuote.price.lines.map((line) => [line.label, line.quantity, line.unitPrice, line.total]),
    'Les lignes comptabilisées en base doivent être identiques au devis final.',
  );
  const quoteSnapshot = (
    persisted.quotes as {
      id: string;
      tolls?: { label: string; quantity: number; unitPrice: number }[];
    }[]
  ).find((item) => item.id === quoteId);
  assert.equal(quoteSnapshot?.tolls?.length, 1);
  assert.equal(
    savedQuote.lignes.reduce((sum, line) => sum + line.montant, 0),
    savedQuote.montantTotal + savedQuote.remise,
    'Les lignes de la facture finale doivent conserver le sous-total avant remise.',
  );
  assert.equal(
    savedQuote.lignes.some((line) => line.libelle.includes('Péage')),
    false,
    'Les péages à la charge du client ne doivent pas être intégrés aux lignes de déménagement.',
  );
  const estimate = persisted.estimate as {
    total: number;
    lines: { label: string; quantity: number; unitPrice: number; total: number }[];
  };
  assert.ok(estimate.lines.some((line) => line.label.startsWith('Remise jour creux')));
  assert.equal(
    estimate.total,
    estimate.lines.reduce((sum, line) => sum + line.total, 0),
    'Le total estimé doit conserver la remise jour creux après le parcours de réservation.',
  );
  const accounting = await context.clients.admin
    .get('/api/admin/accounting')
    .set(integrationHeader);
  assert.equal(accounting.status, 200, JSON.stringify(accounting.body));
  const finalRevenue = accounting.body.filter(
    (entry: { id: string; type: string; amount: number }) =>
      entry.id === quoteId && entry.type === 'revenu',
  );
  assert.equal(finalRevenue.length, 1);
  assert.equal(
    finalRevenue[0]?.amount,
    finalQuote.price.total,
    'Le revenu comptable final doit rester identique après modification des tarifs courants.',
  );

  const duplicateFinal = await context.clients.admin
    .post('/api/bookings/' + bookingId + '/quotes')
    .set(integrationHeader)
    .send({
      kind: 'final',
      trips: 3,
      discount: 0,
      customPrice: null,
      notes: 'Modification',
      version,
    });
  assert.equal(duplicateFinal.status, 400);
}
