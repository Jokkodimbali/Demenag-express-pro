import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../src/generated/prisma/client.js';
import { createPrisma } from '../src/adapters/out/prisma/client.js';
import { compose } from '../src/composition.js';
import { createApp } from '../src/adapters/in/http/app.js';
import type { RoutingProvider } from '../src/application/ports/index.js';
const url = process.env.TEST_DATABASE_URL;
function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
test(
  'Parcours API → Prisma → PostgreSQL : comptes, droits, réservation, devis et sessions',
  { skip: !url, timeout: 120000 },
  async () => {
    const db = createPrisma(url!);
    const prefix = 'Test ' + randomUUID();
    const userIds: string[] = [];
    const routeIds: string[] = [];
    const originalSettings = await db.parametreApplication.findUniqueOrThrow({
      where: { id: 'main' },
    });
    const originalVehicle = await db.vehicule.findUniqueOrThrow({ where: { id: 'sprinter' } });
    const routing: RoutingProvider = {
      route: async (from, to) => ({
        from,
        to,
        distanceKm: 20,
        durationMinutes: 35,
        geometry: [from, to],
      }),
      search: async () => [],
    };
    const app = createApp({
      ...compose(db, routing),
      origin: 'http://localhost:5173',
      production: false,
    });
    const a = request.agent(app),
      b = request.agent(app),
      admin = request.agent(app);
    const header = { 'X-Requested-With': 'DemenagExpress', Origin: 'http://localhost:5173' };
    const seed = Math.floor(Math.random() * 8000000) + 1000000;
    const phone = (n: number) => '77' + String(seed + n).padStart(7, '0');
    const password = 'Integration-test-2026!';
    try {
      // Jeux de données déterministes, indépendants des tarifs configurés dans l’interface.
      await db.vehicule.update({
        where: { id: 'sprinter' },
        data: { tarifs: [30000, 37000, 44000], actif: true },
      });
      await db.parametreApplication.update({
        where: { id: 'main' },
        data: {
          tarifManoeuvre: 6000,
          tarifMontage: 15000,
          bornesDistance: [15, 25, 35],
          reservationsOuvertes: true,
          quantiteMaximaleOptions: 20,
          nombreMaximalTrajets: 20,
          preavisReservationHeures: 0,
          delaiMaximumJours: 366,
          creneauxOuverts: [
            { label: 'Matin (8h – 12h)', startHour: 8 },
            { label: 'Après-midi (13h – 17h)', startHour: 13 },
            { label: 'Soir (17h – 20h)', startHour: 17 },
          ],
        },
      });
      assert.deepEqual(
        (await db.vehicule.findUniqueOrThrow({ where: { id: 'sprinter' } })).tarifs,
        [30000, 37000, 44000],
      );
      assert.equal(
        (await db.parametreApplication.findUniqueOrThrow({ where: { id: 'main' } })).tarifManoeuvre,
        6000,
      );
      for (const [agent, n] of [
        [a, 0],
        [b, 1],
        [admin, 2],
      ] as const) {
        const r = await agent
          .post('/api/auth/register')
          .set(header)
          .send({ name: prefix + ' ' + n, phone: phone(n), password, role: 'admin' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.role, 'client');
        assert.equal(r.body.passwordHash, undefined);
        userIds.push(r.body.id);
        assert.match(r.headers['set-cookie'][0], /HttpOnly/);
      }
      await db.utilisateur.update({ where: { id: userIds[2] }, data: { role: 'administrateur' } });
      assert.equal((await a.put('/api/catalogue').set(header).send({})).status, 403);
      assert.equal((await request(app).get('/api/bookings')).status, 401);
      assert.equal((await a.post('/api/bookings').send({})).status, 403);
      assert.equal(
        (
          await a
            .post('/api/bookings')
            .set({ ...header, Origin: 'https://attacker.example' })
            .send({})
        ).status,
        403,
      );
      const routed = await a
        .post('/api/maps/route')
        .set(header)
        .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
      assert.equal(routed.status, 200);
      routeIds.push(routed.body.id);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const input = {
        vehicleId: 'sprinter',
        routeId: routed.body.id,
        customerName: prefix + ' Client',
        customerPhone: phone(0),
        fromAddress: 'Ouakam Dakar',
        toAddress: 'Almadies Dakar',
        date: tomorrow,
        timeSlot: 'Matin (8h – 12h)',
        options: { labour: 1, desk: 0, wardrobe: 0, bed: 1 },
        notes: 'Test isolé',
        requestId: randomUUID(),
        estimate: { total: 1 },
      };
      assert.equal(
        (
          await a
            .post('/api/bookings')
            .set(header)
            .send({ ...input, date: '2020-01-01' })
        ).status,
        400,
      );
      const created = await a.post('/api/bookings').set(header).send(input);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const id = created.body.id;
      assert.equal(
        created.body.estimate.total,
        58000,
        JSON.stringify(created.body.pricingSettings),
      );
      const duplicate = await a.post('/api/bookings').set(header).send(input);
      assert.equal(duplicate.body.id, id);
      assert.equal(await db.reservation.count({ where: { utilisateurId: userIds[0] } }), 1);
      assert.equal((await b.get('/api/bookings/' + id)).status, 404);
      assert.equal((await b.get('/api/bookings')).body.length, 0);
      assert.equal(
        (
          await a
            .patch('/api/bookings/' + id + '/status')
            .set(header)
            .send({ status: 'confirmed', version: 1 })
        ).status,
        403,
      );
      const confirmed = await admin
        .patch('/api/bookings/' + id + '/status')
        .set(header)
        .send({ status: 'confirmed', version: 1 });
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      assert.equal(
        (
          await admin
            .patch('/api/bookings/' + id + '/status')
            .set(header)
            .send({ status: 'in_progress', version: 1 })
        ).status,
        409,
      );
      const collision = await b
        .post('/api/bookings')
        .set(header)
        .send({ ...input, requestId: randomUUID() });
      assert.equal(collision.status, 201);
      assert.equal(
        (
          await admin
            .patch('/api/bookings/' + collision.body.id + '/status')
            .set(header)
            .send({ status: 'confirmed', version: 1 })
        ).status,
        409,
      );
      const started = await admin
        .patch('/api/bookings/' + id + '/status')
        .set(header)
        .send({ status: 'in_progress', version: 2 });
      assert.equal(started.status, 200);
      const final = await admin
        .post('/api/bookings/' + id + '/quotes')
        .set(header)
        .send({
          kind: 'final',
          trips: 2,
          discount: 1000,
          customPrice: null,
          notes: 'Terminé',
          version: 3,
        });
      assert.equal(final.status, 201, JSON.stringify(final.body));
      assert.equal(final.body.status, 'completed');
      assert.equal(final.body.quotes[0].price.total, 94000);
      await db.vehicule.update({
        where: { id: 'sprinter' },
        data: { tarifs: [60000, 74000, 88000] },
      });
      await db.parametreApplication.update({
        where: { id: 'main' },
        data: { tarifManoeuvre: 10000 },
      });
      const savedQuote = await db.devis.findUniqueOrThrow({
        where: { id: final.body.quotes[0].id },
        include: { lignes: true },
      });
      assert.equal(savedQuote.montantTotal, 94000);
      assert.equal(savedQuote.lignes.length, 3);
      const persisted = (await a.get('/api/bookings/' + id)).body;
      assert.equal(persisted.quotes[0].price.total, 94000);
      assert.equal(persisted.estimate.total, 58000);
      assert.equal(
        (
          await admin
            .post('/api/bookings/' + id + '/quotes')
            .set(header)
            .send({
              kind: 'final',
              trips: 3,
              discount: 0,
              customPrice: null,
              notes: 'Modification',
              version: 4,
            })
        ).status,
        400,
      );
      // Droits d’administration et révocation effective des sessions d’un compte suspendu.
      assert.equal((await a.get('/api/admin/users')).status, 403);
      const accounts = await admin.get('/api/admin/users');
      assert.equal(accounts.status, 200);
      assert.equal(
        accounts.body.some((u: { passwordHash?: string }) => u.passwordHash),
        false,
      );
      const clientB = accounts.body.find((u: { id: string }) => u.id === userIds[1]);
      assert.equal(
        (
          await admin
            .put('/api/admin/users/' + clientB.id)
            .set(header)
            .send({ ...clientB, active: false })
        ).status,
        200,
      );
      assert.equal((await b.get('/api/bookings')).status, 401);
      assert.equal(
        (
          await b
            .post('/api/auth/login')
            .set(header)
            .send({ phone: phone(1), password })
        ).status,
        401,
      );
      assert.equal(
        (
          await admin
            .put('/api/admin/users/' + clientB.id)
            .set(header)
            .send({ ...clientB, active: true })
        ).status,
        200,
      );
      const own = accounts.body.find((u: { id: string }) => u.id === userIds[2]);
      assert.equal(
        (
          await admin
            .put('/api/admin/users/' + own.id)
            .set(header)
            .send({ ...own, role: 'client' })
        ).status,
        400,
      );
      // Les règles sont appliquées côté serveur, même si un client soumet un ancien formulaire.
      const catalogue = (await admin.get('/api/catalogue')).body;
      const update = (settings: object) =>
        admin
          .put('/api/catalogue')
          .set(header)
          .send({ ...catalogue, settings: { ...catalogue.settings, ...settings } });
      assert.equal((await update({ bookingsEnabled: false })).status, 200);
      assert.equal(
        (
          await a
            .post('/api/bookings')
            .set(header)
            .send({ ...input, requestId: randomUUID() })
        ).status,
        400,
      );
      assert.equal((await update({ maxOptions: 0 })).status, 200);
      assert.equal((await a.post('/api/estimates').set(header).send(input)).status, 400);
      assert.equal((await update({ distanceBounds: [30, 40, 50] })).status, 200);
      const estimate = await a
        .post('/api/estimates')
        .set(header)
        .send({ ...input, options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 } });
      assert.equal(estimate.body.tier, 0);
      assert.equal((await update({ distanceBounds: [30, 20, 50] })).status, 400);
      assert.equal((await update(catalogue.settings)).status, 200);
      assert.equal((await a.post('/api/auth/logout').set(header)).status, 204);
      assert.equal((await a.get('/api/bookings')).status, 401);
      const login = await a
        .post('/api/auth/login')
        .set(header)
        .send({ phone: phone(0), password });
      assert.equal(login.status, 200);
      assert.equal((await a.get('/api/bookings')).body.length, 1);
      const otherSession = request.agent(app);
      await otherSession
        .post('/api/auth/login')
        .set(header)
        .send({ phone: phone(0), password });
      assert.equal(
        (
          await a
            .post('/api/auth/password')
            .set(header)
            .send({ oldPassword: 'wrong', newPassword: 'Password-changed-2026!' })
        ).status,
        400,
      );
      assert.equal(
        (
          await a
            .post('/api/auth/password')
            .set(header)
            .send({ oldPassword: password, newPassword: 'Password-changed-2026!' })
        ).status,
        200,
      );
      assert.equal((await otherSession.get('/api/bookings')).status, 401);
      assert.equal((await a.get('/api/bookings')).status, 200);
    } finally {
      await db.vehicule.update({
        where: { id: originalVehicle.id },
        data: { tarifs: originalVehicle.tarifs, actif: originalVehicle.actif },
      });
      await db.parametreApplication.update({
        where: { id: 'main' },
        data: { ...originalSettings, creneauxOuverts: jsonInput(originalSettings.creneauxOuverts) },
      });
      await db.reservation.deleteMany({ where: { utilisateurId: { in: userIds } } });
      await db.utilisateur.deleteMany({ where: { id: { in: userIds } } });
      await db.itineraire.deleteMany({ where: { id: { in: routeIds } } });
      await db.$disconnect();
    }
  },
);
