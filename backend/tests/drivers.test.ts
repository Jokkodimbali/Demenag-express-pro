import assert from 'node:assert/strict';
import test from 'node:test';
import { DriverService } from '../src/application/services/drivers.js';
import type {
  BookingRepository,
  DriverRepository,
  UserRepository,
} from '../src/application/ports/index.js';
import type { Booking, Driver, User, UserCredentials } from '../src/domain/model.js';
import { driverSchema } from '../src/adapters/in/http/schemas.js';

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

test('Un employé peut mettre à jour sa photo de profil sans modifier ses autres informations', async () => {
  const employee: User = {
    id: 'user-1',
    name: 'Awa',
    phone: '+221770000001',
    role: 'driver',
    active: true,
  };
  const updatedUsers: User[] = [];
  const drivers: DriverRepository = {
    list: async () => [],
    find: async () => null,
    findByUserId: async () => first,
    create: async (driver) => driver,
    update: async (driver) => driver,
  };
  const users: UserRepository = {
    findByPhone: async () => null,
    findByEmail: async () => null,
    create: async () => {
      throw new Error('Non utilisé par ce test');
    },
    updatePassword: async () => {},
    updateProfile: async (id, name, phone, photo) => {
      const user = { id, name, phone, role: 'driver' as const, active: true, photo: photo ?? null };
      updatedUsers.push(user);
      return user;
    },
  };
  const service = new DriverService(
    drivers,
    users,
    {} as BookingRepository,
    { hash: async (value) => value, verify: async () => false },
    { next: () => 'unused' },
  );

  const updated = await service.updatePhoto(employee, 'data:image/jpeg;base64,photo');
  assert.equal(updated.name, first.name);
  assert.equal(updated.phone, first.phone);
  assert.equal(updated.photo, 'data:image/jpeg;base64,photo');
  assert.equal(updatedUsers[0]?.name, first.name);
  assert.equal(updatedUsers[0]?.phone, first.phone);
  assert.equal(updatedUsers[0]?.photo, 'data:image/jpeg;base64,photo');
});

test('La création d’un employé génère un mot de passe initial et ne stocke que son hash', async () => {
  let sequence = 0;
  let storedHash = '';
  const createdUsers: UserCredentials[] = [];
  const createdDrivers: Driver[] = [];
  const drivers: DriverRepository = {
    list: async () => [],
    find: async () => null,
    findByUserId: async () => null,
    create: async (driver) => {
      createdDrivers.push(driver);
      return driver;
    },
    update: async (driver) => driver,
  };
  const users: UserRepository = {
    findByPhone: async () => null,
    findByEmail: async () => null,
    create: async (user) => {
      createdUsers.push(user);
      return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        active: user.active,
        photo: user.photo,
        email: user.email,
      };
    },
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
    addTripLoadingPhotos: async () => {},
    finishTrip: async () => {},
  };
  const service = new DriverService(
    drivers,
    users,
    bookings,
    {
      hash: async (value) => {
        storedHash = `hash:${value}`;
        return storedHash;
      },
      verify: async () => false,
    },
    { next: () => `id-${++sequence}` },
  );

  const employee = await service.create(actor, {
    name: 'Awa Ndiaye',
    phone: '770000003',
    photo: null,
    vehicleId: null,
    role: 'chauffeur',
  });

  assert.equal(employee.initialPassword, 'id1G7');
  assert.equal(storedHash, `hash:${employee.initialPassword}`);
  assert.equal(createdUsers[0]?.role, 'driver');
  assert.equal(createdUsers[0]?.passwordHash, storedHash);
  assert.equal(createdDrivers[0]?.userId, createdUsers[0]?.id);
  assert.equal(createdDrivers[0]?.phone, '+221770000003');
});

test('La validation administrateur conserve la disponibilité et refuse un horaire incohérent', () => {
  const availability = Array.from({ length: 7 }, (_, index) => ({
    available: index !== 6,
    startTime: '08:00',
    endTime: '18:00',
  }));
  const input = {
    name: 'Awa',
    phone: '+221770000001',
    photo: null,
    active: true,
    vehicleId: null,
    availability,
  };

  assert.deepEqual(driverSchema.parse(input).availability, availability);
  assert.equal(
    driverSchema.safeParse({
      ...input,
      availability: availability.map((day, index) =>
        index === 0 ? { ...day, startTime: '18:00', endTime: '08:00' } : day,
      ),
    }).success,
    false,
  );
});

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
    findByEmail: async () => null,
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
    addTripLoadingPhotos: async () => {},
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

test('Un employé voit ses missions affectées, indépendamment du véhicule', async () => {
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
    findByEmail: async () => null,
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
      return [sameVehicleBooking, otherVehicleBooking];
    },
    find: async () => sameVehicleBooking,
    create: async (value) => value,
    update: async (value) => value,
    startTrip: async () => {},
    addTripLoadingPhotos: async () => {},
    finishTrip: async () => {},
  };
  const service = new DriverService(
    drivers,
    users,
    bookings,
    { hash: async (value) => value, verify: async () => false },
    { next: () => 'driver-3' },
  );

  assert.deepEqual(await service.bookings(actor), [otherVehicleBooking]);
  assert.equal(requestedVehicleId, undefined);
  await assert.rejects(
    service.addProofs(actor, sameVehicleBooking.id, 'retrait', ['photo']),
    /Mission introuvable/,
  );
  const updated = await service.addProofs(actor, otherVehicleBooking.id, 'retrait', ['photo']);
  assert.equal(updated.employeeProofs?.[0].image, 'photo');
  driver.role = 'menuisier';
  otherVehicleBooking.driverId = null;
  otherVehicleBooking.crew = { chauffeur: [], menuisier: [driver.id], manoeuvre: [], chef: '' };
  assert.deepEqual(await service.bookings(actor), [otherVehicleBooking]);
  await assert.rejects(
    service.addProofs(actor, otherVehicleBooking.id, 'depot', ['photo']),
    /réservées aux chauffeurs/,
  );
  otherVehicleBooking.status = 'cancelled';
  assert.deepEqual(await service.bookings(actor), []);
});
