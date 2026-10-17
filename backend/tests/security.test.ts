import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createAccess } from '../src/adapters/in/http/access.js';
import { getActor } from '../src/adapters/in/http/actor.js';
import { registerSecurityMiddleware } from '../src/adapters/in/http/security-middleware.js';
import { registerErrorHandler } from '../src/adapters/in/http/error-handler.js';
import {
  canReadBooking,
  requireActiveUser,
  requireAdministrator,
} from '../src/domain/policies/access.js';
import type { User } from '../src/domain/model.js';
const client: User = {
  id: '8f434967-4011-4a6d-a5a8-2ba225b4682b',
  name: 'Test Client',
  phone: '+221771234567',
  role: 'client',
  active: true,
};
const administrator: User = {
  ...client,
  id: '8f434967-4011-4a6d-a5a8-2ba225b4682c',
  role: 'admin',
};
const driver: User = { ...client, role: 'driver' };
test('Les policies refusent les comptes inactifs et les accès aux réservations d’autrui', () => {
  assert.throws(() => requireActiveUser(null));
  assert.throws(() => requireAdministrator(client));
  assert.throws(() => requireAdministrator({ ...administrator, active: false }));
  assert.doesNotThrow(() => requireAdministrator(administrator));
  assert.equal(canReadBooking(client, client.id), true);
  assert.equal(canReadBooking(client, administrator.id), false);
  assert.equal(canReadBooking(administrator, client.id), true);
  assert.equal(canReadBooking({ ...administrator, active: false }, client.id), false);
});
test('HTTP : authentification, rôle, CSRF, en-têtes et limitation de fréquence', async () => {
  const app = express();
  registerSecurityMiddleware(app, { origin: 'http://localhost:5173', production: false });
  const access = createAccess({
    production: false,
    auth: {
      current: async (token) =>
        token === 'admin'
          ? administrator
          : token === 'client'
            ? client
            : token === 'driver'
              ? driver
              : token === 'inactive'
                ? { ...administrator, active: false }
                : null,
    },
  });
  app.post('/api/admin/test', access.authenticate, access.admin, (_req, res) =>
    res.json({ ok: true }),
  );
  app.get('/api/driver/test', access.authenticate, (_req, res) =>
    res.json({ role: getActor(res).role }),
  );
  app.get('/api/limited', access.authLimiter, (_req, res) => res.json({ ok: true }));
  registerErrorHandler(app);
  const headers = { 'X-Requested-With': 'DemenagExpress', Origin: 'http://localhost:5173' };
  assert.equal((await request(app).post('/api/admin/test').set(headers)).status, 401);
  assert.equal(
    (
      await request(app)
        .post('/api/admin/test')
        .set(headers)
        .set('Cookie', 'dem_session=client')
        .send({ role: 'admin' })
    ).status,
    403,
  );
  assert.equal(
    (await request(app).post('/api/admin/test').set(headers).set('Cookie', 'dem_session=inactive'))
      .status,
    401,
  );
  assert.equal(
    (await request(app).post('/api/admin/test').set('Cookie', 'dem_session=admin')).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/admin/test')
        .set(headers)
        .set('Origin', 'https://untrusted.example')
        .set('Cookie', 'dem_session=admin')
    ).status,
    403,
  );
  const allowed = await request(app)
    .post('/api/admin/test')
    .set(headers)
    .set('Cookie', 'dem_session=admin');
  assert.equal(allowed.status, 200);
  const driverResponse = await request(app)
    .get('/api/driver/test')
    .set('Cookie', 'dem_session=driver');
  assert.equal(driverResponse.status, 200);
  assert.equal(driverResponse.body.role, 'driver');
  assert.equal(allowed.headers['x-powered-by'], undefined);
  assert.equal(allowed.headers['cache-control'], 'no-store');
  assert.ok(allowed.headers['content-security-policy']);
  for (let i = 0; i < 30; i++) assert.equal((await request(app).get('/api/limited')).status, 200);
  assert.equal((await request(app).get('/api/limited')).status, 429);
});
