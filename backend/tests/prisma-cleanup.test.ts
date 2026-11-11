import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaRoutes } from '../src/adapters/out/prisma/routes.js';
import { PrismaSessions } from '../src/adapters/out/prisma/sessions.js';
import { PrismaBookings } from '../src/adapters/out/prisma/bookings.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { RouteTicket } from '../src/domain/shared/model.js';

test('les créations concurrentes de session partagent le nettoyage des expirations', async () => {
  let cleanupCount = 0;
  let createdSessions = 0;
  const db = {
    sessionConnexion: {
      deleteMany: async () => {
        cleanupCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
      create: async () => {
        createdSessions++;
      },
    },
  } as unknown as PrismaClient;
  const sessions = new PrismaSessions(db);

  await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      sessions.create(`token-${index}`, 'user-id', new Date(Date.now() + 60_000)),
    ),
  );

  assert.equal(cleanupCount, 1);
  assert.equal(createdSessions, 100);
});

test('les enregistrements concurrents d’itinéraire partagent le nettoyage des expirations', async () => {
  let cleanupCount = 0;
  let createdRoutes = 0;
  const db = {
    itineraire: {
      deleteMany: async () => {
        cleanupCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
      create: async () => {
        createdRoutes++;
      },
    },
  } as unknown as PrismaClient;
  const routes = new PrismaRoutes(db);

  await Promise.all(
    Array.from({ length: 100 }, (_, index) => {
      const route: RouteTicket = {
        id: `route-${index}`,
        from: [14.69, -17.44],
        to: [14.73, -17.48],
        distanceKm: 20,
        durationMinutes: 35,
        geometry: [
          [14.69, -17.44],
          [14.73, -17.48],
        ],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      return routes.save(route);
    }),
  );

  assert.equal(cleanupCount, 1);
  assert.equal(createdRoutes, 100);
});

test('la mise à jour d’une réservation synchronise les colonnes indexées avec son instantané', async () => {
  let persisted: Record<string, unknown> | undefined;
  const db = {
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) =>
      work({
        reservation: {
          findUnique: async () => ({ donnees: null }),
          updateMany: async ({ data }: { data: Record<string, unknown> }) => {
            persisted = data;
            return { count: 1 };
          },
        },
        devis: { upsert: async () => undefined },
      }),
  } as unknown as PrismaClient;
  const repository = new PrismaBookings(db);
  const booking = {
    id: 'booking-id',
    userId: 'user-id',
    reference: 'DEM-UPDATED',
    vehicle: { id: 'vehicle-updated' },
    date: '2026-11-15',
    timeSlot: '09:00',
    status: 'confirmed',
    driverId: null,
    quotes: [],
    version: 4,
  } as unknown as Parameters<PrismaBookings['update']>[0];

  await repository.update(booking, 4);

  assert.equal(persisted?.reference, 'DEM-UPDATED');
  assert.equal(persisted?.vehiculeId, 'vehicle-updated');
  assert.equal((persisted?.date as Date).toISOString(), '2026-11-15T00:00:00.000Z');
  assert.equal(persisted?.creneau, '09:00');
  assert.equal(persisted?.statut, 'confirmee');
});
