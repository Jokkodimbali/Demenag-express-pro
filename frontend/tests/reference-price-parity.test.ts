import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { calculatePrice } from '../../backend/src/domain/pricing/pricing.ts';
import { inventoryAssemblyLines as backendAssemblyLines } from '../../backend/src/domain/inventory/inventory-assembly.ts';
import { inventoryAssemblyLines as frontendAssemblyLines } from '../src/modules/moving/domain/inventory/inventory-assembly.ts';
import { quoteTotal } from '../src/modules/admin/quotes/application/services/quote-total.ts';
import { estimateMovingWork } from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import type { Booking, Inventory, Settings, Vehicle } from '../src/modules/shared/domain/model.ts';
import { inventoryItems } from '../src/modules/moving/domain/inventory/inventory.ts';

type ReferenceQuote = {
  vehicle: string;
  km: number;
  trips: number;
  man: number;
  inv: { fEt: number; fAsc: boolean; tEt: number; tAsc: boolean; lines: unknown[] };
  remise: number;
  remiseType?: 'fcfa' | 'pct';
  custom?: number;
};

const source = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);
const start = source.indexOf('class Component extends DCLogic {');
const end = source.indexOf('</script>', start);
assert.ok(start >= 0 && end > start, 'Le calculateur du fichier de référence doit être présent.');
const code = source.slice(start, end).replace('state = this.init();', 'state = {};');
const context = vm.createContext({ DCLogic: class {}, console, Date, Math, Set, Map, URL, Intl });
vm.runInContext(`${code}\nglobalThis.ReferenceComponent = Component;`, context, { timeout: 10000 });
const ReferenceComponent = (
  context as {
    ReferenceComponent: new () => {
      state: { data: { tarifs: Record<string, unknown>; peages: unknown[] } };
      calc: (quote: ReferenceQuote) => {
        total: number;
        lines: Array<{ qty: number; pu: number; amount: number }>;
      };
      lineKg: (line: {
        k: string;
        kg?: number;
        like?: string;
        q: number;
        s?: number;
        g?: string;
        dm?: boolean;
      }) => {
        tot: number;
        max: number;
      };
      lineVol: (line: { k: string; q: number; s?: number; g?: string; dm?: boolean }) => number;
    };
  }
).ReferenceComponent;

const settings = {
  labourPrice: 6000,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 15000,
  maxTrips: 20,
  maxOptions: 20,
  distanceBounds: [15, 25, 35],
} as Settings;
const vehicle = {
  id: 'sprinter',
  name: 'Sprinter',
  shortName: 'Sprinter',
  prices: [30000, 37000, 44000],
} as Vehicle;
const vehicles: Record<string, Vehicle> = {
  sprinter: vehicle,
  trafic: {
    ...vehicle,
    id: 'trafic',
    name: 'Trafic',
    shortName: 'Trafic',
    prices: [20000, 25000, 30000],
  },
  master: {
    ...vehicle,
    id: 'master',
    name: 'Master',
    shortName: 'Master',
    prices: [25000, 31000, 37000],
  },
};
const tariffs = {
  sprinter: vehicle.prices,
  trafic: [20000, 25000, 30000],
  master: [25000, 31000, 37000],
  manoeuvre: 6000,
  manEtage: 500,
  manAsc: 500,
  montage: 15000,
};

const quoteScenarios = [
  {
    name: 'Sprinter, juste sous 15 km',
    vehicle: 'sprinter',
    km: 14.9,
    trips: 1,
    man: 2,
    fromFloor: 0,
    fromLift: false,
    toFloor: 0,
    toLift: false,
    discount: 0,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Sprinter, seuil 15 km, deux trajets et accès avec étages',
    vehicle: 'sprinter',
    km: 15,
    trips: 2,
    man: 3,
    fromFloor: 3,
    fromLift: false,
    toFloor: 1,
    toLift: true,
    discount: 5000,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Sprinter, seuil 25 km, remise en pourcentage',
    vehicle: 'sprinter',
    km: 25,
    trips: 3,
    man: 1,
    fromFloor: 2,
    fromLift: true,
    toFloor: 4,
    toLift: false,
    discount: 10,
    discountType: 'pct' as const,
  },
  {
    name: 'Sprinter, juste au-dessus de 25 km sans manœuvre',
    vehicle: 'sprinter',
    km: 25.1,
    trips: 1,
    man: 0,
    fromFloor: 0,
    fromLift: false,
    toFloor: 0,
    toLift: false,
    discount: 0,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Sprinter, seuil 35 km avec ascenseur',
    vehicle: 'sprinter',
    km: 35,
    trips: 1,
    man: 2,
    fromFloor: 2,
    fromLift: true,
    toFloor: 2,
    toLift: true,
    discount: 0,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Sprinter, au-dessus de 35 km avec prix personnalisé',
    vehicle: 'sprinter',
    km: 35.1,
    trips: 2,
    man: 1,
    fromFloor: 0,
    fromLift: false,
    toFloor: 0,
    toLift: false,
    discount: 0,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Trafic, quatre manœuvres et remise fixe',
    vehicle: 'trafic',
    km: 8,
    trips: 1,
    man: 4,
    fromFloor: 0,
    fromLift: false,
    toFloor: 2,
    toLift: false,
    discount: 7000,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Master, trois trajets, accès difficiles et remise en pourcentage',
    vehicle: 'master',
    km: 21,
    trips: 3,
    man: 2,
    fromFloor: 5,
    fromLift: false,
    toFloor: 3,
    toLift: true,
    discount: 15,
    discountType: 'pct' as const,
  },
  {
    name: 'Trafic, seuil 25 km, deux trajets sans manœuvre',
    vehicle: 'trafic',
    km: 25,
    trips: 2,
    man: 0,
    fromFloor: 0,
    fromLift: false,
    toFloor: 0,
    toLift: false,
    discount: 12000,
    discountType: 'fcfa' as const,
  },
  {
    name: 'Master, plus de 35 km, prix personnalisé et trois manœuvres',
    vehicle: 'master',
    km: 42,
    trips: 1,
    man: 3,
    fromFloor: 1,
    fromLift: false,
    toFloor: 2,
    toLift: false,
    discount: 5,
    discountType: 'pct' as const,
  },
] as const;

for (const [index, scenario] of quoteScenarios.entries()) {
  test(`devis ${index + 1}/10 : ${scenario.name}`, () => {
    const selectedVehicle = vehicles[scenario.vehicle];
    const reference = new ReferenceComponent();
    reference.state = { data: { tarifs: tariffs, peages: [] } };
    const ref = reference.calc({
      vehicle: scenario.vehicle,
      km: scenario.km,
      trips: scenario.trips,
      man: scenario.man,
      inv: {
        fEt: scenario.fromFloor,
        fAsc: scenario.fromLift,
        tEt: scenario.toFloor,
        tAsc: scenario.toLift,
        lines: [],
      },
      remise: scenario.discount,
      remiseType: scenario.discountType,
      custom: 50000,
    });
    const workAccess = {
      fromFloor: scenario.fromFloor,
      fromLift: scenario.fromLift,
      toFloor: scenario.toFloor,
      toLift: scenario.toLift,
    };
    const options = { labour: scenario.man, desk: 0, wardrobe: 0, bed: 0 };
    const backend = calculatePrice(
      selectedVehicle,
      settings,
      scenario.km,
      options,
      scenario.trips,
      50000,
      scenario.discount,
      [],
      workAccess,
      null,
      scenario.discountType,
    );
    const previewBooking = {
      estimate: { tier: backend.tier },
      vehicle: selectedVehicle,
      workAccess,
    } as Booking;
    const preview = quoteTotal(
      previewBooking,
      settings,
      {
        trips: scenario.trips,
        customPrice: 50000,
        discount: scenario.discount,
        discountType: scenario.discountType,
        options,
      },
      [],
    );
    assert.equal(backend.total, ref.total, 'total du backend');
    assert.equal(preview, ref.total, 'total de l’aperçu affiché sur le site');
    const appLines = backend.lines.map(({ quantity, unitPrice, total }) => [
      quantity,
      unitPrice,
      total,
    ]);
    const referenceLines = ref.lines.map(({ qty, pu, amount }) => [qty, pu, amount]);
    assert.equal(
      JSON.stringify(appLines),
      JSON.stringify(referenceLines),
      `lignes différentes : site=${JSON.stringify(appLines)}, référence=${JSON.stringify(referenceLines)}`,
    );
  });
}

test('objet personnalisé : le prix interne ne modifie pas le prix client', () => {
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [] } };
  const ref = reference.calc({
    vehicle: 'sprinter',
    km: 10,
    trips: 1,
    man: 0,
    remise: 0,
    inv: {
      fEt: 0,
      fAsc: false,
      tEt: 0,
      tAsc: false,
      lines: [
        {
          k: 'custom',
          n: 'Meuble rare',
          name: 'Meuble rare',
          q: 2,
          dm: true,
          o: 'import',
          mp: 9000,
        },
      ],
    },
  });
  const inventory = {
    entries: {},
    variants: [],
    custom: [
      {
        id: 'rare',
        label: 'Meuble rare',
        quantity: 2,
        dismantle: true,
        origin: 'import',
        mp: 9000,
        menuPriceImport: 9000,
      },
    ],
  } as unknown as Inventory;
  const frontend = frontendAssemblyLines(inventory, settings);
  const backend = backendAssemblyLines(inventory, settings);
  assert.equal(ref.lines[1].pu, 22500);
  assert.equal(frontend[0].unitPrice, ref.lines[1].pu);
  assert.deepEqual(backend, frontend);
  assert.equal(ref.total, 75000);
});

test('un tarif de menuiserie configuré à zéro reste nul comme dans la référence', () => {
  const reference = new ReferenceComponent();
  reference.state = {
    data: {
      tarifs: { ...tariffs, montageP: { armoire: 0 } },
      peages: [],
    },
  };
  const ref = reference.calc({
    vehicle: 'sprinter',
    km: 10,
    trips: 1,
    man: 0,
    remise: 0,
    inv: {
      fEt: 0,
      fAsc: false,
      tEt: 0,
      tAsc: false,
      lines: [{ k: 'armoire', q: 1, s: 3, g: 'm', dm: true }],
    },
  });
  const inventory = blankInventory();
  inventory.entries.armoire = {
    quantity: 1,
    size: 3,
    format: 'medium',
    dismantle: true,
  };
  const zeroPriceSettings = { ...settings, montageP: { armoire: 0 } };
  const frontend = frontendAssemblyLines(inventory, zeroPriceSettings);
  const backend = backendAssemblyLines(inventory, zeroPriceSettings);

  assert.equal(ref.lines[1]?.pu, 0);
  assert.equal(frontend[0]?.unitPrice, 0);
  assert.equal(backend[0]?.unitPrice, 0);
});

test('un poids personnalisé saisi correspond au calcul de poids de la référence', () => {
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [] } };
  const expected = reference.lineKg({ k: 'custom', kg: 70, like: 'salon', q: 1 });
  const inventory = blankInventory();
  inventory.custom = [
    {
      id: 'custom-sofa',
      label: 'Canapé ancien',
      quantity: 1,
      format: 'large',
      like: 'salon',
      kg: 70,
    },
  ];
  const estimate = estimateMovingWork(
    inventory,
    {
      id: 'sprinter',
      name: 'Sprinter',
      volume: '14 m³',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
      image: '',
      interior: '',
      prices: [30000, 37000, 44000],
    },
    null,
    { trips: 1 },
  );

  assert.equal(estimate.totalWeightKg, expected.tot);
  assert.equal(estimate.maxItemWeightKg, expected.max);
});

test('volumes et poids de chaque meuble standard correspondent aux formules de référence', async (t) => {
  const aliases: Record<string, string> = {
    'table-basse': 'tbasse',
    'meuble-tv': 'meubletv',
    television: 'tv',
    'table-manger': 'tablem',
    bibliotheque: 'biblio',
    congelateur: 'congel',
    'machine-laver': 'mal',
    'micro-ondes': 'micro',
    climatiseur: 'clim',
    ventilateur: 'ventilo',
  };
  const formats = [
    { app: 'small' as const, ref: 'p' },
    { app: 'medium' as const, ref: 'm' },
    { app: 'large' as const, ref: 'g' },
  ];
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [] } };
  const vehicle = {
    id: 'sprinter',
    name: 'Sprinter',
    volume: '14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
    image: '',
    interior: '',
    prices: [30000, 37000, 44000],
  };
  for (const item of inventoryItems) {
    for (const format of item.hasFormat ? formats : [formats[1]!]) {
      for (const dismantle of [false, true]) {
        const key = aliases[item.key] ?? item.key;
        const size = item.defaultSize ?? 1;
        const line = { k: key, q: 2, s: size, g: format.ref, dm: dismantle };
        const expectedVolume = reference.lineVol(line);
        const expectedWeight = reference.lineKg(line);
        const inventory = blankInventory();
        inventory.entries[item.key] = {
          quantity: 2,
          size,
          format: format.app,
          dismantle,
        };
        const actual = estimateMovingWork(inventory, vehicle, null, { trips: 1 });
        await t.test(`${item.key} / ${format.app} / démonté=${dismantle}`, () => {
          assert.equal(actual.volume, expectedVolume);
          assert.equal(actual.totalWeightKg, expectedWeight.tot * 2);
          assert.equal(actual.maxItemWeightKg, expectedWeight.max);
        });
      }
    }
  }
});
