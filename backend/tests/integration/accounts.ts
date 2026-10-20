import assert from 'node:assert/strict';
import request from 'supertest';
import type { IntegrationContext } from './context.js';
import { integrationHeader, integrationPassword } from './context.js';

export async function registerScenarioUsers(context: IntegrationContext) {
  const { db, clients, prefix, phone } = context;
  const userIds: string[] = [];
  for (const [agent, n] of [
    [clients.first, 0],
    [clients.second, 1],
    [clients.admin, 2],
  ] as const) {
    const response = await agent
      .post('/api/auth/register')
      .set(integrationHeader)
      .send({
        name: prefix + ' ' + n,
        phone: phone(n),
        password: integrationPassword,
        role: 'admin',
      });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.role, 'client');
    assert.equal(response.body.passwordHash, undefined);
    userIds.push(response.body.id);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  }

  await db.utilisateur.updateMany({ where: { id: { in: userIds } }, data: { actif: true } });
  await db.utilisateur.update({
    where: { id: userIds[2] },
    data: { role: 'administrateur' },
  });
  const driver = await clients.admin
    .post('/api/admin/drivers')
    .set(integrationHeader)
    .send({
      name: prefix + ' Chauffeur',
      phone: phone(3),
      photo: '/assets/test-driver.jpg',
      active: true,
      vehicleId: 'sprinter',
      password: integrationPassword,
    });
  assert.equal(driver.status, 201, JSON.stringify(driver.body));
  userIds.push(driver.body.userId);
  context.driverId = driver.body.id;
  const login = await clients.driver
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: phone(3), password: integrationPassword });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { userIds, driverId: driver.body.id };
}

export async function verifyAccountAdministration(context: IntegrationContext, userIds: string[]) {
  const { clients, phone } = context;
  const { admin, first, second } = clients;
  assert.equal((await first.get('/api/admin/users')).status, 403);
  const accounts = await admin.get('/api/admin/users');
  assert.equal(accounts.status, 200);
  assert.equal(
    accounts.body.some((user: { passwordHash?: string }) => user.passwordHash),
    false,
  );

  const client = accounts.body.find((user: { id: string }) => user.id === userIds[1]);
  assert.equal(
    (
      await admin
        .put('/api/admin/users/' + client.id)
        .set(integrationHeader)
        .send({ ...client, active: false })
    ).status,
    200,
  );
  assert.equal((await second.get('/api/bookings')).status, 401);
  assert.equal(
    (
      await second
        .post('/api/auth/login')
        .set(integrationHeader)
        .send({ phone: phone(1), password: integrationPassword })
    ).status,
    401,
  );
  assert.equal(
    (
      await admin
        .put('/api/admin/users/' + client.id)
        .set(integrationHeader)
        .send({ ...client, active: true })
    ).status,
    200,
  );

  const own = accounts.body.find((user: { id: string }) => user.id === userIds[2]);
  assert.equal(
    (
      await admin
        .put('/api/admin/users/' + own.id)
        .set(integrationHeader)
        .send({ ...own, role: 'client' })
    ).status,
    400,
  );
}

export async function verifySessionLifecycle(context: IntegrationContext) {
  const { clients, phone } = context;
  const { admin, first } = clients;
  const password = 'Password-changed-2026!';
  assert.equal((await first.post('/api/auth/logout').set(integrationHeader)).status, 204);
  assert.equal((await first.get('/api/bookings')).status, 401);
  const login = await first
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: phone(0), password: integrationPassword });
  assert.equal(login.status, 200);
  assert.equal((await first.get('/api/bookings')).body.length, 1);

  const otherSession = request.agent(context.app);
  await otherSession
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: phone(0), password: integrationPassword });
  assert.equal(
    (
      await first
        .post('/api/auth/password')
        .set(integrationHeader)
        .send({ oldPassword: 'wrong', newPassword: password })
    ).status,
    400,
  );
  assert.equal(
    (
      await first
        .post('/api/auth/password')
        .set(integrationHeader)
        .send({ oldPassword: integrationPassword, newPassword: password })
    ).status,
    200,
  );
  assert.equal((await otherSession.get('/api/bookings')).status, 401);
  assert.equal((await first.get('/api/bookings')).status, 200);
}
