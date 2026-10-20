import assert from 'node:assert/strict';
import request, { type Response } from 'supertest';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';
import { createBookingInput } from './configuration.js';

export async function createAndAuthorizeBooking(context: IntegrationContext, routeId: string) {
  const { db, app, clients } = context;
  const { first, second, admin } = clients;
  assert.equal((await first.put('/api/catalogue').set(integrationHeader).send({})).status, 403);
  assert.equal((await request(app).get('/api/bookings')).status, 401);
  assert.equal((await first.post('/api/bookings').send({})).status, 403);
  assert.equal(
    (
      await first
        .post('/api/bookings')
        .set({ ...integrationHeader, Origin: 'https://attacker.example' })
        .send({})
    ).status,
    403,
  );
  const input = createBookingInput(context, routeId);
  assert.equal(
    (
      await first
        .post('/api/bookings')
        .set(integrationHeader)
        .send({ ...input, date: '2020-01-01' })
    ).status,
    400,
  );
  const created = await first.post('/api/bookings').set(integrationHeader).send(input);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const bookingId = created.body.id;
  assert.equal(created.body.estimate.total, 58_000, JSON.stringify(created.body.pricingSettings));
  const duplicate = await first.post('/api/bookings').set(integrationHeader).send(input);
  assert.equal(duplicate.body.id, bookingId);
  assert.equal(
    await db.reservation.count({
      where: { utilisateurId: (await first.get('/api/auth/me')).body.id },
    }),
    1,
  );
  assert.equal((await second.get('/api/bookings/' + bookingId)).status, 404);
  assert.equal((await second.get('/api/bookings')).body.length, 0);

  const collision = await second
    .post('/api/bookings')
    .set(integrationHeader)
    .send({ ...input, requestId: crypto.randomUUID() });
  assert.equal(collision.status, 201);
  const assigned = await admin
    .patch('/api/bookings/' + bookingId + '/driver')
    .set(integrationHeader)
    .send({ driverId: context.driverId, version: 1 });
  return { bookingId, input, collisionId: collision.body.id, assigned };
}

export async function advanceBookingToInProgress(
  context: IntegrationContext,
  bookingId: string,
  collisionId: string,
  assigned: Response,
) {
  const { first, admin, driver } = context.clients;
  assert.equal(assigned.status, 200);
  assert.equal(
    (
      await first
        .patch('/api/bookings/' + bookingId + '/status')
        .set(integrationHeader)
        .send({ status: 'confirmed', version: assigned.body.version })
    ).status,
    403,
  );
  const confirmed = await admin
    .patch('/api/bookings/' + bookingId + '/status')
    .set(integrationHeader)
    .send({ status: 'confirmed', version: assigned.body.version });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(
    (
      await admin
        .patch('/api/bookings/' + bookingId + '/status')
        .set(integrationHeader)
        .send({ status: 'in_progress', version: 1 })
    ).status,
    409,
  );
  assert.equal(
    (
      await admin
        .patch('/api/bookings/' + collisionId + '/status')
        .set(integrationHeader)
        .send({ status: 'confirmed', version: 1 })
    ).status,
    409,
  );
  const started = await admin
    .patch('/api/bookings/' + bookingId + '/status')
    .set(integrationHeader)
    .send({ status: 'in_progress', version: confirmed.body.version });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return { driver };
}
