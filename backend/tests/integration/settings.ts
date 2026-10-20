import assert from 'node:assert/strict';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';

export async function verifySettingsRules(context: IntegrationContext, bookingInput: object) {
  const { first, admin } = context.clients;
  const catalogue = (await admin.get('/api/catalogue')).body;
  const update = (settings: object) =>
    admin
      .put('/api/catalogue')
      .set(integrationHeader)
      .send({ ...catalogue, settings: { ...catalogue.settings, ...settings } });

  assert.equal((await update({ bookingsEnabled: false })).status, 200);
  assert.equal(
    (
      await first
        .post('/api/bookings')
        .set(integrationHeader)
        .send({ ...bookingInput, requestId: crypto.randomUUID() })
    ).status,
    400,
  );
  assert.equal((await update({ maxOptions: 0 })).status, 200);
  assert.equal(
    (await first.post('/api/estimates').set(integrationHeader).send(bookingInput)).status,
    400,
  );
  assert.equal((await update({ distanceBounds: [30, 40, 50] })).status, 200);
  const estimate = await first
    .post('/api/estimates')
    .set(integrationHeader)
    .send({
      ...bookingInput,
      options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    });
  assert.equal(estimate.body.tier, 0);
  assert.equal((await update({ distanceBounds: [30, 20, 50] })).status, 400);
  assert.equal((await update(catalogue.settings)).status, 200);
}
