import assert from 'node:assert/strict';
import test from 'node:test';
import { DriverService } from '../src/application/services/drivers.js';
import type {
  BookingRepository,
  DriverRepository,
  UserRepository,
} from '../src/application/ports/index.js';
import type { Driver, User } from '../src/domain/model.js';

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
    updateProfile: async () => {},
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
