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
import { estimateMovingWork } from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import { defaultMovingLaborPlanning } from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import {
  inventoryVolumes,
  inventoryWeight,
} from '../src/modules/moving/domain/estimate/moving-estimate-inventory.ts';
import { referencePlannedTrips } from '../src/modules/moving/application/services/loading-simulation-model.ts';
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
      invAnnex: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => number;
      invVolume: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => number;
      invKg: (inventory: { logement: string; annexOn?: boolean; lines: unknown[] }) => {
        tot: number;
        max: number;
      };
      estTrips: (inventory: unknown, vehicle: string) => number;
      laborEst: (quote: {
        vehicle: string;
        trips: number;
        km: number;
        date: string;
        start: string;
        inv: unknown;
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
    assert.equal(estimate.plannedTrips, referenceTrips, 'trajets appliqués dès le premier calcul');
    assert.equal(
      estimate.crew,
      referenceEstimate.n,
      'équipe automatique sans ancien effectif résiduel',
    );
    assert.equal(estimate.recommendedCrew, referenceEstimate.n, 'manœuvres recommandées');
    assert.equal(estimate.carpenterCount, referenceEstimate.m, 'menuisiers recommandés');

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
