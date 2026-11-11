import assert from 'node:assert/strict';
import request from 'supertest';
import type { Booking, WorkPlanStep } from '../../src/domain/shared/model.js';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';

const bookingPath = (id: string) => `/api/bookings/${id}`;
const reviewPath = (id: string, stepId: string) => `${bookingPath(id)}/work-plan/${stepId}/review`;

function savedPlan(context: IntegrationContext, bookingId: string) {
  return context.db.reservation
    .findUniqueOrThrow({ where: { id: bookingId } })
    .then(({ donnees }) => {
      const booking = donnees as Booking;
      return { booking, plan: booking.workPlan ?? [] };
    });
}

export async function verifyPlanningFollowUp(context: IntegrationContext, bookingId: string) {
  const { admin, driver, first } = context.clients;
  const response = await admin.get(bookingPath(bookingId));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const booking = response.body as Booking;
  assert.equal(
    booking.workPlan?.length,
    0,
    'Le scénario client doit déclencher le planning de repli.',
  );

  const steps: WorkPlanStep[] = [
    {
      id: 'fallback-1',
      time: '09:30',
      title: 'Arrivée au départ',
      detail: '',
      minutes: 15,
      review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
    },
    {
      id: 'fallback-2',
      time: '09:45',
      title: 'Déménagement',
      detail: 'Fiche d’appel non remplie : durée du créneau',
      minutes: 425,
      review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
    },
    {
      id: 'fallback-3',
      time: '16:50',
      title: 'Vérification finale',
      detail: '',
      minutes: 10,
      review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
    },
  ];
  const path = (stepId: string) => reviewPath(bookingId, stepId);
  const body = (version: number, patch: Record<string, unknown> = {}) => ({
    status: 'respected',
    reason: '',
    version,
    ...patch,
  });

  assert.equal(
    (
      await request(context.app)
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version))
    ).status,
    401,
  );
  assert.equal(
    (await first.patch(path('fallback-1')).set(integrationHeader).send(body(booking.version)))
      .status,
    403,
  );
  assert.equal(
    (await admin.patch(path('missing-step')).set(integrationHeader).send(body(booking.version)))
      .status,
    404,
  );
  assert.equal(
    (
      await admin
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version, { status: 'unknown' }))
    ).status,
    400,
  );
  assert.equal(
    (
      await admin
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version, { actualTime: '25:99' }))
    ).status,
    400,
  );
  assert.equal(
    (
      await admin
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version, { photo: 'data:image/gif;base64,ZmFrZQ==' }))
    ).status,
    400,
  );
  assert.equal(
    (
      await admin
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version, { cause: 'Autre' }))
    ).status,
    400,
  );
  assert.equal(
    (
      await admin
        .patch(path('fallback-1'))
        .set(integrationHeader)
        .send(body(booking.version, { reason: 'x'.repeat(1001) }))
    ).status,
    400,
  );
  assert.deepEqual(
    (await savedPlan(context, bookingId)).plan,
    [],
    'Les payloads invalides ne modifient aucune donnée.',
  );

  const respected = await admin
    .patch(path(steps[0]!.id))
    .set(integrationHeader)
    .send(body(booking.version, { actualTime: '09:32' }));
  assert.equal(respected.status, 200, JSON.stringify(respected.body));
  let version = respected.body.version as number;
  let persisted = await savedPlan(context, bookingId);
  assert.equal(persisted.plan[0]?.review.status, 'respected');
  assert.equal(persisted.plan[0]?.review.actualTime, '09:32');
  assert.ok(persisted.plan[0]?.review.checkedAt);
  assert.equal(
    persisted.plan[0]?.review.checkedBy,
    (
      await context.db.utilisateur.findUniqueOrThrow({
        where: { id: (await admin.get('/api/auth/me')).body.id },
      })
    ).nom,
  );
  assert.equal(persisted.booking.version, version);

  const stale = await admin
    .patch(path(steps[0]!.id))
    .set(integrationHeader)
    .send(body(booking.version, { status: 'late', reason: 'Mise à jour obsolète.' }));
  assert.equal(stale.status, 409);
  assert.equal((await savedPlan(context, bookingId)).plan[0]?.review.status, 'respected');

  const driverReview = await driver
    .patch(path(steps[1]!.id))
    .set(integrationHeader)
    .send(body(version, { status: 'late', actualTime: '10:05' }));
  assert.equal(driverReview.status, 403);
  assert.equal((await savedPlan(context, bookingId)).plan[1]?.review.status, 'pending');
  const adminReview = await admin
    .patch(path(steps[1]!.id))
    .set(integrationHeader)
    .send(body(version, { status: 'late', actualTime: '10:05' }));
  assert.equal(adminReview.status, 200, JSON.stringify(adminReview.body));
  version = adminReview.body.version as number;
  persisted = await savedPlan(context, bookingId);
  assert.equal(persisted.plan[1]?.review.status, 'late');
  assert.equal(persisted.plan[1]?.review.reason, '');
  assert.equal(persisted.plan[1]?.review.actualTime, '10:05');
  assert.equal(persisted.plan[1]?.review.checkedBy, (await admin.get('/api/auth/me')).body.name);

  const concurrent = await Promise.all([
    admin
      .patch(path(steps[1]!.id))
      .set(integrationHeader)
      .send(body(version, { status: 'late', reason: 'Embouteillage.', cause: 'Circulation' })),
    admin
      .patch(path(steps[1]!.id))
      .set(integrationHeader)
      .send(body(version, { status: 'not_respected', reason: 'Contrainte client.' })),
  ]);
  assert.deepEqual(
    concurrent.map(({ status }) => status).sort(),
    [200, 409],
    'Deux sauvegardes concurrentes basées sur la même version doivent produire un conflit explicite.',
  );
  version = concurrent.find(({ status }) => status === 200)!.body.version as number;
  const finalizedLate = await admin
    .patch(path(steps[1]!.id))
    .set(integrationHeader)
    .send(
      body(version, {
        status: 'late',
        reason: 'Embouteillage constaté sur le trajet.',
        actualTime: '10:05',
        cause: 'Circulation',
        severity: 'maj',
        correctiveAction: 'Prévoir un départ avec marge de circulation.',
      }),
    );
  assert.equal(finalizedLate.status, 200, JSON.stringify(finalizedLate.body));
  version = finalizedLate.body.version as number;

  const photo = 'data:image/jpeg;base64,ZmFrZQ==';
  const notRespected = await admin
    .patch(path(steps[2]!.id))
    .set(integrationHeader)
    .send(
      body(version, {
        status: 'not_respected',
        reason: 'Accès indisponible à l’arrivée.',
        actualTime: '12:52',
        photo,
        cause: 'Client',
        severity: 'cri',
        correctiveAction: 'Confirmer les conditions d’accès avant le départ.',
      }),
    );
  assert.equal(notRespected.status, 200, JSON.stringify(notRespected.body));
  version = notRespected.body.version as number;
  persisted = await savedPlan(context, bookingId);
  assert.equal(persisted.booking.version, version);
  assert.deepEqual(
    persisted.plan.map(({ review }) => review.status),
    ['respected', 'late', 'not_respected'],
  );
  assert.equal(persisted.plan[1]?.review.reason, 'Embouteillage constaté sur le trajet.');
  assert.equal(persisted.plan[1]?.review.cause, 'Circulation');
  assert.equal(persisted.plan[1]?.review.severity, 'maj');
  assert.equal(
    persisted.plan[1]?.review.correctiveAction,
    'Prévoir un départ avec marge de circulation.',
  );
  assert.equal(persisted.plan[2]?.review.photo, photo);
  assert.equal(persisted.plan[2]?.review.severity, 'cri');

  const reset = await admin
    .patch(path(steps[1]!.id))
    .set(integrationHeader)
    .send(
      body(version, {
        status: 'pending',
        reason: 'Embouteillage constaté sur le trajet.',
      }),
    );
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  persisted = await savedPlan(context, bookingId);
  assert.equal(persisted.plan[1]?.review.status, 'pending');
  assert.equal(persisted.plan[1]?.review.reason, 'Embouteillage constaté sur le trajet.');
  assert.equal(persisted.plan[1]?.review.cause, 'Circulation');
}
