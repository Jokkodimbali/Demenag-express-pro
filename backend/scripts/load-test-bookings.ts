import '../src/config/env.js';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { createApp } from '../src/adapters/in/http/app.js';
import { createPrisma } from '../src/adapters/out/prisma/client.js';
import { compose } from '../src/composition.js';
import type { Point, RouteTicket } from '../src/domain/model.js';

const clientCount = Number(process.env.LOAD_TEST_CLIENTS || 1000);
const expectedDevEndpoint = 'ep-blue-river-b4hli0fp';
const url = process.env.LOAD_TEST_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const poolMax = Number(process.env.LOAD_TEST_POOL_MAX || 5);
const batchLimit = Number(process.env.LOAD_TEST_BATCH_LIMIT || clientCount);

assert.equal(
  process.env.ALLOW_BOOKING_LOAD_TESTS,
  'true',
  'Définissez ALLOW_BOOKING_LOAD_TESTS=true pour autoriser ce test destructif et nettoyé.',
);
assert.ok(url, 'Définissez LOAD_TEST_DATABASE_URL ou DATABASE_URL_UNPOOLED.');
assert.ok(Number.isInteger(poolMax) && poolMax >= 1 && poolMax <= 50, 'LOAD_TEST_POOL_MAX doit être entre 1 et 50.');
assert.ok(Number.isInteger(batchLimit) && batchLimit >= 1 && batchLimit <= clientCount, 'LOAD_TEST_BATCH_LIMIT doit être entre 1 et LOAD_TEST_CLIENTS.');
assert.ok(
  new URL(url).hostname.startsWith(expectedDevEndpoint),
  'Le test de charge est limité à la branche Neon dev-web-hexagonal.',
);

const db = createPrisma(url, poolMax);
const prefix = `LoadTest ${randomUUID()}`;
const ids = Array.from({ length: clientCount }, () => randomUUID());
const bookingIds = new Array<string>(clientCount);
const tokens = Array.from({ length: clientCount }, () => randomBytes(32).toString('base64url'));
const requestIds = Array.from({ length: clientCount }, () => randomUUID());
const routeId = randomUUID();
const expiresAt = new Date(Date.now() + 30 * 60_000);
const now = new Date();
const sessionExpiry = new Date(Date.now() + 60 * 60_000);
const originalFetch = globalThis.fetch;

async function cleanup() {
  await db.notification.deleteMany({ where: { reservationId: { in: bookingIds.filter(Boolean) } } });
  await db.reservation.deleteMany({ where: { utilisateurId: { in: ids } } });
  await db.sessionConnexion.deleteMany({ where: { utilisateurId: { in: ids } } });
  await db.utilisateur.deleteMany({ where: { id: { in: ids } } });
  await db.itineraire.deleteMany({ where: { id: routeId } });
  const [users, sessions, bookings, routes, linkedNotifications] = await Promise.all([
    db.utilisateur.count({ where: { id: { in: ids } } }),
    db.sessionConnexion.count({ where: { utilisateurId: { in: ids } } }),
    db.reservation.count({ where: { utilisateurId: { in: ids } } }),
    db.itineraire.count({ where: { id: routeId } }),
    db.notification.count({ where: { reservationId: { in: bookingIds.filter(Boolean) } } }),
  ]);
  assert.deepEqual(
    { users, sessions, bookings, routes, linkedNotifications },
    { users: 0, sessions: 0, bookings: 0, routes: 0, linkedNotifications: 0 },
    'Le nettoyage du test de charge doit retirer toutes les lignes créées.',
  );
}

async function run() {
  let scenarioError: unknown;
  let cleanupError: unknown;
  try {
    const [settings, vehicle] = await Promise.all([
      db.parametreApplication.findUnique({ where: { id: 'main' } }),
      db.vehicule.findUnique({ where: { id: 'sprinter' } }),
    ]);
    assert.ok(settings, 'Le catalogue de test doit être initialisé.');
    assert.ok(vehicle?.actif, 'Le véhicule sprinter doit être actif pour le test.');
    assert.ok(settings.reservationsOuvertes, 'Les réservations doivent être ouvertes.');
    const enabledSlots = Array.isArray(settings.creneauxOuverts)
      ? (settings.creneauxOuverts as unknown as { startHour: number }[])
      : [];
    assert.ok(enabledSlots.length, 'Au moins un créneau doit être ouvert.');

    const phoneSeed = randomInt(1_000_000, 9_000_000);
    const phones = ids.map((_, index) => `+22177${String(phoneSeed + index).padStart(7, '0')}`);
    const collisions = await db.utilisateur.count({ where: { telephone: { in: phones } } });
    assert.equal(collisions, 0, 'Les numéros générés doivent être libres avant les insertions.');

    const from: Point = [14.69, -17.44];
    const to: Point = [14.73, -17.48];
    const route: RouteTicket = {
      id: routeId,
      from,
      to,
      distanceKm: 20,
      durationMinutes: 35,
      geometry: [from, to],
      expiresAt: expiresAt.toISOString(),
    };
    const usersData = ids.map((id, index) => ({
      id,
      nom: `${prefix} ${index}`,
      telephone: phones[index],
      empreinteMotDePasse: 'load-test-only-disabled-password',
      role: 'client' as const,
      actif: true,
      creeLe: now,
    }));
    const sessionsData = ids.map((utilisateurId, index) => ({
      empreinteJeton: createHash('sha256').update(tokens[index]).digest('hex'),
      utilisateurId,
      expireLe: sessionExpiry,
    }));

    await db.$transaction([
      db.utilisateur.createMany({ data: usersData }),
      db.sessionConnexion.createMany({ data: sessionsData }),
      db.itineraire.create({
        data: { id: routeId, donnees: route, expireLe: expiresAt },
      }),
    ]);

    const routing = {
      route: async (start: Point, end: Point) => ({
        from: start,
        to: end,
        distanceKm: 20,
        durationMinutes: 35,
        geometry: [start, end],
      }),
      search: async () => [],
      reverse: async () => 'Adresse de test',
    };
    const services = compose(db, routing);
    const app = createApp({
      ...services,
      notifications: undefined,
      origin: 'https://load-test.invalid',
      production: true,
    });
    const errors = new Map<string, number>();
    const errorDetails = new Map<string, number>();
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const detail = args.find((value) => typeof value === 'object' && value !== null && 'code' in value) as { code?: unknown } | undefined;
      const key = typeof detail?.code === 'string' ? detail.code : 'untyped';
      errors.set(key, (errors.get(key) ?? 0) + 1);
    };
    const agent = request.agent(app);
    const minimumDays = Math.max(2, Math.ceil(settings.preavisReservationHeures / 24) + 1);
    assert.ok(
      minimumDays <= settings.delaiMaximumJours,
      'Le délai minimum doit permettre une date dans la fenêtre autorisée.',
    );
    const date = new Date(Date.now() + minimumDays * 86_400_000).toISOString().slice(0, 10);
    const firstSlot = enabledSlots[0];
    assert.ok(Number.isInteger(firstSlot.startHour), 'Le premier créneau doit être valide.');
    const timeSlot = `${String(firstSlot.startHour).padStart(2, '0')}:00`;
    const latencies = new Array<number>(clientCount);
    const startedAt = performance.now();

    const responses = [];
    for (let offset = 0; offset < ids.length; offset += batchLimit) {
      const batch = await Promise.all(
        ids.slice(offset, offset + batchLimit).map(async (_, batchIndex) => {
          const index = offset + batchIndex;
          const started = performance.now();
          const response = await agent
            .post('/api/bookings')
            .set('Origin', 'https://load-test.invalid')
            .set('X-Requested-With', 'DemenagExpress')
            .set('X-Forwarded-For', `198.51.${Math.floor(index / 250)}.${(index % 250) + 1}`)
            .set('Cookie', `dem_session=${tokens[index]}`)
            .send({
              vehicleId: vehicle.id,
              routeId,
              options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
              customerName: `${prefix} client ${index}`,
              customerPhone: phones[index],
              fromAddress: 'Ouakam, Dakar',
              toAddress: 'Almadies, Dakar',
              date,
              timeSlot,
              notes: 'Test de charge isolé',
              requestId: requestIds[index],
            })
            .timeout({ response: 120_000 });
          latencies[index] = performance.now() - started;
          if (typeof response.body.id === 'string') bookingIds[index] = response.body.id;
          return response;
        }),
      );
      responses.push(...batch);
    }

    const elapsedMs = performance.now() - startedAt;
    console.error = originalConsoleError;
    const statusCounts = responses.reduce<Record<string, number>>((counts, response) => {
      const status = String(response.status);
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    latencies.sort((left, right) => left - right);
    const successful = responses.filter((response) => response.status === 201).length;
    console.error = originalConsoleError;
    console.log(`Requêtes envoyées : ${responses.length}`);
    console.log(`Réponses HTTP : ${JSON.stringify(statusCounts)}`);
    console.log(`Pic simultané demandé : ${clientCount}`);
    console.log(`Pool PostgreSQL : ${poolMax}`);
    console.log(`Lot maximal simultané : ${batchLimit}`);
    console.log(`Erreurs internes : ${JSON.stringify(Object.fromEntries(errors))}`);
    const failures = responses.filter((response) => response.status >= 500).slice(0, 5);
    console.log(`Exemples d'erreurs HTTP : ${JSON.stringify(failures.map(({ status, body }) => ({ status, body })))}`);
    console.log(
      `Débit API + PostgreSQL : ${(clientCount / (elapsedMs / 1000)).toFixed(1)} réservations/s`,
    );
    console.log(
      `Latence p50 / p95 / p99 : ${[50, 95, 99]
        .map((percentile) =>
          latencies[Math.floor(((latencies.length - 1) * percentile) / 100)].toFixed(0),
        )
        .join(' / ')} ms`,
    );

    assert.equal(successful, clientCount, 'Chaque client simulé doit créer sa réservation.');
    const persisted = await db.reservation.count({ where: { utilisateurId: { in: ids } } });
    assert.equal(persisted, clientCount, 'Les 1 000 réservations doivent être persistées.');
  } catch (error) {
    scenarioError = error;
  }

  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }

  const failures = [scenarioError, cleanupError].filter((error) => error !== undefined);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Le test ou son nettoyage a échoué.');
}

try {
  await run();
} finally {
  globalThis.fetch = originalFetch;
  await db.$disconnect();
}
