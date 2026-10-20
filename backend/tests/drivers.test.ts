import assert from 'node:assert/strict';
import test from 'node:test';
import { DriverService } from '../src/application/services/drivers.js';
import type {
  BookingRepository,
  DriverRepository,
  UserRepository,
} from '../src/application/ports/index.js';
import type { Booking, Driver, User } from '../src/domain/model.js';

const actor: User = {
  id: 'admin',
  name: 'Admin',
  phone: '+221771411251',
  role: 'admin',
  active: true,
};

const first: Driver = {
  id: 'driver-1',
  userId: 'user-1',
  name: 'Awa',
  phone: '+221770000001',
  photo: null,
  active: true,
  vehicleId: 'vehicle-a',
};

const second: Driver = {
  id: 'driver-2',
  userId: 'user-2',
  name: 'Moussa',
  phone: '+221770000002',
  photo: null,
  active: true,
  vehicleId: 'vehicle-b',
};

test('Changer un chauffeur de véhicule libère automatiquement le chauffeur déjà affecté', async () => {
  const values = [first, second];
  const drivers: DriverRepository = {
    list: async () => values,
    find: async (id) => values.find((driver) => driver.id === id) ?? null,
    findByUserId: async (id) => values.find((driver) => driver.userId === id) ?? null,
    create: async (driver) => driver,
    update: async (driver) => {
      const index = values.findIndex((value) => value.id === driver.id);
      values[index] = driver;
      return driver;
    },
  };
  const users: UserRepository = {
    findByPhone: async () => null,
    create: async (user) => user,
    updatePassword: async () => {},
    updateProfile: async (id, name, phone, photo) => ({
      id,
      name,
      phone,
      role: 'driver',
      active: true,
      photo: photo ?? null,
    }),
  };
  const bookings: BookingRepository = {
    list: async () => [],
    find: async () => null,
    create: async () => {
      throw new Error('Non utilisé par ce test');
    },
    update: async () => {
      throw new Error('Non utilisé par ce test');
    },
    startTrip: async () => {},
    finishTrip: async () => {},
  };
  const service = new DriverService(
    drivers,
    users,
    bookings,
    { hash: async (value) => value, verify: async () => false },
    { next: () => 'driver-3' },
  );

  await service.update(actor, {
    id: first.id,
    name: first.name,
    phone: first.phone,
    photo: first.photo,
    active: first.active,
    vehicleId: 'vehicle-b',
  });

  assert.equal(values.find((driver) => driver.id === first.id)?.vehicleId, 'vehicle-b');
  assert.equal(values.find((driver) => driver.id === second.id)?.vehicleId, null);
});

test('Un chauffeur ne voit que les réservations du véhicule qui lui est affecté', async () => {
  const driver: Driver = { ...first, vehicleId: 'vehicle-a' };
  const actor: User = {
    id: driver.userId!,
    name: driver.name,
    phone: driver.phone,
    role: 'driver',
    active: true,
  };
  const makeBooking = (id: string, vehicleId: string, driverId: string | null): Booking => ({
    id,
    reference: id,
    userId: 'client-1',
    driverId,
    customerName: 'Client test',
    phone: '+221770000010',
    vehicle: {
      id: vehicleId,
      name: 'Camion test',
      volume: '10 m³',
      length: '4 m',
      height: '2 m',
      width: '2 m',
      wheelWidth: '1 m',
      image: '',
      interior: '',
      prices: [1000, 2000, 3000],
    },
    fromAddress: 'Dakar',
    toAddress: 'Pikine',
    from: [14.7, -17.4],
    to: [14.75, -17.39],
    distanceKm: 10,
    date: '2026-10-20',
    timeSlot: '08:00',
    options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    notes: '',
    status: 'confirmed',
    estimate: { lines: [], total: 1000, discount: 0, tier: 0, trips: 1, currency: 'XOF' },
    quotes: [],
    createdAt: '2026-10-17T00:00:00.000Z',
    version: 1,
  });
  const sameVehicleBooking = makeBooking('booking-1', 'vehicle-a', null);
  const otherVehicleBooking = makeBooking('booking-2', 'vehicle-b', driver.id);
  let requestedVehicleId: string | undefined;
  const drivers: DriverRepository = {
    list: async () => [driver],
    find: async () => driver,
    findByUserId: async () => driver,
    create: async (value) => value,
    update: async (value) => value,
  };
  const users: UserRepository = {
    findByPhone: async () => null,
    create: async (value) => value,
    updatePassword: async () => {},
    updateProfile: async (id, name, phone, photo) => ({
      id,
      name,
      phone,
      role: 'driver',
      active: true,
      photo: photo ?? null,
    }),
  };
  const bookings: BookingRepository = {
    list: async (_userId, vehicleId) => {
      requestedVehicleId = vehicleId;
      return [sameVehicleBooking, otherVehicleBooking].filter(
        (booking) => booking.vehicle.id === vehicleId,
      );
    },
    find: async () => sameVehicleBooking,
    create: async (value) => value,
    update: async (value) => value,
    startTrip: async () => {},
    finishTrip: async () => {},
  };
  const service = new DriverService(
    drivers,
    users,
    bookings,
    { hash: async (value) => value, verify: async () => false },
    { next: () => 'driver-3' },
  );

  assert.deepEqual(await service.bookings(actor), [sameVehicleBooking]);
  assert.equal(requestedVehicleId, driver.vehicleId);
});
