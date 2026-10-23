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
  const finalQuote = await admin
    .post('/api/bookings/' + bookingId + '/quotes')
    .set(integrationHeader)
    .send({
      kind: 'final',
      trips: 2,
      discount: 1_000,
      customPrice: null,
      notes: 'Terminé',
      version,
    });
  assert.equal(finalQuote.status, 201, JSON.stringify(finalQuote.body));
  assert.equal(finalQuote.body.status, 'in_progress');
  assert.equal(finalQuote.body.quotes[0].price.total, 94_000);

  const closed = await admin
    .patch('/api/bookings/' + bookingId + '/status')
    .set(integrationHeader)
    .send({ status: 'completed', version: finalQuote.body.version });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.status, 'completed');
  return {
    ...finalQuote.body,
    version: closed.body.version,
  } as { version: number; quotes: { id: string }[] };
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
  assert.equal(persisted.quotes[0].price.total, 94_000);
  assert.equal(persisted.estimate.total, 58_000);

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
