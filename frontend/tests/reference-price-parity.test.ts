import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { calculatePrice } from '../../backend/src/domain/pricing/pricing.ts';
import { inventoryAssemblyLines as backendAssemblyLines } from '../../backend/src/domain/inventory/inventory-assembly.ts';
import { inventoryAssemblyLines as frontendAssemblyLines } from '../src/modules/moving/domain/inventory/inventory-assembly.ts';
import { quoteTotal } from '../src/modules/admin/quotes/application/services/quote-total.ts';
import { estimateAdminQuoteWork } from '../src/modules/admin/quotes/application/services/admin-quote-estimation.ts';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config.ts';
import { createAdminQuotePreview } from '../src/modules/admin/quotes/application/services/admin-quote-preview.ts';
import { cheaperCompatibleVehicle } from '../src/modules/admin/quotes/application/services/quote-vehicle-fit.ts';
import {
  estimateMovingWork,
  defaultMovingLaborPlanning,
  movingEstimateFillRate,
  vehicleFillPercentage,
  lastTripFillRatio,
} from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import {
  inventoryVolumes,
  inventoryWeight,
} from '../src/modules/moving/domain/estimate/moving-estimate-inventory.ts';
import { referencePlannedTrips } from '../src/modules/moving/application/services/loading-simulation-model.ts';
import {
  referenceRentalKitNeeds,
  simulationInput,
} from '../src/modules/moving/application/services/loading-simulation-model.ts';
import { defaultRentalKit } from '../src/modules/moving/domain/rental-kit.ts';
import { referenceAnnexVolume } from '../src/modules/moving/domain/estimate/reference-inventory-note.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import type { Booking, Inventory, Settings, Vehicle } from '../src/modules/shared/domain/model.ts';
import type { Draft } from '../src/modules/booking/application/booking-draft.ts';
import { inventoryItems } from '../src/modules/moving/domain/inventory/inventory.ts';
import { referenceVehiclePrices } from '../../shared/reference-tariff-defaults.ts';

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
const referenceWindow: { DemSim?: unknown } = {};
vm.runInNewContext(
  readFileSync(new URL('../public/reference/loading-sim.js', import.meta.url), 'utf8'),
  { window: referenceWindow },
);
const context = vm.createContext({
  DCLogic: class {},
  console,
  Date,
  Math,
  Set,
  Map,
  URL,
  Intl,
  window: referenceWindow,
});
vm.runInContext(`${code}\nglobalThis.ReferenceComponent = Component;`, context, { timeout: 10000 });
const ReferenceComponent = (
  context as {
    ReferenceComponent: new () => {
      state: {
        data: {
          tarifs: Record<string, unknown>;
          peages: unknown[];
          labor?: { fill?: number; fillF?: number };
        };
      };
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
      invAnnex: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => number;
      invVolume: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => number;
      invKg: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => {
        tot: number;
        max: number;
      };
      invFill: (inventory: { opts?: { fragile?: boolean } }) => number;
      vcap: (vehicle: string) => number;
      simInputOf: (draft: { inv: unknown; vehicle: string }, vehicle: string) => unknown;
      estTrips: (inventory: unknown, vehicle: string) => number;
      laborEst: (quote: {
        vehicle: string;
        trips: number;
        km: number;
        date: string;
        start: string;
        inv: unknown;
        bill?: 'loc';
        locMenu?: boolean;
      }) => {
        n: number;
        N: number;
        m: number;
        hand: number;
        total: number;
        kg: number;
        maxKg: number;
      } | null;
      cheapVeh0: (quote: {
        vehicle: string;
        km: number;
        date: string;
        start: string;
        trips: number;
        inv: unknown;
      }) => { k: string; t: number; trips: number; gain: number } | null;
      menuLines: (
        quote: { inv: { lines: unknown[] } },
        tariffs: Record<string, unknown>,
      ) => Array<{ qty: number; pu: number }>;
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
const component = new ReferenceComponent();
component.state = {
  data: {
    tarifs: tariffs as unknown as Record<string, unknown>,
    peages: [],
    invCat: { add: [{ k: 'armoire', n: 'armoire' }] },
    fin: { menuPrices: {} },
  },
} as never;

test('les six logements et la déduction cartons/sacs reprennent le calcul de la référence', () => {
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [], invCat: {} } };
  const dwellingTypes = [
    ['studio', 'Studio'],
    ['f2', 'F2'],
    ['f3', 'F3'],
    ['f4', 'F4'],
    ['f5', 'F5 et plus'],
    ['villa', 'Villa'],
  ] as const;
  for (const [legacyType, siteType] of dwellingTypes) {
    const inventory = blankInventory();
    inventory.dwellingType = siteType;
    inventory.entries.carton = { quantity: 4, size: 1, format: 'medium', dismantle: false };
    inventory.entries.sac = { quantity: 2, size: 1, format: 'large', dismantle: false };
    const referenceInventory = {
      logement: legacyType,
      annexOn: true,
      lines: [
        { k: 'carton', q: 4, g: 'm', dm: false },
        { k: 'sac', q: 2, g: 'g', dm: false },
      ],
    };
    const groups = inventoryVolumes(inventory);
    const siteVolume = groups.light + groups.furniture + groups.bulky + groups.heavy;
    assert.equal(referenceAnnexVolume(inventory), reference.invAnnex(referenceInventory), siteType);
    assert.equal(siteVolume, reference.invVolume(referenceInventory), siteType);
    assert.equal(
      inventoryWeight(inventory, referenceAnnexVolume(inventory)).total,
      reference.invKg(referenceInventory).tot,
      siteType,
    );

    inventory.annexOn = false;
    referenceInventory.annexOn = false;
    assert.equal(referenceAnnexVolume(inventory), 0, `${siteType} sans annexe côté site`);
    assert.equal(reference.invAnnex(referenceInventory), 0, `${siteType} sans annexe référence`);
    assert.equal(
      inventoryWeight(inventory, referenceAnnexVolume(inventory)).total,
      reference.invKg(referenceInventory).tot,
      `${siteType} sans annexe`,
    );
  }
});

test('trajets simulés et manœuvres reprennent les fonctions de référence sur le même devis', () => {
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [], invCat: {} } };
  const inventory = blankInventory();
  inventory.dwellingType = 'F3';
  inventory.fromFloor = 3;
  inventory.toFloor = 1;
  inventory.toLift = true;
  inventory.flags = { acces: true, fragile: true, escalier: true, emballage: true };
  for (const [key, quantity, size, dismantle] of [
    ['salon', 1, 5, false],
    ['armoire', 1, 3, true],
    ['frigo', 1, 1, false],
    ['carton', 12, 1, false],
    ['lit', 1, 2, true],
    ['matelas', 1, 2, false],
  ] as const)
    inventory.entries[key] = { quantity, size, format: 'medium', dismantle };

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
  const referenceInventory = {
    logement: 'f3',
    annexOn: true,
    fEt: inventory.fromFloor,
    fAsc: inventory.fromLift,
    tEt: inventory.toFloor,
    tAsc: inventory.toLift,
    opts: { acces: true, fragile: true, escalier: true, emballage: true },
    lines: Object.entries(inventory.entries)
      .filter(([, entry]) => entry.quantity > 0)
      .map(([key, entry]) => ({
        k: aliases[key] ?? key,
        q: entry.quantity,
        s: entry.size,
        g: 'm',
        dm: entry.dismantle,
      })),
  };
  const siteVehicle = {
    ...vehicle,
    volume: '14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: referenceWindow,
    configurable: true,
    writable: true,
  });
  try {
    const siteTrips = referencePlannedTrips(inventory, siteVehicle);
    const referenceTrips = reference.estTrips(referenceInventory, 'sprinter');
    assert.equal(siteTrips, referenceTrips, 'nombre de trajets simulés');
    assert.ok(siteTrips);

    const siteEstimate = estimateMovingWork(inventory, siteVehicle, null, {
      recommendedTrips: siteTrips,
      trips: siteTrips,
    });
    const referenceEstimate = reference.laborEst({
      vehicle: 'sprinter',
      trips: siteTrips,
      km: 20,
      date: '2026-11-10',
      start: '08:00',
      inv: referenceInventory,
    });
    assert.ok(referenceEstimate);
    assert.equal(
      siteEstimate.recommendedCrew,
      referenceEstimate.n,
      'nombre de manœuvres recommandé',
    );
    assert.equal(siteEstimate.carpenterCount, referenceEstimate.m, 'nombre de menuisiers');
    assert.equal(
      Math.round(siteEstimate.handlingMinutes),
      Math.round(referenceEstimate.hand * 60),
      'durée chargement et déchargement',
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

test('le mode automatique du formulaire calcule trajet et équipe avec le plan de référence dès le premier rendu', () => {
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: tariffs, peages: [], invCat: {} } };
  const inventory = blankInventory();
  inventory.dwellingType = 'F4';
  inventory.fromFloor = 3;
  inventory.toFloor = 2;
  inventory.toLift = true;
  inventory.flags = { acces: true, fragile: true, escalier: true, emballage: true };
  inventory.entries.salon = { quantity: 4, size: 8, format: 'medium', dismantle: false };
  inventory.entries.frigo = { quantity: 4, size: 1, format: 'medium', dismantle: false };
  inventory.entries.armoire = { quantity: 2, size: 6, format: 'medium', dismantle: true };
  inventory.entries.carton = { quantity: 24, size: 1, format: 'medium', dismantle: false };
  const legacyInventory = {
    logement: 'f4',
    annexOn: true,
    fEt: inventory.fromFloor,
    fAsc: inventory.fromLift,
    tEt: inventory.toFloor,
    tAsc: inventory.toLift,
    opts: { ...inventory.flags },
    lines: [
      { k: 'salon', q: 4, s: 8, g: 'm', dm: false },
      { k: 'frigo', q: 4, s: 1, g: 'm', dm: false },
      { k: 'armoire', q: 2, s: 6, g: 'm', dm: true },
      { k: 'carton', q: 24, s: 1, g: 'm', dm: false },
    ],
  };
  const siteVehicle = {
    ...vehicle,
    volume: '13,9 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
  } as Vehicle;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: referenceWindow,
    configurable: true,
    writable: true,
  });
  try {
    const referenceTrips = reference.estTrips(legacyInventory, 'sprinter');
    assert.ok(referenceTrips > 1, 'le scénario doit exercer plusieurs allers-retours');
    const referenceFillPlan = referenceWindow.DemSim!.plan(
      reference.simInputOf({ inv: legacyInventory, vehicle: 'sprinter' }, 'sprinter'),
    );
    const appPlan = referenceWindow.DemSim!.plan(
      simulationInput(inventory, siteVehicle, 20, 204, 184),
    );
    assert.equal(
      appPlan.trips.length,
      referenceFillPlan.trips.length,
      'nombre de trajets du plan 3D',
    );
    assert.equal(
      JSON.stringify(appPlan.trips.map(({ fill, vol, left, front }) => [fill, vol, left, front])),
      JSON.stringify(
        referenceFillPlan.trips.map(({ fill, vol, left, front }) => [fill, vol, left, front]),
      ),
      'remplissage, volume et équilibrage de chaque trajet 3D identiques à la référence',
    );
    assert.equal(
      movingEstimateFillRate(inventory.flags.fragile),
      reference.invFill(legacyInventory),
      'taux utilisé pour prévoir les trajets, y compris avec objets fragiles',
    );
    assert.equal(
      movingEstimateFillRate(false),
      reference.invFill({ ...legacyInventory, opts: { ...legacyInventory.opts, fragile: false } }),
      'taux par défaut sans objet fragile comme la référence',
    );
    const referenceEstimate = reference.laborEst({
      vehicle: 'sprinter',
      trips: referenceTrips,
      km: 20,
      date: '2026-11-10',
      start: '08:00',
      inv: legacyInventory,
    });
    assert.ok(referenceEstimate);

    const quoteDraft = {
      inventory: { ...inventory, crew: 9 },
      options: { labour: 9, desk: 0, wardrobe: 0, bed: 0 },
      date: '2026-11-10',
      month: '2026-11',
      timeSlot: '08:00',
      fromAddress: '',
      toAddress: '',
      route: null,
    } as unknown as Draft;
    const estimate = estimateAdminQuoteWork({
      inventory,
      vehicle: siteVehicle,
      route: null,
      draft: quoteDraft,
      config: { ...defaultAdminQuoteConfig(), trips: 1, calcMode: 'auto' },
      settings,
      tollLines: [],
    });
    assert.ok(estimate);
    assert.equal(estimate.trips, referenceTrips, 'nombre estimé d’allers-retours');
    assert.equal(
      vehicleFillPercentage(estimate.volume, estimate.trips, estimate.capacity),
      Math.round(
        (reference.invVolume(legacyInventory) / (referenceTrips * reference.vcap('sprinter'))) *
          100,
      ),
      'pourcentage global de remplissage par véhicule comme dans le récapitulatif de référence',
    );
    assert.equal(
      Math.round(
        lastTripFillRatio(estimate.volume, estimate.trips, estimate.capacity, estimate.fillRate) *
          100,
      ),
      Math.round(
        ((reference.invVolume(legacyInventory) -
          (referenceTrips - 1) * reference.vcap('sprinter') * reference.invFill(legacyInventory)) /
          (reference.vcap('sprinter') * reference.invFill(legacyInventory))) *
          100,
      ),
      'pourcentage du dernier trajet comme dans la référence',
    );
    reference.state.data.labor = { fill: 62, fillF: 48 };
    for (const fragile of [false, true]) {
      const configuredInventory = {
        ...legacyInventory,
        opts: { ...legacyInventory.opts, fragile },
      };
      assert.equal(
        movingEstimateFillRate(fragile, { ...defaultMovingLaborPlanning, fill: 62, fillF: 48 }),
        reference.invFill(configuredInventory),
        `taux configuré à ${fragile ? 48 : 62} % comme la référence`,
      );
    }
    assert.equal(estimate.plannedTrips, referenceTrips, 'trajets appliqués dès le premier calcul');
    assert.equal(
      estimate.crew,
      referenceEstimate.n,
      'équipe automatique sans ancien effectif résiduel',
    );
    assert.equal(estimate.recommendedCrew, referenceEstimate.n, 'manœuvres recommandées');
    assert.equal(estimate.carpenterCount, referenceEstimate.m, 'menuisiers recommandés');

    const rentalReference = reference.laborEst({
      vehicle: 'sprinter',
      trips: referenceTrips,
      km: 20,
      date: '2026-11-10',
      start: '08:00',
      inv: legacyInventory,
      bill: 'loc',
    });
    assert.ok(rentalReference);
    const rentalEstimate = estimateAdminQuoteWork({
      inventory,
      vehicle: siteVehicle,
      route: null,
      draft: quoteDraft,
      config: {
        ...defaultAdminQuoteConfig(),
        trips: referenceTrips,
        calcMode: 'auto',
        billingMode: 'driver-rental',
      },
      settings,
      tollLines: [],
    });
    assert.ok(rentalEstimate);
    assert.equal(
      rentalEstimate.crew,
      rentalReference.n,
      'manœuvres fournies en location économique',
    );
    assert.equal(
      rentalEstimate.carpenterCount,
      rentalReference.m,
      'menuisiers exclus de la location',
    );
    assert.equal(rentalEstimate.trips, referenceTrips, 'les trajets économiques concordent');

    const rentalNeeds = referenceRentalKitNeeds(inventory, siteVehicle);
    const referencePlan = (
      referenceWindow.DemSim as {
        plan: (input: unknown) => {
          trips: Array<{ need: number; blankets: number; straps: number }>;
        };
      }
    ).plan(simulationInput(inventory, siteVehicle, 20, 204, 184));
    assert.ok(rentalNeeds);
    assert.deepEqual(rentalNeeds, {
      blankets: Math.max(...referencePlan.trips.map((trip) => trip.need || trip.blankets || 0)),
      straps: Math.max(...referencePlan.trips.map((trip) => trip.straps || 0)),
    });
    const equipment = defaultRentalKit(siteVehicle, rentalReference.n, undefined, rentalNeeds);
    assert.equal(
      equipment.find((item) => item.id === 'blankets')?.quantity,
      rentalNeeds.blankets || Math.max(4, rentalReference.n * 2),
      'nombre de serviettes comme le plan de référence',
    );
    assert.equal(
      equipment.find((item) => item.id === 'tie-down-straps')?.quantity,
      Math.max(4, rentalNeeds.straps || 4),
      'nombre de sangles d’attache comme le plan de référence',
    );
    assert.equal(
      equipment.find((item) => item.id === 'lifting-straps')?.quantity,
      Math.max(1, Math.ceil(rentalReference.n / 2)),
      'nombre de paires de sangles de levage comme le plan de référence',
    );
    assert.equal(
      equipment.find((item) => item.id === 'gloves')?.quantity,
      rentalReference.n,
      'nombre de paires de gants, une par manœuvre comme dans la référence',
    );

    const priceSettings = {
      ...settings,
      rentalKitConfiguration: undefined,
    } as Settings;
    const draftForRental = {
      ...quoteDraft,
      route: {
        id: 'rental-reference',
        expiresAt: '2026-11-16T00:00:00.000Z',
        from: [14.7, -17.5],
        to: [14.7, -17.2],
        distanceKm: 20,
        durationMinutes: 30,
        geometry: [],
      },
      inventory,
    } as Draft;
    const rentalPreview = createAdminQuotePreview({
      draft: draftForRental,
      estimateInventory: inventory,
      config: {
        ...defaultAdminQuoteConfig(),
        billingMode: 'driver-rental',
        menuIncluded: false,
        trips: referenceTrips,
        rentalKit: null,
      },
      vehicle: siteVehicle,
      estimate: rentalEstimate,
      settings: priceSettings,
      price: {
        lines: [],
        total: 0,
        discount: 0,
        discountLabel: '',
        discountType: 'fcfa',
        discountValue: 0,
        discountReason: '',
        tier: 0,
        trips: referenceTrips,
        currency: 'XOF',
      },
      extras: [
        ['labour', 'Manœuvres', 'Manœuvres'],
        ['desk', 'Bureau', 'Bureau'],
        ['wardrobe', 'Armoire', 'Armoire'],
        ['bed', 'Lit', 'Lit'],
      ],
      labourPrice: settings.labourPrice ?? 6000,
      simulationNeeds: rentalNeeds,
    });
    const rentalReferenceTariffs = {
      ...tariffs,
      sprinter: [...vehicle.prices],
      tripDeg: 60,
      creux: 10,
    };
    reference.state = { data: { tarifs: rentalReferenceTariffs, peages: [], invCat: {} } };
    const rentalPriceReference = reference.calc({
      vehicle: siteVehicle.id,
      km: 20,
      trips: referenceTrips,
      man: rentalReference.n,
      bill: 'loc',
      locMenu: false,
      inv: legacyInventory,
      date: '2026-11-10',
      remise: 0,
    });
    assert.equal(
      rentalPreview.total,
      rentalPriceReference.total,
      `total location économique identique aux tarifs de la référence: ${JSON.stringify({ actual: rentalPreview.previewLines, reference: rentalPriceReference.lines, trips: referenceTrips })}`,
    );
    assert.equal(
      JSON.stringify(
        rentalPreview.previewLines.map((line) => [line.quantity, line.unitPrice, line.total]),
      ),
      JSON.stringify(rentalPriceReference.lines.map((line) => [line.qty, line.pu, line.amount])),
      'lignes tarifaires de location identiques à la référence',
    );

    const manualEstimate = estimateAdminQuoteWork({
      inventory,
      vehicle: siteVehicle,
      route: null,
      draft: { ...quoteDraft, inventory: { ...inventory, crew: 4 } },
      config: { ...defaultAdminQuoteConfig(), trips: 2, calcMode: 'manual' },
      settings,
      tollLines: [],
    });
    assert.ok(manualEstimate);
    assert.equal(manualEstimate.plannedTrips, 2, 'le mode manuel conserve les trajets choisis');
    assert.equal(manualEstimate.crew, 4, 'le mode manuel conserve l’équipe choisie');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

test('pourcentages de remplissage identiques à la référence pour les options du devis et chaque véhicule', () => {
  const reference = new ReferenceComponent();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: referenceWindow,
    configurable: true,
    writable: true,
  });
  const aliases: Record<string, string> = {
    'table-basse': 'tbasse',
    'meuble-tv': 'meubletv',
    'table-manger': 'tablem',
    television: 'tv',
    bibliotheque: 'biblio',
    congelateur: 'congel',
    'machine-laver': 'mal',
    'micro-ondes': 'micro',
    climatiseur: 'clim',
    ventilateur: 'ventilo',
  };
  const formats = { small: 'p', medium: 'm', large: 'g' } as const;
  const makeInventory = (input: {
    dwellingType: string;
    annexOn: boolean;
    fragile: boolean;
    entries?: Inventory['entries'];
    variants?: Inventory['variants'];
    custom?: Inventory['custom'];
    blanketLengthCm: number;
    blanketWidthCm: number;
  }) => {
    const inventory = blankInventory();
    inventory.dwellingType = input.dwellingType;
    inventory.annexOn = input.annexOn;
    inventory.flags.fragile = input.fragile;
    inventory.entries = input.entries ?? {};
    inventory.variants = input.variants ?? [];
    inventory.custom = input.custom ?? [];
    inventory.fromFloor = 2;
    inventory.toFloor = 4;
    inventory.fromLift = true;
    inventory.toLift = false;
    inventory.ready = 'non';
    inventory.stairs = 'verif';
    inventory.blanketLengthCm = input.blanketLengthCm;
    inventory.blanketWidthCm = input.blanketWidthCm;
    return inventory;
  };
  const legacyInventory = (inventory: Inventory) => {
    const lines: Record<string, unknown>[] = [];
    const add = (
      key: string,
      item: {
        quantity: number;
        size: number;
        format?: 'small' | 'medium' | 'large';
        dismantle: boolean;
      },
    ) => {
      if (item.quantity <= 0) return;
      lines.push({
        k: aliases[key] ?? key,
        q: item.quantity,
        s: item.size,
        g: formats[item.format ?? 'medium'],
        dm: item.dismantle,
      });
    };
    Object.entries(inventory.entries).forEach(([key, item]) => add(key, item));
    inventory.variants.forEach((item) => add(item.itemKey, item));
    inventory.custom.forEach((item) => {
      if (item.quantity <= 0) return;
      lines.push({
        k: 'custom',
        q: item.quantity,
        s: 1,
        g: formats[item.format ?? 'medium'],
        dm: Boolean(item.dismantle),
        n: item.label,
        cL: item.cL,
        cW: item.cW,
        cH: item.cH,
        kg: item.kg,
        like: item.like ? (aliases[item.like] ?? item.like) : '',
        up: item.up,
        frag: item.frag,
        notop: item.notop,
      });
    });
    inventory.variants
      .filter((item) => item.origin === 'import')
      .forEach((item) => {
        const ix = lines.findIndex((line) => line.k === (aliases[item.itemKey] ?? item.itemKey));
        if (ix >= 0) lines[ix] = { ...lines[ix], k: 'custom', n: item.itemKey, like: '', kg: 0 };
      });
    inventory.custom
      .filter((item) => item.typeKey)
      .forEach((item) => {
        const ix = lines.findIndex((line) => line.n === item.label);
        if (ix >= 0) lines[ix] = { ...lines[ix], k: 'custom', like: '', kg: 0 };
      });
    return {
      logement: inventory.dwellingType.toLowerCase(),
      annexOn: inventory.annexOn,
      fEt: inventory.fromFloor,
      fAsc: inventory.fromLift,
      tEt: inventory.toFloor,
      tAsc: inventory.toLift,
      opts: { ...inventory.flags },
      ready: inventory.ready,
      stairs: inventory.stairs,
      lines,
    };
  };
  const scenarios = [
    {
      name: 'petit chargement léger sans effets annexes',
      inventory: makeInventory({
        dwellingType: 'Studio',
        annexOn: false,
        fragile: false,
        blanketLengthCm: 204,
        blanketWidthCm: 184,
        entries: {
          carton: { quantity: 26, size: 1, format: 'medium', dismantle: false },
          sac: { quantity: 6, size: 1, format: 'large', dismantle: false },
        },
      }),
      planning: { ...defaultMovingLaborPlanning },
      stock: 20,
    },
    {
      name: 'F4 fragile avec démontage et effets annexes',
      inventory: makeInventory({
        dwellingType: 'F4',
        annexOn: true,
        fragile: true,
        blanketLengthCm: 204,
        blanketWidthCm: 184,
        entries: {
          salon: { quantity: 2, size: 7, format: 'medium', dismantle: false },
          television: { quantity: 2, size: 3, format: 'large', dismantle: false },
          carton: { quantity: 35, size: 1, format: 'medium', dismantle: false },
          frigo: { quantity: 1, size: 2, format: 'medium', dismantle: false },
        },
        custom: [],
      }),
      planning: { ...defaultMovingLaborPlanning, fill: 62, fillF: 48 },
      stock: 12,
    },
    {
      name: 'villa avec variantes, charges lourdes et objet sur mesure',
      inventory: makeInventory({
        dwellingType: 'Villa',
        annexOn: true,
        fragile: false,
        blanketLengthCm: 220,
        blanketWidthCm: 190,
        entries: {
          congelateur: { quantity: 2, size: 1, format: 'large', dismantle: false },
          'table-manger': { quantity: 1, size: 8, format: 'medium', dismantle: true },
          buffet: { quantity: 1, size: 1, format: 'large', dismantle: false },
        },
        variants: [],
        custom: [
          {
            id: 'custom-dimensions',
            label: 'Objet long sur mesure',
            quantity: 1,
            format: 'large',
            dismantle: true,
            cL: 240,
            cW: 80,
            cH: 60,
            kg: 72,
            up: true,
            frag: true,
            notop: true,
          },
        ],
      }),
      planning: { ...defaultMovingLaborPlanning, fill: 78, fillF: 58 },
      stock: 30,
    },
    {
      name: 'F3 fragile avec stock faible et serviettes grand format',
      inventory: makeInventory({
        dwellingType: 'F3',
        annexOn: false,
        fragile: true,
        blanketLengthCm: 240,
        blanketWidthCm: 200,
        entries: {
          vitrine: { quantity: 1, size: 2, format: 'large', dismantle: false },
          climatiseur: { quantity: 2, size: 1, format: 'medium', dismantle: true },
          'table-basse': { quantity: 2, size: 1, format: 'medium', dismantle: false },
          carton: { quantity: 18, size: 1, format: 'small', dismantle: false },
        },
      }),
      planning: { ...defaultMovingLaborPlanning, fill: 88, fillF: 55 },
      stock: 4,
    },
    {
      name: 'inventaire vide',
      inventory: makeInventory({
        dwellingType: '',
        annexOn: false,
        fragile: false,
        blanketLengthCm: 204,
        blanketWidthCm: 184,
      }),
      planning: { ...defaultMovingLaborPlanning },
      stock: 20,
    },
  ];
  const vehicles: Vehicle[] = [
    {
      ...vehicle,
      id: 'trafic',
      name: 'Renault Trafic III',
      shortName: 'Trafic',
      length: '2,54 m',
      height: '1,39 m',
      width: '1,66 m',
      wheelWidth: '1,27 m',
    },
    {
      ...vehicle,
      id: 'sprinter',
      name: 'Mercedes Sprinter',
      shortName: 'Sprinter',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
    },
    {
      ...vehicle,
      id: 'master',
      name: 'Renault Master III',
      shortName: 'Master',
      length: '3,73 m',
      height: '1,89 m',
      width: '1,76 m',
      wheelWidth: '1,38 m',
    },
  ];
  const engine = referenceWindow.DemSim as {
    plan: (input: unknown) => {
      trips: Array<{
        fill: number;
        vol: number;
        left: number;
        front: number;
        kg: number;
        nItems: number;
      }>;
    };
  };
  try {
    for (const scenario of scenarios) {
      const legacy = legacyInventory(scenario.inventory);
      reference.state = {
        data: {
          tarifs: tariffs,
          peages: [],
          invCat: { add: [{ k: 'armoire', n: 'armoire' }] },
          simStock: scenario.stock,
          blk: {
            L: scenario.inventory.blanketLengthCm,
            W: scenario.inventory.blanketWidthCm,
          },
          labor: {
            fill: scenario.planning.fill,
            fillF: scenario.planning.fillF,
          },
        },
      };
      for (const selectedVehicle of vehicles) {
        const referencePlan = engine.plan(
          reference.simInputOf({ inv: legacy, vehicle: selectedVehicle.id }, selectedVehicle.id),
        );
        const appPlan = engine.plan(
          simulationInput(
            scenario.inventory,
            selectedVehicle,
            scenario.stock,
            scenario.inventory.blanketLengthCm!,
            scenario.inventory.blanketWidthCm!,
          ),
        );
        const label = `${scenario.name} / ${selectedVehicle.id}`;
        assert.equal(
          JSON.stringify(
            appPlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
              fill,
              vol,
              left,
              front,
              kg,
              nItems,
            ]),
          ),
          JSON.stringify(
            referencePlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
              fill,
              vol,
              left,
              front,
              kg,
              nItems,
            ]),
          ),
          `${label}: pourcentages et données de chaque voyage`,
        );
        const referenceFillRate = reference.invFill(legacy);
        const referenceVolume = reference.invVolume(legacy);
        const referenceCapacity = reference.vcap(selectedVehicle.id);
        const plannedTrips =
          referenceVolume > 0
            ? Math.max(1, Math.ceil(referenceVolume / (referenceCapacity * referenceFillRate)))
            : 0;
        const estimate = estimateMovingWork(scenario.inventory, selectedVehicle, null, {
          laborPlanning: scenario.planning,
        });
        assert.equal(estimate.fillRate, referenceFillRate, `${label}: taux de calcul des trajets`);
        assert.equal(
          estimate.trips,
          plannedTrips,
          `${label}: trajets calculés par seuil de volume`,
        );
        if (!plannedTrips || referenceVolume <= 0) {
          assert.equal(estimate.volume, 0, `${label}: aucun volume sans inventaire`);
          continue;
        }
        assert.equal(
          vehicleFillPercentage(estimate.volume, estimate.trips, estimate.capacity),
          Math.round((referenceVolume / (plannedTrips * referenceCapacity)) * 100),
          `${label}: remplissage global affiché`,
        );
        const expectedLastFill =
          plannedTrips <= 1
            ? 1
            : (referenceVolume - (plannedTrips - 1) * referenceCapacity * referenceFillRate) /
              (referenceCapacity * referenceFillRate);
        assert.equal(
          Math.round(
            lastTripFillRatio(
              estimate.volume,
              estimate.trips,
              estimate.capacity,
              estimate.fillRate,
            ) * 100,
          ),
          Math.round(expectedLastFill * 100),
          `${label}: remplissage du dernier trajet affiché`,
        );
      }
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

test('parité des pourcentages pour chaque meuble, format, taille, démontage, logement et véhicule', () => {
  const reference = new ReferenceComponent();
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
    { value: 'small', reference: 'p' },
    { value: 'medium', reference: 'm' },
    { value: 'large', reference: 'g' },
  ] as const;
  const scenarioVehicles: Vehicle[] = [
    {
      ...vehicle,
      id: 'trafic',
      name: 'Trafic',
      length: '2,54 m',
      height: '1,39 m',
      width: '1,66 m',
      wheelWidth: '1,27 m',
    },
    {
      ...vehicle,
      id: 'sprinter',
      name: 'Sprinter',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
    },
    {
      ...vehicle,
      id: 'master',
      name: 'Master',
      length: '3,73 m',
      height: '1,89 m',
      width: '1,76 m',
      wheelWidth: '1,38 m',
    },
  ];
  const dwellingTypes = [
    ['', '', false],
    ['Studio', 'studio', true],
    ['F2', 'f2', true],
    ['F3', 'f3', true],
    ['F4', 'f4', true],
    ['F5 et plus', 'f5', true],
    ['Villa', 'villa', true],
  ] as const;
  let cases = 0;

  for (const item of inventoryItems) {
    const sizes = item.sizeLabel ? Array.from({ length: 12 }, (_, index) => index + 1) : [1];
    const itemFormats = item.hasFormat ? formats : [formats[1]];
    for (const size of sizes) {
      for (const format of itemFormats) {
        for (const dismantle of [false, true]) {
          for (const fragile of [false, true]) {
            for (const [dwellingType, legacyDwelling, annexOn] of dwellingTypes) {
              const inventory = blankInventory();
              inventory.dwellingType = dwellingType;
              inventory.annexOn = annexOn;
              inventory.flags.fragile = fragile;
              inventory.entries[item.key] = { quantity: 3, size, format: format.value, dismantle };
              const legacy = {
                logement: legacyDwelling,
                annexOn,
                opts: { fragile },
                lines: [
                  {
                    k: aliases[item.key] ?? item.key,
                    q: 3,
                    s: size,
                    g: format.reference,
                    dm: dismantle,
                  },
                ],
              };
              const label = `${item.key} / taille ${size} / ${format.value} / démonté=${dismantle} / fragile=${fragile} / ${dwellingType || 'sans logement'}`;
              const referenceVolume = reference.invVolume(legacy);
              const appGroups = inventoryVolumes(inventory);
              const appVolume =
                appGroups.light + appGroups.furniture + appGroups.bulky + appGroups.heavy;
              assert.equal(appVolume, referenceVolume, `${label}: volume identique`);
              reference.state = { data: { tarifs: tariffs, peages: [], labor: {}, invCat: {} } };
              for (const selectedVehicle of scenarioVehicles) {
                const estimate = estimateMovingWork(inventory, selectedVehicle, null);
                const referenceRate = reference.invFill(legacy);
                const referenceTrips =
                  referenceVolume > 0
                    ? Math.max(
                        1,
                        Math.ceil(
                          referenceVolume / (reference.vcap(selectedVehicle.id) * referenceRate),
                        ),
                      )
                    : 0;
                assert.equal(
                  estimate.fillRate,
                  referenceRate,
                  `${label} / ${selectedVehicle.id}: taux`,
                );
                assert.equal(
                  estimate.trips,
                  referenceTrips,
                  `${label} / ${selectedVehicle.id}: trajets`,
                );
                assert.equal(
                  vehicleFillPercentage(estimate.volume, estimate.trips, estimate.capacity),
                  referenceTrips
                    ? Math.round(
                        (referenceVolume / (referenceTrips * reference.vcap(selectedVehicle.id))) *
                          100,
                      )
                    : 0,
                  `${label} / ${selectedVehicle.id}: pourcentage global`,
                );
                const expectedLast =
                  referenceTrips <= 1
                    ? 1
                    : (referenceVolume -
                        (referenceTrips - 1) * reference.vcap(selectedVehicle.id) * referenceRate) /
                      (reference.vcap(selectedVehicle.id) * referenceRate);
                assert.equal(
                  Math.round(
                    lastTripFillRatio(
                      estimate.volume,
                      estimate.trips,
                      estimate.capacity,
                      estimate.fillRate,
                    ) * 100,
                  ),
                  Math.round(expectedLast * 100),
                  `${label} / ${selectedVehicle.id}: dernier trajet`,
                );
                cases += 1;
              }
            }
          }
        }
      }
    }
  }
  assert.ok(cases > 1000, `matrice étendue exécutée (${cases} cas)`);
});

test('parité des objets importés, personnalisés et typés dans le plan de chargement', () => {
  const engine = referenceWindow.DemSim as {
    plan: (input: unknown) => {
      trips: Array<{
        fill: number;
        vol: number;
        left: number;
        front: number;
        kg: number;
        nItems: number;
      }>;
    };
  };
  const scenarioVehicles: Vehicle[] = [
    {
      ...vehicle,
      id: 'trafic',
      length: '2,54 m',
      height: '1,39 m',
      width: '1,66 m',
      wheelWidth: '1,27 m',
    },
    {
      ...vehicle,
      id: 'sprinter',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
    },
    {
      ...vehicle,
      id: 'master',
      length: '3,73 m',
      height: '1,89 m',
      width: '1,76 m',
      wheelWidth: '1,38 m',
    },
  ];
  const scenarios: Array<{
    name: string;
    inventory: Inventory;
    legacy: Record<string, unknown>;
    customTypes?: Array<Record<string, unknown>>;
  }> = [];
  const makeCustomScenario = (
    name: string,
    custom: Inventory['custom'][number],
    legacyLine: Record<string, unknown>,
    customType?: Record<string, unknown>,
  ) => {
    const inventory = blankInventory();
    inventory.dwellingType = 'F3';
    inventory.annexOn = true;
    inventory.flags.fragile = Boolean(custom.frag);
    inventory.custom = [custom];
    scenarios.push({
      name,
      inventory,
      legacy: {
        logement: 'f3',
        annexOn: true,
        opts: { fragile: Boolean(custom.frag) },
        lines: [legacyLine],
      },
      ...(customType ? { customTypes: [customType] } : {}),
    });
  };
  makeCustomScenario(
    'objet libre avec dimensions, poids et contraintes',
    {
      id: 'free',
      label: 'piano droit',
      quantity: 1,
      format: 'large',
      dismantle: true,
      cL: 150,
      cW: 55,
      cH: 125,
      kg: 180,
      up: true,
      frag: true,
      notop: true,
    },
    {
      k: 'custom',
      q: 1,
      s: 1,
      g: 'g',
      dm: true,
      n: 'piano droit',
      cL: 150,
      cW: 55,
      cH: 125,
      kg: 180,
      up: true,
      frag: true,
      notop: true,
    },
  );
  makeCustomScenario(
    'objet personnalisé assimilé à une armoire sans dimensions',
    {
      id: 'like-wardrobe',
      label: 'armoire spéciale',
      quantity: 1,
      format: 'medium',
      dismantle: false,
      like: 'armoire',
    },
    { k: 'custom', q: 1, s: 1, g: 'm', dm: false, n: 'armoire spéciale', like: 'armoire' },
  );
  makeCustomScenario(
    'objet typé assimilé à une table sans dimensions',
    {
      id: 'custom-type-table',
      typeKey: 'tableSpeciale',
      label: 'table spéciale',
      quantity: 2,
      format: 'medium',
      dismantle: false,
      like: 'table-manger',
    },
    { k: 'tableSpeciale', q: 2, s: null, g: 'm', dm: false },
    { k: 'tableSpeciale', n: 'table spéciale', like: 'tablem', dm: false },
  );
  makeCustomScenario(
    'objet typé importé avec dimensions, poids, fragile et position verticale',
    {
      id: 'custom-type-import',
      typeKey: 'sculptureImportee',
      label: 'sculpture fragile',
      quantity: 2,
      format: 'large',
      dismantle: false,
      origin: 'import',
      cL: 175,
      cW: 65,
      cH: 90,
      kg: 48,
      up: true,
      frag: true,
      notop: true,
    },
    { k: 'sculptureImportee', q: 2, s: null, g: 'g', dm: false },
    {
      k: 'sculptureImportee',
      n: 'sculpture fragile',
      L: 175,
      W: 65,
      H: 90,
      kg: 48,
      up: true,
      frag: true,
      notop: true,
      dm: false,
    },
  );
  const importedFurniture = blankInventory();
  importedFurniture.dwellingType = 'F3';
  importedFurniture.annexOn = true;
  importedFurniture.entries.frigo = {
    quantity: 1,
    size: 2,
    format: 'medium',
    dismantle: false,
    origin: 'import',
  };
  importedFurniture.variants = [
    {
      id: 'imported-desk',
      itemKey: 'bureau',
      quantity: 2,
      size: 2,
      format: 'large',
      dismantle: true,
      origin: 'import',
    },
  ];
  scenarios.push({
    name: 'meubles standard importés',
    inventory: importedFurniture,
    legacy: {
      logement: 'f3',
      annexOn: true,
      opts: {},
      lines: [
        { k: 'frigo', q: 1, s: 2, g: 'm', dm: false, o: 'import' },
        { k: 'bureau', q: 2, s: 2, g: 'g', dm: true, o: 'import' },
      ],
    },
  });

  for (const scenario of scenarios) {
    const reference = new ReferenceComponent();
    reference.state = {
      data: {
        tarifs: tariffs,
        peages: [],
        simStock: 20,
        blk: { L: 204, W: 184 },
        invCat: { add: scenario.customTypes ?? [] },
      },
    } as never;
    const referenceVolume = reference.invVolume(scenario.legacy);
    const groups = inventoryVolumes(scenario.inventory);
    const appVolume = groups.light + groups.furniture + groups.bulky + groups.heavy;
    assert.equal(appVolume, referenceVolume, `${scenario.name}: volume de devis`);
    for (const selectedVehicle of scenarioVehicles) {
      const referencePlan = engine.plan(
        reference.simInputOf(
          { inv: scenario.legacy, vehicle: selectedVehicle.id },
          selectedVehicle.id,
        ),
      );
      const appPlan = engine.plan(
        simulationInput(scenario.inventory, selectedVehicle, 20, 204, 184),
      );
      assert.deepEqual(
        appPlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
          fill,
          vol,
          left,
          front,
          kg,
          nItems,
        ]),
        referencePlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
          fill,
          vol,
          left,
          front,
          kg,
          nItems,
        ]),
        `${scenario.name} / ${selectedVehicle.id}: données de chaque chargement`,
      );
    }
  }

  const referenceKeys: Record<string, string> = {
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
  for (const [definitionIndex, definition] of inventoryItems
    .filter((item) => !['carton', 'sac'].includes(item.key))
    .entries()) {
    for (const typed of [false, true]) {
      for (const dismantle of [false, true]) {
        for (const explicitWeight of [false, true]) {
          const typeKey = `custom-like-${definition.key}`;
          const legacyLike = referenceKeys[definition.key] ?? definition.key;
          const custom: Inventory['custom'][number] = {
            id: `${typeKey}-${typed}-${dismantle}-${explicitWeight}`,
            ...(typed ? { typeKey } : {}),
            label: `${definition.label} assimilé`,
            quantity: 2,
            format: 'medium',
            dismantle,
            like: definition.key,
            ...(explicitWeight ? { kg: 64 } : {}),
          };
          const customType = {
            k: typeKey,
            n: custom.label,
            like: legacyLike,
            dm: dismantle,
            ...(explicitWeight ? { kg: 64 } : {}),
          };
          const inventory = blankInventory();
          inventory.dwellingType = 'F4';
          inventory.annexOn = true;
          inventory.flags.fragile = true;
          inventory.custom = [custom];
          const legacy = {
            logement: 'f4',
            annexOn: true,
            opts: { fragile: true },
            lines: [
              typed
                ? { k: typeKey, q: 2, s: null, g: 'm', dm: dismantle }
                : {
                    k: 'custom',
                    q: 2,
                    s: 1,
                    g: 'm',
                    dm: dismantle,
                    n: custom.label,
                    like: legacyLike,
                    ...(explicitWeight ? { kg: 64 } : {}),
                  },
            ],
          };
          const reference = new ReferenceComponent();
          reference.state = {
            data: {
              tarifs: tariffs,
              peages: [],
              simStock: 20,
              blk: { L: 204, W: 184 },
              invCat: { add: typed ? [customType] : [] },
            },
          } as never;
          const label = `${typed ? 'typé' : 'libre'} ${definition.key} / démonté=${dismantle} / poids saisi=${explicitWeight}`;
          const appGroups = inventoryVolumes(inventory);
          assert.equal(
            appGroups.light + appGroups.furniture + appGroups.bulky + appGroups.heavy,
            reference.invVolume(legacy),
            `${label}: volume total`,
          );
          assert.equal(
            inventoryWeight(inventory, reference.invAnnex(legacy)).total,
            reference.invKg(legacy).tot,
            `${label}: poids total`,
          );
          const selectedVehicle =
            scenarioVehicles[
              (definitionIndex + Number(typed) + Number(dismantle) + Number(explicitWeight)) %
                scenarioVehicles.length
            ];
          const appPlan = engine.plan(simulationInput(inventory, selectedVehicle, 20, 204, 184));
          const referencePlan = engine.plan(
            reference.simInputOf({ inv: legacy, vehicle: selectedVehicle.id }, selectedVehicle.id),
          );
          assert.deepEqual(
            appPlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
              fill,
              vol,
              left,
              front,
              kg,
              nItems,
            ]),
            referencePlan.trips.map(({ fill, vol, left, front, kg, nItems }) => [
              fill,
              vol,
              left,
              front,
              kg,
              nItems,
            ]),
            `${label} / ${selectedVehicle.id}: simulation`,
          );
        }
      }
    }
  }
});

test('le prix de chaque véhicule et la suggestion moins chère reprennent la référence au même trajet', () => {
  const quoteTariffs = {
    ...tariffs,
    trafic: [...referenceVehiclePrices.trafic],
    sprinter: [...referenceVehiclePrices.sprinter],
    master: [...referenceVehiclePrices.master],
    manoeuvre: 6500,
    tripDeg: 60,
    creux: 10,
  };
  const quoteSettings = {
    ...settings,
    labourPrice: 6500,
    distanceBounds: [15, 25, 35] as [number, number, number],
    movingLaborPlanning: {
      ...defaultMovingLaborPlanning,
      followingTripDiscountPercent: 60,
      lowDemandDiscountPercent: 10,
    },
  } as Settings;
  const fleet: Vehicle[] = [
    {
      ...vehicle,
      id: 'trafic',
      name: 'Renault Trafic III',
      shortName: 'Trafic',
      volume: '5,4 m³',
      length: '2,54 m',
      height: '1,39 m',
      width: '1,66 m',
      wheelWidth: '1,27 m',
      image: '',
      interior: '',
      prices: [...referenceVehiclePrices.trafic],
    },
    {
      ...vehicle,
      id: 'master',
      name: 'Renault Master III',
      shortName: 'Master',
      volume: '11,6 m³',
      length: '3,73 m',
      height: '1,89 m',
      width: '1,76 m',
      wheelWidth: '1,38 m',
      image: '',
      interior: '',
      prices: [...referenceVehiclePrices.master],
    },
    {
      ...vehicle,
      id: 'sprinter',
      name: 'Mercedes Sprinter',
      shortName: 'Sprinter',
      volume: '13,9 m³',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
      image: '',
      interior: '',
      prices: [...referenceVehiclePrices.sprinter],
    },
  ];
  const inventory = blankInventory();
  inventory.dwellingType = 'F3';
  inventory.annexOn = false;
  inventory.entries.carton = { quantity: 60, size: 1, format: 'medium', dismantle: false };
  const legacyInventory = {
    logement: 'f3',
    annexOn: false,
    fEt: 0,
    fAsc: false,
    tEt: 0,
    tAsc: false,
    opts: { acces: false, fragile: false, escalier: false, emballage: false },
    lines: [{ k: 'carton', q: 60, s: 1, g: 'm', dm: false }],
  };
  const route = {
    id: 'vehicle-price-parity',
    expiresAt: '2026-11-16T00:00:00.000Z',
    from: [14.7, -17.5] as [number, number],
    to: [14.7, -17.2] as [number, number],
    distanceKm: 20,
    durationMinutes: 30,
    geometry: [],
  };
  const date = '2026-11-15';
  const draft = {
    vehicleId: 'sprinter',
    customerName: '',
    customerPhone: '',
    source: '',
    fromAddress: 'Dakar',
    toAddress: 'Rufisque',
    fromNote: '',
    toNote: '',
    from: route.from,
    to: route.to,
    route,
    distanceKmOverride: null,
    date,
    noDate: false,
    month: '2026-11',
    timeSlot: '08:00',
    estimatedTrips: 1,
    options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    notes: '',
    inventory,
    questionnaireAnswers: {},
    requestId: 'vehicle-price-parity',
  } as Draft;
  const quoteConfig = defaultAdminQuoteConfig();
  const extras: [keyof Draft['options'], string, string][] = [
    ['labour', 'Manœuvres', 'Manœuvres'],
    ['desk', 'Bureau', 'Bureau'],
    ['wardrobe', 'Armoire', 'Armoire'],
    ['bed', 'Lit', 'Lit'],
  ];
  const reference = new ReferenceComponent();
  reference.state = { data: { tarifs: quoteTariffs, peages: [], invCat: {} } };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: referenceWindow,
    configurable: true,
    writable: true,
  });
  try {
    const estimates = new Map<string, ReturnType<typeof estimateAdminQuoteWork>>();
    for (const candidate of fleet) {
      const estimate = estimateAdminQuoteWork({
        inventory,
        vehicle: candidate,
        route,
        draft,
        config: quoteConfig,
        settings: quoteSettings,
        tollLines: [],
      });
      assert.ok(estimate);
      estimates.set(candidate.id, estimate);
      const referenceTrips = reference.estTrips(legacyInventory, candidate.id);
      const referenceLabour = reference.laborEst({
        vehicle: candidate.id,
        trips: referenceTrips,
        km: 20,
        date,
        start: '08:00',
        inv: legacyInventory,
      });
      assert.ok(referenceLabour);
      const referenceCalculation = reference.calc({
        vehicle: candidate.id,
        km: 20,
        trips: referenceTrips,
        man: referenceLabour.n,
        inv: legacyInventory,
        remise: 0,
      });
      const sitePreview = createAdminQuotePreview({
        draft: {
          ...draft,
          vehicleId: candidate.id,
          options: { ...draft.options, labour: estimate.crew },
        },
        estimateInventory: inventory,
        config: { ...quoteConfig, trips: estimate.plannedTrips },
        vehicle: candidate,
        estimate,
        settings: quoteSettings,
        price: null,
        extras,
        labourPrice: quoteSettings.labourPrice,
        simulationNeeds: null,
      });
      assert.equal(estimate.trips, referenceTrips, `${candidate.id}: allers-retours`);
      assert.equal(estimate.recommendedCrew, referenceLabour.n, `${candidate.id}: manœuvres`);
      assert.equal(
        sitePreview.total,
        referenceCalculation.total,
        `${candidate.id}: montant total à 20 km`,
      );
      assert.equal(
        JSON.stringify(
          sitePreview.lines.map((line) => [line.quantity, line.unitPrice, line.total]),
        ),
        JSON.stringify(referenceCalculation.lines.map((line) => [line.qty, line.pu, line.amount])),
        `${candidate.id}: détail des lignes du devis`,
      );
    }

    const mixedInventory = blankInventory();
    mixedInventory.dwellingType = 'F3';
    mixedInventory.flags.fragile = true;
    mixedInventory.entries.salon = { quantity: 1, size: 5, format: 'medium', dismantle: false };
    mixedInventory.entries.frigo = { quantity: 1, size: 1, format: 'large', dismantle: false };
    mixedInventory.entries.carton = { quantity: 30, size: 1, format: 'medium', dismantle: false };
    const mixedLegacyInventory = {
      logement: 'f3',
      annexOn: true,
      fEt: 0,
      fAsc: false,
      tEt: 0,
      tAsc: false,
      opts: { acces: false, fragile: true, escalier: false, emballage: false },
      lines: [
        { k: 'salon', q: 1, s: 5, g: 'm', dm: false },
        { k: 'frigo', q: 1, s: 1, g: 'g', dm: false },
        { k: 'carton', q: 30, s: 1, g: 'm', dm: false },
      ],
    };
    const mixedDraft = { ...draft, inventory: mixedInventory };
    for (const candidate of fleet) {
      const estimate = estimateAdminQuoteWork({
        inventory: mixedInventory,
        vehicle: candidate,
        route,
        draft: mixedDraft,
        config: quoteConfig,
        settings: quoteSettings,
        tollLines: [],
      });
      assert.ok(estimate);
      const referenceTrips = reference.estTrips(mixedLegacyInventory, candidate.id);
      const referenceLabour = reference.laborEst({
        vehicle: candidate.id,
        trips: referenceTrips,
        km: 20,
        date,
        start: '08:00',
        inv: mixedLegacyInventory,
      });
      assert.ok(referenceLabour);
      const referenceCalculation = reference.calc({
        vehicle: candidate.id,
        km: 20,
        trips: referenceTrips,
        man: referenceLabour.n,
        inv: mixedLegacyInventory,
        remise: 0,
      });
      const sitePreview = createAdminQuotePreview({
        draft: {
          ...mixedDraft,
          vehicleId: candidate.id,
          options: { ...mixedDraft.options, labour: estimate.crew },
        },
        estimateInventory: mixedInventory,
        config: { ...quoteConfig, trips: estimate.plannedTrips },
        vehicle: candidate,
        estimate,
        settings: quoteSettings,
        price: null,
        extras,
        labourPrice: quoteSettings.labourPrice,
        simulationNeeds: null,
      });
      assert.ok(Math.abs(estimate.volume - reference.invVolume(mixedLegacyInventory)) < 1e-9);
      assert.equal(estimate.totalWeightKg, reference.invKg(mixedLegacyInventory).tot);
      assert.equal(estimate.trips, referenceTrips, `${candidate.id}: trajets du devis mixte`);
      assert.equal(
        estimate.recommendedCrew,
        referenceLabour.n,
        `${candidate.id}: manœuvres du devis mixte`,
      );
      assert.equal(
        Math.round(estimate.handlingMinutes),
        Math.round(referenceLabour.hand * 60),
        `${candidate.id}: durée de manutention du devis mixte`,
      );
      assert.equal(
        sitePreview.total,
        referenceCalculation.total,
        `${candidate.id}: total du devis mixte`,
      );
      assert.equal(
        JSON.stringify(
          sitePreview.lines.map((line) => [line.quantity, line.unitPrice, line.total]),
        ),
        JSON.stringify(referenceCalculation.lines.map((line) => [line.qty, line.pu, line.amount])),
        `${candidate.id}: lignes du devis mixte`,
      );
    }

    const current = fleet.find((candidate) => candidate.id === 'master')!;
    const referenceSuggestion = reference.cheapVeh0({
      vehicle: current.id,
      km: 20,
      date,
      start: '08:00',
      trips: estimates.get(current.id)!.plannedTrips,
      inv: legacyInventory,
    });
    const siteSuggestion = cheaperCompatibleVehicle({
      manualMode: false,
      inventory,
      current,
      vehicles: fleet,
      route,
      date,
      month: '2026-11',
      fromAddress: 'Dakar',
      toAddress: 'Rufisque',
      startTime: '08:00',
      hasToll: false,
      settings: quoteSettings,
      estimate: estimates.get(current.id)!,
    });
    assert.ok(referenceSuggestion);
    assert.ok(siteSuggestion);
    assert.equal(siteSuggestion.vehicle.id, referenceSuggestion.k, 'véhicule le moins cher');
    assert.equal(siteSuggestion.trips, referenceSuggestion.trips, 'trajets du véhicule suggéré');
    assert.equal(siteSuggestion.total, referenceSuggestion.t, 'prix du véhicule suggéré');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

test('allers-retours et manœuvres concordent avec la référence pour chaque meuble standard', async (t) => {
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
  const formatKeys = { small: 'p', medium: 'm', large: 'g' } as const;
  const siteVehicle = {
    ...vehicle,
    volume: '14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: referenceWindow,
    configurable: true,
    writable: true,
  });
  try {
    const reference = new ReferenceComponent();
    reference.state = { data: { tarifs: tariffs, peages: [], invCat: {} } };
    for (const [itemIndex, item] of inventoryItems.entries()) {
      const formats = item.hasFormat
        ? (['small', 'medium', 'large'] as const)
        : (['medium'] as const);
      for (const format of formats) {
        const inventory = blankInventory();
        inventory.dwellingType = 'F3';
        inventory.fromFloor = itemIndex % 4;
        inventory.fromLift = itemIndex % 2 === 0;
        inventory.toFloor = (itemIndex + 1) % 3;
        inventory.toLift = itemIndex % 3 === 0;
        inventory.flags = {
          acces: itemIndex % 2 === 0,
          fragile: itemIndex % 3 === 0,
          escalier: itemIndex % 4 === 3,
          emballage: itemIndex % 5 === 0,
        };
        const size = item.defaultSize ?? 1;
        const dismantle = itemIndex % 2 === 0;
        inventory.entries[item.key] = { quantity: 2, size, format, dismantle };
        const legacyInventory = {
          logement: 'f3',
          annexOn: true,
          fEt: inventory.fromFloor,
          fAsc: inventory.fromLift,
          tEt: inventory.toFloor,
          tAsc: inventory.toLift,
          opts: { ...inventory.flags },
          lines: [
            {
              k: aliases[item.key] ?? item.key,
              q: 2,
              s: size,
              g: formatKeys[format],
              dm: dismantle,
            },
          ],
        };
        const recommendedTrips = referencePlannedTrips(inventory, siteVehicle) ?? undefined;
        const siteEstimate = estimateMovingWork(inventory, siteVehicle, null, {
          ...(recommendedTrips ? { recommendedTrips } : {}),
        });
        const referenceTrips = reference.estTrips(legacyInventory, 'sprinter');
        const referenceEstimate = reference.laborEst({
          vehicle: 'sprinter',
          trips: siteEstimate.trips,
          km: 20,
          date: '2026-11-10',
          start: '08:00',
          inv: legacyInventory,
        });
        assert.ok(referenceEstimate);
        await t.test(`${item.key} / ${format}`, () => {
          assert.equal(siteEstimate.trips, referenceTrips, 'nombre d’allers-retours');
          assert.equal(siteEstimate.recommendedCrew, referenceEstimate.n, 'nombre de manœuvres');
          assert.equal(siteEstimate.carpenterCount, referenceEstimate.m, 'nombre de menuisiers');
        });
      }
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

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
  const sizes: Record<string, number[]> = {
    salon: Array.from({ length: 10 }, (_, index) => index + 1),
    'table-manger': Array.from({ length: 11 }, (_, index) => index + 2),
    lit: [1, 2, 3, 4],
    matelas: [1, 2, 3, 4],
    armoire: Array.from({ length: 8 }, (_, index) => index + 1),
  };
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
        for (const size of sizes[item.key] ?? [item.defaultSize ?? 1]) {
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
          await t.test(
            `${item.key} / taille=${size} / ${format.app} / démonté=${dismantle}`,
            () => {
              assert.equal(actual.volume, expectedVolume);
              assert.equal(actual.totalWeightKg, expectedWeight.tot * 2);
              assert.equal(actual.maxItemWeightKg, expectedWeight.max);
            },
          );
        }
      }
    }
  }
});

test('les montants de démontage de chaque meuble standard reprennent les tarifs de référence', async (t) => {
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
  const sizes: Record<string, number[]> = {
    salon: Array.from({ length: 10 }, (_, index) => index + 1),
    'table-manger': Array.from({ length: 11 }, (_, index) => index + 2),
    lit: [1, 2, 3, 4],
    matelas: [1, 2, 3, 4],
    armoire: Array.from({ length: 8 }, (_, index) => index + 1),
  };
  const montageP = Object.fromEntries(
    inventoryItems.map((item, index) => {
      const key = aliases[item.key] ?? item.key;
      const maxSize = sizes[item.key]?.at(-1);
      return [
        key,
        {
          local: 3000 + index * 211,
          import: 5000 + index * 307,
          u: 150 + index,
          uI: 250 + index,
          ...(maxSize
            ? {
                sz: {
                  [maxSize]: {
                    local: 25000 + index * 101,
                    import: 40000 + index * 103,
                  },
                },
              }
            : {}),
        },
      ];
    }),
  );
  const priceCases = [
    { name: 'grille de référence par défaut', tariffs, settings },
    {
      name: 'tarifs configurés avec suppléments de taille',
      tariffs: { ...tariffs, montageP },
      settings: { ...settings, montageP } as Settings,
    },
  ];
  const reference = new ReferenceComponent();

  for (const priceCase of priceCases) {
    reference.state = { data: { tarifs: priceCase.tariffs, peages: [], invCat: {} } };
    for (const item of inventoryItems) {
      for (const size of sizes[item.key] ?? [item.defaultSize ?? 1]) {
        for (const origin of ['local', 'import'] as const) {
          const inventory = blankInventory();
          inventory.entries[item.key] = {
            quantity: 2,
            size,
            format: 'medium',
            dismantle: true,
            origin,
          };
          const key = aliases[item.key] ?? item.key;
          const expected = Array.from(
            reference.menuLines(
              {
                inv: {
                  lines: [
                    { k: key, q: 2, s: item.sizeLabel ? size : undefined, dm: true, o: origin },
                  ],
                },
              },
              priceCase.tariffs,
            ),
            ({ qty, pu }) => [qty, pu],
          );
          const actual = frontendAssemblyLines(inventory, priceCase.settings).map(
            ({ quantity, unitPrice }) => [quantity, unitPrice],
          );
          await t.test(`${priceCase.name} / ${item.key} / taille=${size} / ${origin}`, () => {
            assert.deepEqual(actual, expected);
          });
        }
      }
    }
  }
});
