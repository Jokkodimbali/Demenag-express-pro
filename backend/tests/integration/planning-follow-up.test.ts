import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookingInput } from './configuration.js';
import { createIntegrationContext, integrationHeader } from './context.js';
import { deleteScenarioData } from './cleanup.js';
import { registerScenarioUsers } from './accounts.js';
import { verifyPlanningFollowUp } from './planning-follow-up.js';

test(
  'Suivi du planning : API, droits, statuts, conflits et persistance PostgreSQL',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120_000 },
  async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) return;
    const context = createIntegrationContext(url);
    const routeIds: string[] = [];
    try {
      await registerScenarioUsers(context);
      const route = await context.clients.first
        .post('/api/maps/route')
        .set(integrationHeader)
        .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
      assert.equal(route.status, 200, JSON.stringify(route.body));
      routeIds.push(route.body.id as string);

      const booking = await context.clients.first
        .post('/api/bookings')
        .set(integrationHeader)
        .send(createBookingInput(context, route.body.id));
      assert.equal(booking.status, 201, JSON.stringify(booking.body));
      assert.deepEqual(booking.body.workPlan, []);
      await verifyPlanningFollowUp(context, booking.body.id as string);
    } finally {
      await deleteScenarioData(context, routeIds);
      await context.db.$disconnect();
    }
  },
);
