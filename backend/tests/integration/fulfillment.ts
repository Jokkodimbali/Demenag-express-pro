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
  const driver = context.clients.driver;
  let current = (await context.clients.admin.get('/api/bookings/' + bookingId)).body as {
    trips: { finishedAt: string | null; loadingPhotos: string[] }[];
  };
  while (current.trips.filter((trip) => trip.finishedAt).length < 2) {
    if (!current.trips.some((trip) => !trip.finishedAt)) {
      const started = await driver
        .post('/api/bookings/' + bookingId + '/trips/start')
        .set(integrationHeader)
        .send({ photos: [proof] });
      assert.equal(started.status, 201, JSON.stringify(started.body));
    } else if (!current.trips.at(-1)?.loadingPhotos.length) {
      const proofAdded = await driver
        .post('/api/bookings/' + bookingId + '/trips/start')
        .set(integrationHeader)
        .send({ photos: [proof] });
      assert.equal(proofAdded.status, 201, JSON.stringify(proofAdded.body));
    }
    const finished = await driver
      .post('/api/bookings/' + bookingId + '/trips/finish')
      .set(integrationHeader)
      .send({ photos: [proof] });
    assert.equal(finished.status, 200, JSON.stringify(finished.body));
    current = finished.body;
  }
  const response = await driver
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
      price: { total: number };
      tolls?: { tollPointId: string; quantity: number; unitPrice: number }[];
    }[]
  ).find((quote) => quote.kind === 'final');
  assert.ok(createdQuote, 'Le devis final doit apparaître dans la réservation.');
  assert.equal(createdQuote.price.total, 94_000);
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
  assert.equal(quote.montantTotal, 94_000);
  assert.equal(quote.lignes.length, 3);
  const persisted = (await context.clients.first.get('/api/bookings/' + bookingId)).body;
  assert.equal(persisted.status, 'completed');
  const finalQuote = (persisted.quotes as { kind: string; price: { total: number } }[]).find(
    (item) => item.kind === 'final',
  );
  assert.equal(finalQuote?.price.total, 94_000);
  const savedQuote = await db.devis.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lignes: { orderBy: { position: 'asc' } } },
  });
  assert.ok(savedQuote.montantTotal !== null);
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
  assert.equal(persisted.estimate.total, 58_000);
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
    94_000,
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
