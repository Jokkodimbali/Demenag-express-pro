import assert from 'node:assert/strict';
import request, { type Response } from 'supertest';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';
import { createBookingInput } from './configuration.js';
import type { Booking } from '../../src/domain/model.js';

export async function createAndAuthorizeBooking(context: IntegrationContext, routeId: string) {
  const { db, app, clients } = context;
  const { first, second, admin, driver } = clients;
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
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
  assert.equal(
    (
      await first
        .patch('/api/bookings/' + bookingId + '/crew')
        .set(integrationHeader)
        .send({})
    ).status,
    403,
  );
  const driverId = context.driverId;
  assert.ok(driverId);
  const crew = { chauffeur: [driverId], menuisier: [], manoeuvre: [], chef: driverId };
  const teamPath = '/api/bookings/' + bookingId + '/crew';
  const crewAssigned = await admin.patch(teamPath).set(integrationHeader).send({
    crew,
    crewBriefs: {},
    crewRefusedBy: [],
    crewReplies: {},
    crewMessages: {},
    version: assigned.body.version,
  });
  assert.equal(crewAssigned.status, 200, JSON.stringify(crewAssigned.body));
  assert.deepEqual(crewAssigned.body.crew, crew);
  const persisted = await db.reservation.findUniqueOrThrow({ where: { id: bookingId } });
  assert.deepEqual((persisted.donnees as Booking).crew, crew);

  const duplicateRole = await admin
    .patch(teamPath)
    .set(integrationHeader)
    .send({
      crew: { ...crew, manoeuvre: [driverId] },
      crewBriefs: {},
      crewRefusedBy: [],
      crewReplies: {},
      crewMessages: {},
      version: crewAssigned.body.version,
    });
  assert.equal(duplicateRole.status, 400);
  const invalidChef = await admin
    .patch(teamPath)
    .set(integrationHeader)
    .send({
      crew: { ...crew, chef: '00000000-0000-4000-8000-000000000001' },
      crewBriefs: {},
      crewRefusedBy: [],
      crewReplies: {},
      crewMessages: {},
      version: crewAssigned.body.version,
    });
  assert.equal(invalidChef.status, 400);
  const wrongRole = await admin
    .patch(teamPath)
    .set(integrationHeader)
    .send({
      crew: { chauffeur: [], menuisier: [driverId], manoeuvre: [], chef: driverId },
      crewBriefs: {},
      crewRefusedBy: [],
      crewReplies: {},
      crewMessages: {},
      version: crewAssigned.body.version,
    });
  assert.equal(wrongRole.status, 400);
  const unknownMember = await admin
    .patch(teamPath)
    .set(integrationHeader)
    .send({
      crew: {
        chauffeur: ['00000000-0000-4000-8000-000000000001'],
        menuisier: [],
        manoeuvre: [],
        chef: '00000000-0000-4000-8000-000000000001',
      },
      crewBriefs: {},
      crewRefusedBy: [],
      crewReplies: {},
      crewMessages: {},
      version: crewAssigned.body.version,
    });
  assert.equal(unknownMember.status, 400);
  const briefAt = new Date().toISOString();
  const teamProgress = await admin
    .patch(teamPath)
    .set(integrationHeader)
    .send({
      crew,
      crewBriefs: { [driverId]: briefAt },
      crewRefusedBy: [],
      crewReplies: { [driverId]: 'ok' },
      crewMessages: { [driverId]: 'Brief de test intégré.' },
      version: crewAssigned.body.version,
    });
  assert.equal(teamProgress.status, 200, JSON.stringify(teamProgress.body));
  const persistedProgress = await db.reservation.findUniqueOrThrow({ where: { id: bookingId } });
  const savedBooking = persistedProgress.donnees as Booking;
  assert.equal(savedBooking.crewBriefs?.[driverId], briefAt);
  assert.equal(savedBooking.crewReplies?.[driverId], 'ok');
  assert.equal(savedBooking.crewMessages?.[driverId], 'Brief de test intégré.');
  const stale = await admin.patch(teamPath).set(integrationHeader).send({
    crew,
    crewBriefs: {},
    crewRefusedBy: [],
    crewReplies: {},
    crewMessages: {},
    version: crewAssigned.body.version,
  });
  assert.equal(stale.status, 409);

  const removed = await admin
    .delete('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({});
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.removed, false);
  assert.equal(removed.body.employee.active, false);
  const unassigned = await db.reservation.findUniqueOrThrow({ where: { id: bookingId } });
  assert.equal(unassigned.chauffeurId, null);
  assert.deepEqual((unassigned.donnees as Booking).crew, {
    chauffeur: [],
    menuisier: [],
    manoeuvre: [],
    chef: '',
  });
  assert.equal((await db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).actif, false);
  assert.equal(
    (await db.utilisateur.findUniqueOrThrow({ where: { id: removed.body.employee.userId } })).actif,
    false,
  );
  assert.equal((await driver.get('/api/driver/profile').set(integrationHeader)).status, 401);
  const inactiveAssignment = await admin.patch(teamPath).set(integrationHeader).send({
    crew,
    crewBriefs: {},
    crewRefusedBy: [],
    crewReplies: {},
    crewMessages: {},
    version: unassigned.version,
  });
  assert.equal(inactiveAssignment.status, 400);

  const reactivated = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...removed.body.employee, active: true });
  assert.equal(reactivated.status, 200, JSON.stringify(reactivated.body));
  assert.equal(
    (await db.utilisateur.findUniqueOrThrow({ where: { id: removed.body.employee.userId } })).actif,
    true,
  );
  assert.equal(
    (
      await driver
        .post('/api/auth/login')
        .set(integrationHeader)
        .send({ phone: reactivated.body.phone, password: context.driverPassword })
    ).status,
    200,
  );
  const reassigned = await admin.patch(teamPath).set(integrationHeader).send({
    crew,
    crewBriefs: {},
    crewRefusedBy: [],
    crewReplies: {},
    crewMessages: {},
    version: unassigned.version,
  });
  assert.equal(reassigned.status, 200, JSON.stringify(reassigned.body));
  assert.equal(
    (await db.reservation.findUniqueOrThrow({ where: { id: bookingId } })).chauffeurId,
    driverId,
  );
  return { bookingId, input, collisionId: collision.body.id, assigned: reassigned };
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
    .post('/api/bookings/' + bookingId + '/trips/start')
    .set(integrationHeader)
    .send({ photos: [] });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  return { driver };
}
