import assert from 'node:assert/strict';
import test from 'node:test';
import { MovingService } from '../src/application/services/moving.js';
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

test('a client booking keeps the inventory and the server prices every estimated trip', async () => {
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
  const service = new MovingService(
    {
      create: async (booking: Booking) => {
        saved = booking;
        return booking;
      },
    } as unknown as BookingRepository,
    { get: async () => catalogue } as CatalogueRepository,
    { find: async () => route } as unknown as RouteRepository,
    {} as never,
    {} as never,
    { now: () => now },
    { next: () => '12345678-1234-4234-8234-123456789abc' },
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
});
