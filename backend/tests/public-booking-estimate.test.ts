import assert from 'node:assert/strict';
import test from 'node:test';
import { MovingService } from '../src/application/services/moving.js';
import { PrismaBookings } from '../src/adapters/out/prisma/bookings.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type {
  Booking,
  BookingInventorySnapshot,
  BookingInput,
  Catalogue,
  RouteTicket,
  User,
} from '../src/domain/model.js';
import type {
  BookingRepository,
  CatalogueRepository,
  RouteRepository,
} from '../src/application/ports/index.js';

test('a booking keeps its inventory and admin edits preserve or clear planning steps', async () => {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const route = {
    id: 'route-1',
    from: [14.7, -17.4],
    to: [14.8, -17.3],
    distanceKm: 20,
    expiresAt: new Date(+now + 60_000).toISOString(),
  } as RouteTicket;
  const catalogue = {
    vehicles: [
      {
        id: 'sprinter',
        name: 'Mercedes Sprinter',
        volume: '14 m³',
        length: '4 m',
        height: '2 m',
        width: '2 m',
        wheelWidth: '1 m',
        image: '',
        interior: '',
        prices: [30000, 37000, 44000],
      },
    ],
    settings: {
      bookingsEnabled: true,
      maxTrips: 20,
      maxOptions: 20,
      distanceBounds: [15, 25, 35],
      labourPrice: 6000,
      assemblyPrice: 15000,
    },
  } as Catalogue;
  let saved: Booking | null = null;
  let nextId = 0;
  const service = new MovingService(
    {
      create: async (booking: Booking) => {
        saved = booking;
        return booking;
      },
      find: async () => saved,
      update: async (booking: Booking) => {
        saved = { ...booking, version: booking.version + 1 };
        return saved;
      },
    } as unknown as BookingRepository,
    { get: async () => catalogue } as CatalogueRepository,
    { find: async () => route } as unknown as RouteRepository,
    {} as never,
    {} as never,
    { now: () => now },
    { next: () => `12345678-1234-4234-8234-${String(++nextId).padStart(12, '0')}` },
  );
  const client: User = { id: 'client-1', name: 'Client', phone: '+221770000003', role: 'client' };
  const options = { labour: 0, desk: 0, wardrobe: 0, bed: 0 };
  const inventory = { itemCount: 12, totalVolumeM3: 18 } as BookingInventorySnapshot;
  const estimate = await service.estimate('sprinter', route.id, options, undefined, 2);
  assert.equal(estimate.total, 74000);
  assert.equal(estimate.trips, 2);

  const input = {
    vehicleId: 'sprinter',
    routeId: route.id,
    trips: 2,
    customerName: 'Client',
    customerPhone: client.phone,
    fromAddress: 'Dakar',
    toAddress: 'Rufisque',
    date: null,
    timeSlot: '',
    options,
    notes: '',
    requestId: 'request-1',
    inventorySnapshot: inventory,
  } satisfies BookingInput;
  await service.create(client, input);
  assert.ok(saved);
  assert.equal((saved as Booking).estimate.total, 74000);
  assert.deepEqual((saved as Booking).inventorySnapshot, inventory);
  assert.equal((saved as Booking).quotes.length, 1);
  assert.equal((saved as Booking).quotes[0]?.kind, 'provisional');
  assert.equal((saved as Booking).quotes[0]?.price.total, 74000);
  assert.equal((saved as Booking).quotes[0]?.price.trips, 2);

  const administrator: User = {
    id: 'admin-1',
    name: 'Admin',
    phone: '+221770000001',
    role: 'admin',
  };
  const step = { id: 'plan-1', time: '08:00', title: 'Chargement', detail: '', minutes: 60 };
  const created = saved as Booking;
  const planned = await service.updateAdminRequest(
    administrator,
    created.id,
    { ...input, workPlan: [step] },
    created.version,
  );
  const checked = await service.reviewWorkPlan(
    administrator,
    planned.id,
    step.id,
    'respected',
    '',
    planned.version,
  );
  const unchanged = await service.updateAdminRequest(
    administrator,
    checked.id,
    { ...input, workPlan: [step] },
    checked.version,
  );
  assert.equal(unchanged.workPlan?.[0]?.review.status, 'respected');
  const cleared = await service.updateAdminRequest(
    administrator,
    unchanged.id,
    { ...input, workPlan: [] },
    unchanged.version,
  );
  assert.deepEqual(cleared.workPlan, []);
});

test('the provisional quote and its lines are inserted with the booking', async () => {
  let createData: Record<string, unknown> | undefined;
  const db = {
    reservation: {
      upsert: async (input: { create: Record<string, unknown> }) => {
        createData = input.create;
        return { donnees: input.create.donnees };
      },
    },
  } as unknown as PrismaClient;
  const repo = new PrismaBookings(db);
  const booking = {
    id: '12345678-1234-4234-8234-000000000001',
    userId: '12345678-1234-4234-8234-000000000002',
    reference: 'DEM-2026-12345678',
    vehicle: { id: 'sprinter' },
    date: null,
    timeSlot: '',
    status: 'pending',
    quotes: [
      {
        id: '12345678-1234-4234-8234-000000000003',
        reference: 'DV-2026-12345678',
        kind: 'provisional',
        createdAt: '2026-10-26T12:00:00.000Z',
        price: {
          total: 74000,
          discount: 0,
          tier: 1,
          trips: 2,
          lines: [{ label: 'Transport', quantity: 2, unitPrice: 37000, total: 74000 }],
        },
        notes: '',
      },
    ],
  } as Booking;
  await repo.create(booking, '12345678-1234-4234-8234-000000000004');
  const quotes = (createData?.devis as { create: Array<{ lignes: { create: unknown[] } }> })
    ?.create;
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0]?.lignes.create.length, 1);
});
