import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assemblyUnitPrice,
  calculatePrice,
  labourUnitPrice,
  tierOf,
} from '../src/domain/pricing.js';
import { vehicleCapacity } from '../src/domain/vehicle-capacity.js';
import { validateDate, transition } from '../src/domain/booking.js';
import { AuthService, normalizePhone } from '../src/application/services/auth.js';
import { registerSchema } from '../src/adapters/in/http/validation/auth.js';
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
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 15000,
  businessPhone: '+221775105104',
  whatsappPhone: '+221775105104',
  businessName: 'Demenag Express',
  businessAddress: 'Dakar, Sénégal',
  invoiceFooter: 'Merci.',
  tiktokUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  invoiceLogo: null,
  invoiceStamp: null,
  invoiceSignature: null,
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
test('Une distance corrigée à zéro conserve la première tranche du modèle', () => {
  assert.equal(tierOf(0, settings.distanceBounds), 0);
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
test('Chaque ligne du devis conserve la quantité exacte de sa prestation', () => {
  const price = calculatePrice(
    vehicle,
    settings,
    20,
    { ...none, labour: 2, desk: 1, wardrobe: 1 },
    3,
  );
  assert.deepEqual(
    price.lines.map(({ label, quantity }) => ({ label, quantity })),
    [
      { label: 'Transport Sprinter · 15 – 25 km (aller-retour)', quantity: 3 },
      { label: 'Manœuvre', quantity: 2 },
      { label: 'Menuisier · bureau', quantity: 1 },
      { label: 'Menuisier · armoire', quantity: 1 },
    ],
  );
});
test('Le prix personnalisé ne remplace pas la tranche normale après modification du trajet', () => {
  const price = calculatePrice(vehicle, settings, 20, none, 2, 90000);
  assert.equal(price.lines[0].unitPrice, vehicle.prices[1]);
  assert.equal(price.lines[0].label, 'Transport Sprinter · 15 – 25 km (aller-retour)');
  assert.equal(price.total, vehicle.prices[1] * 2);
});
test('Le tarif par manœuvre ajoute les étages sans ascenseur et le forfait ascenseur', () => {
  const access = { fromFloor: 2, toFloor: 1, fromLift: false, toLift: true };
  assert.equal(labourUnitPrice(settings, access), 7500);
  const price = calculatePrice(
    vehicle,
    settings,
    10,
    { ...none, labour: 2 },
    1,
    null,
    0,
    [],
    access,
  );
  assert.equal(price.lines[1].unitPrice, 7500);
  assert.match(price.lines[1].label, /2e étage sans ascenseur → 1er étage avec ascenseur/);
});
test('Le prix par manœuvre saisi sur le devis remplace la grille admin', () => {
  const price = calculatePrice(
    vehicle,
    settings,
    10,
    { ...none, labour: 2 },
    1,
    null,
    0,
    [],
    undefined,
    8000,
  );
  assert.equal(price.lines.find((line) => line.label === 'Manœuvre')?.unitPrice, 8000);
  assert.equal(price.total, 46000);
  assert.throws(() =>
    calculatePrice(vehicle, settings, 10, { ...none, labour: 2 }, 1, null, 0, [], undefined, -5),
  );
});
test('Les suppléments suivent la formule de la référence, indépendamment des anciennes matrices', () => {
  const labourMatrix = {
    none: Array.from({ length: 6 }, (_, from) =>
      Array.from({ length: 6 }, (_, to) => 1000 + from * 10 + to),
    ),
    from: Array.from({ length: 6 }, (_, from) =>
      Array.from({ length: 6 }, (_, to) => 2000 + from * 10 + to),
    ),
    to: Array.from({ length: 6 }, (_, from) =>
      Array.from({ length: 6 }, (_, to) => 3000 + from * 10 + to),
    ),
    both: Array.from({ length: 6 }, (_, from) =>
      Array.from({ length: 6 }, (_, to) => 4000 + from * 10 + to),
    ),
  };
  const matrixSettings = { ...settings, labourMatrix };
  const cases = [
    [{ fromFloor: 2, toFloor: 4, fromLift: false, toLift: false }, 9000],
    [{ fromFloor: 2, toFloor: 4, fromLift: true, toLift: false }, 8500],
    [{ fromFloor: 2, toFloor: 4, fromLift: false, toLift: true }, 7500],
    [{ fromFloor: 2, toFloor: 4, fromLift: true, toLift: true }, 7000],
  ] as const;
  for (const [access, expected] of cases) {
    const price = calculatePrice(
      vehicle,
      matrixSettings,
      10,
      { ...none, labour: 2 },
      1,
      null,
      0,
      [],
      access,
    );
    const labourLine = price.lines.find((line) => line.label.startsWith('Manœuvre'));
    assert.equal(labourLine?.unitPrice, expected);
    assert.equal(labourLine?.total, expected * 2);
  }
});
test('Les 144 cases de la matrice correspondent au tarif facturé selon étages et ascenseurs', () => {
  for (let fromFloor = 0; fromFloor <= 5; fromFloor += 1) {
    for (let toFloor = 0; toFloor <= 5; toFloor += 1) {
      for (const fromLift of [false, true]) {
        for (const toLift of [false, true]) {
          const access = { fromFloor, toFloor, fromLift, toLift };
          const expectedUnitPrice =
            settings.labourPrice +
            (fromFloor === 0
              ? 0
              : fromLift
                ? settings.labourLiftPrice!
                : fromFloor * settings.labourFloorPrice!) +
            (toFloor === 0
              ? 0
              : toLift
                ? settings.labourLiftPrice!
                : toFloor * settings.labourFloorPrice!);
          const price = calculatePrice(
            vehicle,
            settings,
            10,
            { ...none, labour: 3 },
            1,
            null,
            0,
            [],
            access,
          );
          const labourLine = price.lines.find((line) => line.label.startsWith('Manœuvre'));
          assert.equal(labourUnitPrice(settings, access), expectedUnitPrice);
          assert.equal(labourLine?.unitPrice, expectedUnitPrice);
          assert.equal(labourLine?.total, expectedUnitPrice * 3);
        }
      }
    }
  }
});
test('Un devis qui dépasserait la capacité des colonnes comptables est refusé avant stockage', () => {
  const highTariffs = {
    ...settings,
    labourPrice: 1_000_000,
    labourFloorPrice: 1_000_000,
    labourLiftPrice: 1_000_000,
  };
  assert.throws(
    () =>
      calculatePrice(vehicle, highTariffs, 10, { ...none, labour: 20 }, 1, null, 0, [], {
        fromFloor: 99,
        toFloor: 99,
        fromLift: false,
        toLift: false,
      }),
    /limite de stockage/u,
  );
  assert.throws(
    () => calculatePrice(vehicle, { ...settings, maxTrips: 10000 }, 50, none, 10000, 10000000),
    /limite de stockage/u,
  );
});
test('Le volume véhicule utilise les quatre dimensions et retire le volume des passages de roue', () => {
  assert.equal(vehicleCapacity('4,30 m', '1,94 m', '1,78 m', '1,35 m'), '13,9 m³');
});
test('Au-delà de 35 km, le transport non chiffré vaut zéro et les prestations restent calculées', () => {
  assert.equal(calculatePrice(vehicle, settings, 50, none).total, 0);
  const withLabour = calculatePrice(vehicle, settings, 50, { ...none, labour: 2 });
  assert.equal(withLabour.total, settings.labourPrice * 2);
  assert.equal(withLabour.lines[0]?.unitPrice, 0);
  assert.equal(
    calculatePrice(vehicle, settings, 50, { ...none, labour: 2 }, 1, 0).total,
    settings.labourPrice * 2,
  );
  assert.equal(calculatePrice(vehicle, settings, 50, none, 2, 60000).total, 120000);
});
test('Les montants et quantités invalides sont refusés', () => {
  assert.throws(() => calculatePrice(vehicle, settings, 10, none, 0));
  assert.equal(calculatePrice(vehicle, settings, 10, none, 1, null, 31000).total, 0);
  assert.throws(() => calculatePrice(vehicle, settings, 10, { ...none, labour: -1 }));
  assert.throws(() => tierOf(NaN, settings.distanceBounds));
});
test('La remise suit le calcul FCFA et pourcentage du fichier de référence', () => {
  const base = calculatePrice(vehicle, settings, 10, none);
  assert.notEqual(base.total, null);
  const subtotal = base.lines.reduce((sum, line) => sum + line.total, 0);
  const percent = calculatePrice(
    vehicle,
    settings,
    10,
    none,
    1,
    null,
    25,
    [],
    undefined,
    null,
    'pct',
    'fidélité',
  );
  assert.equal(percent.discount, Math.round(subtotal * 0.25));
  assert.equal(percent.total, subtotal - percent.discount);
  assert.equal(percent.discountLabel, 'Remise (25 %) · fidélité');
  assert.equal(
    calculatePrice(vehicle, settings, 10, none, 1, null, 150, [], undefined, null, 'pct').total,
    0,
  );
  assert.equal(calculatePrice(vehicle, settings, 10, none, 1, null, subtotal + 1).total, 0);
});
test('La matrice de menuiserie applique local, import et taille comme la référence', () => {
  const configured = {
    ...settings,
    montageP: {
      armoire: {
        local: 12000,
        import: 18000,
        u: 1000,
        sz: { '4': { local: 15000, import: 22000 } },
      },
    },
  };
  assert.equal(assemblyUnitPrice(configured, 'armoire'), 12000);
  assert.equal(assemblyUnitPrice(configured, 'armoire', 'import'), 18000);
  assert.equal(assemblyUnitPrice(configured, 'armoire', 'local', 4), 15000);
  assert.equal(assemblyUnitPrice(configured, 'armoire', 'local', 5), 16000);
});
test('Les tarifs importés reprennent le local configuré ou le forfait majoré de 50 %', () => {
  assert.equal(assemblyUnitPrice(settings, 'table-basse', 'local'), 15000);
  assert.equal(assemblyUnitPrice(settings, 'table-basse', 'import'), 22500);
  assert.equal(
    assemblyUnitPrice(
      { ...settings, montageP: { armoire: { local: 12000 } } },
      'armoire',
      'import',
    ),
    12000,
  );
  assert.equal(assemblyUnitPrice({ ...settings, montageP: { armoire: 10000 } }, 'armoire'), 10000);
  assert.equal(
    assemblyUnitPrice({ ...settings, montageP: { armoire: 10000 } }, 'armoire', 'import'),
    15000,
  );
});
test('La date passée et la date invalide sont refusées, l’heure reste libre', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  assert.throws(() => validateDate('2026-10-14', now, settings));
  assert.throws(() => validateDate('2026-02-30', now, settings));
  assert.doesNotThrow(() => validateDate('2026-10-15', now, settings));
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
test('L’inscription autorise les clients et employés préenregistrés, jamais un admin public', () => {
  const phone = '771234567';
  assert.equal(
    registerSchema.parse({ name: 'Client test', phone, password: 'Client-2026' }).role,
    'client',
  );
  assert.equal(registerSchema.safeParse({ phone, role: 'driver' }).success, false);
  assert.equal(
    registerSchema.safeParse({ name: 'Admin test', phone, password: 'Admin-2026', role: 'admin' })
      .success,
    false,
  );
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
  const admin: UserCredentials = {
    id: 'admin-1',
    name: 'Admin test',
    phone: '+221771234567',
    email: 'admin@example.com',
    role: 'admin',
    active: true,
    passwordHash: 'admin-hash',
  };
  const employee: UserCredentials = {
    id: 'employee-1',
    name: 'Employé test',
    phone: '+221781234567',
    role: 'driver',
    active: true,
    passwordHash: 'employee-hash',
  };
  const auth = new AuthService(
    {
      findByPhone: async (phone) =>
        phone === user.phone
          ? user
          : phone === admin.phone
            ? admin
            : phone === employee.phone
              ? employee
              : null,
      findByEmail: async (email) => (email === admin.email ? admin : null),
      create: async () => user,
      updatePassword: async () => {},
      updateProfile: async (id, name, phone, photo) => ({
        id,
        name,
        phone,
        role: 'client',
        active: true,
        photo: photo ?? null,
      }),
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

  const session = await auth.login('+221 77 141 12 51');
  assert.equal(session.user.id, user.id);
  const adminSession = await auth.login('admin@example.com', 'correct-password');
  assert.equal(adminSession.user.id, admin.id);
  await assert.rejects(auth.login('admin@example.com'));
  await assert.rejects(auth.login('+221771234567'));
  await assert.rejects(auth.login('+221771234567', 'wrong-password'));
  assert.equal((await auth.login('+221771234567', 'correct-password')).user.id, admin.id);
  assert.equal((await auth.login(employee.phone, 'correct-password')).user.id, employee.id);
  await assert.rejects(auth.login(employee.phone));
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
  assert.equal(calculatePrice(vehicle, configured, 31, none).total, 0);
  assert.throws(() => calculatePrice(vehicle, configured, 12, { ...none, labour: 3 }));
  assert.throws(() => calculatePrice(vehicle, configured, 12, none, 4));
});
test('La date reste dans l’horizon configuré, indépendamment des horaires disponibles', () => {
  const now = new Date('2026-10-15T10:00:00Z');
  assert.throws(() => validateDate('2026-10-18', now, { ...settings, maxAdvanceDays: 2 }));
  assert.doesNotThrow(() => validateDate('2026-10-16', now, { ...settings, maxAdvanceDays: 2 }));
});
