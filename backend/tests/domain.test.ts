import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, tierOf } from '../src/domain/pricing.js';
import { validateDate, transition } from '../src/domain/booking.js';
import { AuthService, normalizePhone } from '../src/application/services/auth.js';
import { ScryptPasswords } from '../src/adapters/out/security/crypto.js';
import type { Settings, UserCredentials, Vehicle } from '../src/domain/model.js';
const vehicle: Vehicle = {
  id: 'sprinter',
  name: 'Sprinter',
  volume: '14 m³',
  length: '4m',
  height: '2m',
  width: '2m',
  wheelWidth: '1m',
  image: '',
  interior: '',
  prices: [30000, 37000, 44000],
};
const settings: Settings = {
  labourPrice: 6000,
  assemblyPrice: 15000,
  businessPhone: '+221775105104',
  whatsappPhone: '+221775105104',
  businessName: 'Demenag Express',
  businessAddress: 'Dakar, Sénégal',
  invoiceFooter: 'Merci.',
  invoiceLogo: null,
  bookingsEnabled: true,
  maxAdvanceDays: 366,
  minNoticeHours: 0,
  maxOptions: 20,
  maxTrips: 20,
  clientCancellation: true,
  cancellationNoticeHours: 0,
  distanceBounds: [15, 25, 35],
  enabledSlots: [
    { label: 'Matin (8h – 12h)', startHour: 8 },
    { label: 'Après-midi (13h – 17h)', startHour: 13 },
    { label: 'Soir (17h – 20h)', startHour: 17 },
  ],
};
const none = { labour: 0, desk: 0, wardrobe: 0, bed: 0 };
test('Les limites tarifaires respectent les tranches annoncées', () => {
  assert.deepEqual(
    [14.9, 15, 25, 25.1, 35, 35.1].map((distance) => tierOf(distance, settings.distanceBounds)),
    [0, 1, 1, 2, 2, 3],
  );
});
test('Le transport, les options et la remise sont calculés en FCFA entiers', () => {
  const price = calculatePrice(
    vehicle,
    settings,
    20,
    { ...none, labour: 2, bed: 1 },
    3,
    null,
    5000,
  );
  assert.equal(price.total, 133000);
  assert.equal(price.lines.length, 3);
});
test('Un trajet de plus de 35 km reste sur devis, jamais à zéro', () => {
  assert.equal(calculatePrice(vehicle, settings, 50, none).total, null);
  assert.equal(calculatePrice(vehicle, settings, 50, none, 2, 60000).total, 120000);
});
test('Les montants et quantités invalides sont refusés', () => {
  assert.throws(() => calculatePrice(vehicle, settings, 10, none, 0));
  assert.throws(() => calculatePrice(vehicle, settings, 10, none, 1, null, 31000));
  assert.throws(() => calculatePrice(vehicle, settings, 10, { ...none, labour: -1 }));
  assert.throws(() => tierOf(NaN, settings.distanceBounds));
});
test('La date et le créneau passé sont refusés en heure de Dakar', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  assert.throws(() => validateDate('2026-10-14', 'Matin (8h – 12h)', now, settings));
  assert.throws(() => validateDate('2026-10-15', 'Matin (8h – 12h)', now, settings));
  assert.throws(() => validateDate('2026-02-30', 'Matin (8h – 12h)', now, settings));
  assert.doesNotThrow(() => validateDate('2026-10-15', 'Après-midi (13h – 17h)', now, settings));
});
test('Les statuts respectent le rôle et la clôture', () => {
  assert.doesNotThrow(() => transition('pending', 'confirmed', 'admin'));
  assert.doesNotThrow(() => transition('confirmed', 'in_progress', 'driver'));
  assert.doesNotThrow(() => transition('in_progress', 'completed', 'driver'));
  assert.throws(() => transition('pending', 'confirmed', 'driver'));
  assert.throws(() => transition('completed', 'confirmed', 'admin'));
  assert.throws(() => transition('in_progress', 'cancelled', 'driver'));
  assert.doesNotThrow(() => transition('pending', 'cancelled', 'client'));
});
test('Le téléphone est normalisé sans tronquer les numéros invalides', () => {
  assert.equal(normalizePhone('77 123 45 67'), '+221771234567');
  assert.equal(normalizePhone('+221 77 123 45 67'), '+221771234567');
  assert.equal(normalizePhone('00221 77 123 45 67'), '+221771234567');
  assert.throws(() => normalizePhone('1234567771234567'));
});
test('La connexion accepte les comptes historiques enregistrés sans +221', async () => {
  const user: UserCredentials = {
    id: 'user-1',
    name: 'Compte test',
    phone: '771411251',
    role: 'client',
    active: true,
    passwordHash: 'valid-hash',
  };
  const auth = new AuthService(
    {
      findByPhone: async (phone) => (phone === user.phone ? user : null),
      create: async () => user,
      updatePassword: async () => {},
      updateProfile: async () => {},
    },
    {
      create: async () => {},
      findUser: async () => null,
      delete: async () => {},
      deleteForUser: async () => {},
    },
    { hash: async () => 'new-hash', verify: async (password) => password === 'correct-password' },
    { create: () => 'test-token', digest: (token) => token },
    { now: () => new Date('2026-10-17T00:00:00Z') },
    { next: () => 'session-1' },
  );

  const session = await auth.login('+221 77 141 12 51', 'correct-password');
  assert.equal(session.user.id, user.id);
});
test('Les mots de passe sont salés et vérifiés sans stockage en clair', async () => {
  const h = new ScryptPasswords();
  const first = await h.hash('UnMotDePasseTest!');
  const second = await h.hash('UnMotDePasseTest!');
  assert.notEqual(first, second);
  assert.equal(await h.verify('UnMotDePasseTest!', first), true);
  assert.equal(await h.verify('Incorrect', first), false);
  assert.equal(await h.verify('Incorrect', ''), false);
});

test('Les bornes et limites choisies par l’administration pilotent le calcul', () => {
  const configured = {
    ...settings,
    distanceBounds: [10, 20, 30] as [number, number, number],
    maxOptions: 2,
    maxTrips: 3,
  };
  assert.equal(calculatePrice(vehicle, configured, 12, none).total, 37000);
  assert.equal(calculatePrice(vehicle, configured, 31, none).total, null);
  assert.throws(() => calculatePrice(vehicle, configured, 12, { ...none, labour: 3 }));
  assert.throws(() => calculatePrice(vehicle, configured, 12, none, 4));
});
test('Le préavis, les créneaux ouverts et l’horizon configurés sont appliqués', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  assert.throws(() =>
    validateDate('2026-10-16', 'Matin (8h – 12h)', now, { ...settings, minNoticeHours: 24 }),
  );
  assert.throws(() =>
    validateDate('2026-10-18', 'Matin (8h – 12h)', now, { ...settings, maxAdvanceDays: 2 }),
  );
  assert.throws(() =>
    validateDate('2026-10-16', 'Matin (8h – 12h)', now, {
      ...settings,
      enabledSlots: [{ label: 'Soir (17h – 20h)', startHour: 17 }],
    }),
  );
  assert.doesNotThrow(() =>
    validateDate('2026-10-16', 'Soir (17h – 20h)', now, {
      ...settings,
      minNoticeHours: 24,
      maxAdvanceDays: 2,
      enabledSlots: [{ label: 'Soir (17h – 20h)', startHour: 17 }],
    }),
  );
});
