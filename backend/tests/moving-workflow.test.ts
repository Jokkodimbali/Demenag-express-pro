import assert from 'node:assert/strict';
import test from 'node:test';
import { MovingService } from '../src/application/services/moving.js';
import type {
  BookingRepository,
  CatalogueRepository,
  DriverRepository,
} from '../src/application/ports/index.js';
import type { Booking, Catalogue, Driver, Settings, User } from '../src/domain/model.js';

const now = new Date('2026-10-22T12:00:00.000Z');
const admin: User = { id: 'admin-1', name: 'Admin', phone: '+221770000001', role: 'admin' };
const driverUser: User = {
  id: 'driver-user-1',
  name: 'Chauffeur',
  phone: '+221770000002',
  role: 'driver',
};
const client: User = { id: 'client-1', name: 'Client', phone: '+221770000003', role: 'client' };
const driver: Driver = {
  id: 'driver-1',
  userId: driverUser.id,
  name: driverUser.name,
  phone: driverUser.phone,
  photo: null,
  active: true,
  vehicleId: 'vehicle-1',
};

function harness() {
  let booking: Booking = {
    id: 'booking-1',
    reference: 'DEM-2026-BOOKING1',
    userId: client.id,
    driverId: driver.id,
    customerName: client.name,
    phone: client.phone,
    vehicle: {
      id: 'vehicle-1',
      name: 'Camion test',
      volume: '20 m³',
      length: '6 m',
      height: '3 m',
      width: '2 m',
      wheelWidth: '1 m',
      image: '',
      interior: '',
      prices: [10000, 20000, 30000],
    },
    fromAddress: 'Dakar',
    toAddress: 'Thiès',
    from: [14.7, -17.4],
    to: [14.8, -16.9],
    distanceKm: 70,
    date: '2026-10-22',
    timeSlot: '08:00',
    options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    notes: '',
    status: 'confirmed',
    estimate: { lines: [], total: 30000, discount: 0, tier: 1, trips: 1, currency: 'XOF' },
    quotes: [],
    trips: [],
    createdAt: now.toISOString(),
    version: 1,
  };
  const bookings = {
    find: async (id: string) => (id === booking.id ? booking : null),
    update: async (next: Booking, expectedVersion: number) => {
      assert.equal(booking.version, expectedVersion);
      booking = { ...next, version: expectedVersion + 1 };
      return booking;
    },
    startTrip: async (_id: string, photos: string[]) => {
      const sequence = (booking.trips?.length ?? 0) + 1;
      booking = {
        ...booking,
        trips: [
          ...(booking.trips ?? []),
          {
            id: `trip-${sequence}`,
            sequence,
            loadingPhotos: photos,
            unloadingPhotos: null,
            startedAt: now.toISOString(),
            finishedAt: null,
          },
        ],
      };
    },
    finishTrip: async (_id: string, photos: string[]) => {
      booking = {
        ...booking,
        trips: booking.trips?.map((trip) => ({
          ...trip,
          unloadingPhotos: photos,
          finishedAt: now.toISOString(),
        })),
      };
    },
  } as unknown as BookingRepository;
  const settings = {} as Settings;
  const catalogue = {
    get: async () => ({ vehicles: [], settings }) as Catalogue,
  } as unknown as CatalogueRepository;
  const drivers = {
    findByUserId: async () => driver,
    find: async () => driver,
  } as unknown as DriverRepository;
  const service = new MovingService(
    bookings,
    catalogue,
    {} as never,
    {} as never,
    drivers,
    { now: () => now },
    { next: () => 'generated-id' },
  );
  return {
    service,
    getBooking: () => booking,
    addFinalQuote: () => {
      booking = {
        ...booking,
        quotes: [
          {
            id: 'quote-1',
            reference: 'DV-2026-QUOTE1',
            kind: 'final',
            createdAt: now.toISOString(),
            price: { lines: [], total: 30000, discount: 0, tier: 1, trips: 1, currency: 'XOF' },
            notes: '',
          },
        ],
      };
    },
  };
}

test('admin can start and finish courses without photos, then close with a final quote', async () => {
  const scenario = harness();
  const { service, getBooking, addFinalQuote } = scenario;

  await service.startTrip(admin, 'booking-1', []);
  assert.equal(getBooking().status, 'in_progress');
  assert.deepEqual(getBooking().trips?.[0]?.loadingPhotos, []);

  await service.finishTrip(admin, 'booking-1', []);
  await service.finishDriverWork(admin, 'booking-1');
  assert.ok(getBooking().driverFinishedAt);
  assert.deepEqual(getBooking().trips?.[0]?.unloadingPhotos, []);

  await assert.rejects(service.status(admin, 'booking-1', 'completed', getBooking().version));
  addFinalQuote();
  const completed = await service.status(admin, 'booking-1', 'completed', getBooking().version);
  assert.equal(completed.status, 'completed');
});

test('driver still needs loading and unloading photos; client cannot manage courses', async () => {
  const { service } = harness();
  await assert.rejects(service.startTrip(driverUser, 'booking-1', []), /photo du chargement/u);
  await assert.rejects(service.finishTrip(driverUser, 'booking-1', []), /photo du déchargement/u);
  await assert.rejects(service.startTrip(client, 'booking-1', []), /réservée à l’administration/u);
});
