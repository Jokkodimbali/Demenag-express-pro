import {
  inventoryFormatHint,
  inventoryFormats,
  inventoryItems,
  inventoryFlags,
  type Inventory,
  type InventoryFormat,
} from './inventory';
import type { BookingInventorySnapshot, MovingLaborPlanningSettings } from './model';
import type { Route, Vehicle } from './model';
import { referenceTravelMinutes } from './reference-traffic';
import { vehicleDimensionWarnings } from './vehicle-dimensions';

const itemVolumes: Record<string, number> = {
  salon: 0.6,
  'table-basse': 0.4,
  'meuble-tv': 0.6,
  television: 0.25,
  'table-manger': 0.17,
  chaise: 0.25,
  buffet: 1.5,
  bibliotheque: 1.2,
  vitrine: 1.2,
  tapis: 0.15,
  lit: 0.5,
  matelas: 0.25,
  armoire: 0.8,
  coiffeuse: 0.6,
  commode: 0.7,
  chevet: 0.2,
  bureau: 0.9,
  frigo: 1,
  congelateur: 0.9,
  cuisiniere: 0.6,
  'machine-laver': 0.5,
  'micro-ondes': 0.1,
  climatiseur: 0.4,
  ventilateur: 0.15,
  gaz: 0.08,
  carton: 0.07,
  sac: 0.1,
  velo: 0.5,
  pot: 0.15,
};
const dwellingVolumes: Record<string, number> = {
  Studio: 1.5,
  F2: 2.5,
  F3: 3.5,
  F4: 5,
  'F5 et plus': 6.5,
  Villa: 9,
};
const dismantleFactors: Record<string, number> = {
  lit: 0.6,
  armoire: 0.6,
  'table-manger': 0.6,
  bureau: 0.7,
};
const formatIndexes: Record<InventoryFormat, number> = { small: 0, medium: 1, large: 2 };
const genericFormatFactors = [0.6, 1, 1.6];
const numberFrom = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;
export const defaultMovingLaborPlanning: MovingLaborPlanningSettings = {
  maxHandlingHours: 3,
  maxDayHours: 8,
  defaultStartHour: 8,
  maxMoversPerVehicle: 6,
  cubicMetersPerHourPerMover: 2.7,
  pauseMinutes: 30,
  heat: 1,
  wbgtAdj: 0,
};

export function inventoryDismantleFactor(key: string): number {
  return key === 'climatiseur' ? 1 : (dismantleFactors[key] ?? 0.8);
}

export function estimatedInventoryItemVolume(
  key: string,
  size: number,
  dismantle: boolean,
  format: InventoryFormat = 'medium',
) {
  if (key === 'custom') return [0.3, 0.5, 0.8][formatIndexes[format]] * (dismantle ? 0.8 : 1);
  const base = itemVolumes[key] ?? 0.5;
  const definition = inventoryItems.find((item) => item.key === key);
  const volume = definition?.sizeLabel
    ? base * Math.max(1, size)
    : definition?.hasFormat
      ? (definition.volumeByFormat?.[formatIndexes[format]] ??
        base * (genericFormatFactors[formatIndexes[format]] ?? 1))
      : base;
  const nonStackable = key === 'salon' ? 1.25 : 1;
  return volume * nonStackable * (dismantle ? inventoryDismantleFactor(key) : 1);
}

const itemVolume = estimatedInventoryItemVolume;

const referenceWeights: Record<
  string,
  number | number[] | 'sofa' | 'mattress' | 'bed' | 'wardrobe' | 'table'
> = {
  salon: 'sofa',
  matelas: 'mattress',
  lit: 'bed',
  armoire: 'wardrobe',
  'table-manger': 'table',
  frigo: [30, 65, 110],
  congelateur: [35, 50, 70],
  cuisiniere: [8, 45, 60],
  'machine-laver': [55, 70, 80],
  'micro-ondes': 12,
  climatiseur: [30, 40, 55],
  ventilateur: 5,
  gaz: 15,
  velo: 15,
  pot: [8, 20, 40],
  television: [8, 15, 25],
  'table-basse': 20,
  'meuble-tv': 35,
  chaise: 6,
  buffet: [40, 60, 90],
  bibliotheque: 45,
  vitrine: 50,
  tapis: 10,
  coiffeuse: 35,
  commode: 45,
  chevet: 12,
  bureau: 40,
  carton: [12, 15, 18],
  sac: [8, 12, 18],
  custom: 25,
};

function referenceLineWeight(
  key: string,
  size: number,
  format: InventoryFormat,
  dismantle: boolean,
) {
  const raw = referenceWeights[key] ?? 25;
  const index = formatIndexes[format];
  if (raw === 'sofa') {
    const groups: Record<number, number[]> = {
      1: [1],
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 2, 1],
      7: [3, 2, 1, 1],
      8: [3, 3, 1, 1],
      9: [3, 3, 2, 1],
      10: [3, 3, 2, 2],
    };
    const pieces = groups[Math.min(10, Math.max(1, size || 5))] ?? [3, 2];
    return {
      total: pieces.reduce((sum, part) => sum + 20 + part * 12, 0),
      max: 20 + Math.max(...pieces) * 12,
    };
  }
  if (raw === 'mattress') {
    const kg = 10 + 8 * (size || 2);
    return { total: kg, max: kg };
  }
  if (raw === 'bed') {
    const kg = 30 + 10 * (size || 2);
    return { total: kg, max: dismantle ? Math.round(kg * 0.4) : kg };
  }
  if (raw === 'wardrobe') {
    const groups: Record<number, number[]> = {
      1: [1],
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 3],
      7: [3, 2, 2],
      8: [3, 3, 2],
    };
    const parts = groups[Math.min(8, Math.max(1, size || 3))] ?? [3];
    return {
      total: parts.reduce((sum, part) => sum + 30 + 25 * part, 0),
      max: dismantle ? 30 : 30 + 25 * Math.max(...parts),
    };
  }
  if (raw === 'table') {
    const kg = 25 + 3 * (size || 6);
    return { total: kg, max: dismantle ? Math.round(kg * 0.6) : kg };
  }
  const weight = Array.isArray(raw) ? raw[index] : Number(raw);
  return { total: weight, max: weight };
}

function inventoryWeight(inventory: Inventory, annexVolume: number) {
  let total = 0;
  let max = 0;
  let largestHandlingCrew = 1;
  const stairAccess =
    (inventory.fromFloor > 0 && !inventory.fromLift) ||
    (inventory.toFloor > 0 && !inventory.toLift);
  const needs = (key: string, maxKg: number, dismantle: boolean, format: InventoryFormat) => {
    const itemCount = Math.min(4, Math.max(1, Math.ceil(maxKg / 25)));
    const kind = ['frigo', 'congelateur', 'machine-laver', 'cuisiniere', 'climatiseur'].includes(
      key,
    )
      ? 'appliance'
      : ['armoire', 'buffet', 'bibliotheque', 'commode'].includes(key)
        ? 'case'
        : ['vitrine', 'coiffeuse'].includes(key)
          ? 'glass'
          : key === 'salon'
            ? 'sofa'
            : key === 'matelas'
              ? 'mattress'
              : ['lit', 'table-manger', 'bureau'].includes(key)
                ? 'table'
                : key === 'television'
                  ? 'tv'
                  : ['carton', 'sac', 'gaz'].includes(key)
                    ? 'single'
                    : key === 'tapis'
                      ? 'roll'
                      : 'other';
    let count = itemCount;
    if (kind === 'appliance' || kind === 'glass' || kind === 'sofa') count = Math.max(2, count);
    if (kind === 'case' && !dismantle) count = Math.max(2, count);
    if (kind === 'mattress') count = sizeForHandling(key, inventory) >= 2 ? 2 : 1;
    if (kind === 'table') count = dismantle ? Math.max(1, count) : Math.max(2, count);
    if (kind === 'tv') count = maxKg > 15 || format === 'large' ? 2 : 1;
    if (kind === 'single') count = 1;
    if (kind === 'roll') count = maxKg > 25 ? 2 : 1;
    if (stairAccess && maxKg > 33 && ['appliance', 'case'].includes(kind))
      count = Math.min(4, count + 1);
    largestHandlingCrew = Math.max(largestHandlingCrew, count);
  };
  const consume = (
    key: string,
    quantity: number,
    size: number,
    format: InventoryFormat,
    dismantle: boolean,
  ) => {
    if (quantity <= 0) return;
    const weight = referenceLineWeight(key, size, format, dismantle);
    total += weight.total * quantity;
    max = Math.max(max, weight.max);
    needs(key, weight.max, dismantle, format);
  };
  Object.entries(inventory.entries).forEach(([key, item]) =>
    consume(key, item.quantity, item.size, item.format ?? 'medium', item.dismantle),
  );
  inventory.variants.forEach((item) =>
    consume(item.itemKey, item.quantity, item.size, item.format ?? 'medium', item.dismantle),
  );
  inventory.custom.forEach((item) =>
    consume('custom', item.quantity, 0, item.format ?? 'medium', Boolean(item.dismantle)),
  );
  total += Math.round(annexVolume * 110);
  return { total: Math.round(total), max, largestHandlingCrew };
}

function sizeForHandling(key: string, inventory: Inventory) {
  const main = inventory.entries[key]?.size ?? 0;
  return Math.max(
    main,
    ...inventory.variants.filter((item) => item.itemKey === key).map((item) => item.size),
    0,
  );
}

function vehicleCapacity(vehicle: Vehicle): number {
  return numberFrom(vehicle.volume) || 10;
}

type VolumeGroups = {
  light: number;
  furniture: number;
  bulky: number;
  heavy: number;
  boxes: number;
};
function inventoryVolumes(inventory: Inventory): VolumeGroups {
  const groups: VolumeGroups = { light: 0, furniture: 0, bulky: 0, heavy: 0, boxes: 0 };
  const add = (
    key: string,
    size: number,
    quantity: number,
    dismantle: boolean,
    format?: InventoryFormat,
  ) => {
    const volume = itemVolume(key, size, dismantle, format) * quantity;
    if (['carton', 'sac'].includes(key)) groups.boxes += volume;
    if (
      ['carton', 'sac', 'pot', 'tapis', 'micro-ondes', 'ventilateur', 'gaz', 'chevet'].includes(key)
    )
      groups.light += volume;
    else if (['salon', 'matelas'].includes(key)) groups.bulky += volume;
    else if (
      [
        'frigo',
        'congelateur',
        'cuisiniere',
        'machine-laver',
        'buffet',
        'vitrine',
        'armoire',
      ].includes(key) &&
      !dismantle
    )
      groups.heavy += volume;
    else groups.furniture += volume;
  };
  Object.entries(inventory.entries).forEach(([key, entry]) => {
    if (entry.quantity) add(key, entry.size, entry.quantity, entry.dismantle, entry.format);
  });
  inventory.variants.forEach((variant) => {
    if (variant.quantity)
      add(variant.itemKey, variant.size, variant.quantity, variant.dismantle, variant.format);
  });
  inventory.custom.forEach((item) => {
    groups.furniture +=
      itemVolume('custom', 1, Boolean(item.dismantle), item.format ?? 'medium') * item.quantity;
  });
  const homeVolume =
    inventory.annexOn === false ? 0 : (dwellingVolumes[inventory.dwellingType] ?? 0);
  groups.light += Math.max(0, homeVolume - groups.boxes);
  return groups;
}

function formatTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, '0')}:${String(rounded % 60).padStart(
    2,
    '0',
  )}`;
}
function startMinutes(value: string, defaultHour = 8): number {
  const match = /(?:^|\D)(\d{1,2})[:h](\d{2})?/iu.exec(value);
  if (!match) return defaultHour * 60;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}
function roundFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export type PlanningStep = { time: string; title: string; detail: string; minutes: number };
export type HeatRecovery = {
  wbgt: number;
  reference: number;
  work: number;
  rest: number;
  manual: boolean;
};
const dakarMonthlyWbgt = [22, 22, 23, 23, 25, 27, 28, 28.5, 29, 28.5, 26.5, 24];

export function heatRecovery(
  date: string,
  month: string,
  classLevel: number,
  settings: MovingLaborPlanningSettings,
  heatOff = false,
  heatRest = 0,
): HeatRecovery | null {
  if (heatOff || (settings.heat === 0 && heatRest <= 0)) return null;
  const rawMonth = Number((date || month).slice(5, 7)) - 1;
  const monthIndex = rawMonth >= 0 && rawMonth < 12 ? rawMonth : new Date().getMonth();
  const wbgt = dakarMonthlyWbgt[monthIndex] + (settings.wbgtAdj ?? 0);
  const reference = classLevel >= 4 ? 25 : 26;
  const delta = Math.round((wbgt - reference) * 10) / 10;
  const workFraction = delta <= 0 ? 1 : delta <= 2 ? 0.75 : delta <= 4 ? 0.5 : 0.25;
  if (heatRest > 0) {
    const rest = Math.min(45, Math.max(5, Math.round(heatRest)));
    return { wbgt, reference, work: 60 - rest, rest, manual: true };
  }
  return {
    wbgt,
    reference,
    work: workFraction >= 1 ? 150 : Math.round(60 * workFraction),
    rest: workFraction >= 1 ? 15 : Math.round(60 * (1 - workFraction)),
    manual: false,
  };
}
export type MovingEstimate = {
  vehicleName: string;
  volume: number;
  trips: number;
  plannedTrips: number;
  capacity: number;
  fillRate: number;
  crew: number;
  recommendedCrew: number;
  carpenterCount: number;
  dismantleFromMinutes: number;
  dismantleToMinutes: number;
  loadingMinutes: number;
  unloadingMinutes: number;
  handlingMinutes: number;
  packingMinutes: number;
  travelMinutes: number;
  travelLegMinutes: number;
  totalMinutes: number;
  rawTotalMinutes: number;
  lowDurationMinutes: number;
  highDurationMinutes: number;
  minimumDays: number;
  startTime: string;
  endTime: string;
  endLate: boolean;
  planning: PlanningStep[];
  heat: HeatRecovery | null;
  warnings: string[];
  vehicleWarnings: string[];
  warning: string | null;
};
type EstimateOptions = {
  trips?: number;
  crew?: number;
  startTime?: string;
  laborPlanning?: MovingLaborPlanningSettings;
  ignoreTraffic?: boolean;
  manualLegMinutes?: number;
  date?: string;
  month?: string;
  heatOff?: boolean;
  heatRest?: number;
  parallelVehicles?: 1 | 2;
  fromAddress?: string;
  toAddress?: string;
  hasToll?: boolean;
};

export function estimateMovingWork(
  inventory: Inventory,
  vehicle: Vehicle,
  route?: Pick<Route, 'distanceKm' | 'durationMinutes'> | null,
  options: EstimateOptions = {},
): MovingEstimate {
  const groups = inventoryVolumes(inventory);
  const volume = groups.light + groups.furniture + groups.bulky + groups.heavy;
  const fillRate = inventory.flags.fragile ? 0.75 : 0.85;
  const capacity = vehicleCapacity(vehicle);
  const trips = volume > 0 ? Math.max(1, Math.ceil(volume / (capacity * fillRate))) : 0;
  const requestedTrips = Math.max(1, Math.min(99, (options.trips ?? trips) || 1));
  const labor = { ...defaultMovingLaborPlanning, ...options.laborPlanning };
  const parallelVehicles = options.parallelVehicles ?? 1;
  const categoryRates = {
    light: { rate: 1.4, stairs: 0.1, lift: 0.03 },
    furniture: { rate: 1, stairs: 0.15, lift: 0.05 },
    bulky: { rate: 1.2, stairs: 0.2, lift: 0.15 },
    heavy: { rate: 0.72, stairs: 0.25, lift: 0.08 },
  } as const;
  const handlingFactor = (inventory.flags.acces ? 1.2 : 1) * (inventory.flags.fragile ? 1.1 : 1);
  const siteHours = (floor: number, lift: boolean, unloading = false) =>
    (Object.keys(categoryRates) as Array<keyof typeof categoryRates>).reduce((sum, category) => {
      const rate = categoryRates[category];
      const floorFactor =
        floor <= 0
          ? 1
          : lift
            ? 1.05 + rate.lift * floor
            : 1 + rate.stairs * floor * (inventory.flags.escalier ? 1.4 : 1);
      const unloadFactor = unloading ? 1.2 : 1;
      return (
        sum +
        (groups[category] / (labor.cubicMetersPerHourPerMover * rate.rate * unloadFactor)) *
          floorFactor *
          handlingFactor
      );
    }, 0);
  const dismantlingBySide = { from: 0, to: 0 };
  const dismantlingMinutes: Record<string, [number, number]> = {
    lit: [0.35, 0.5],
    armoire: [0.25, 0.4],
    'table-manger': [0.15, 0.25],
    bureau: [0.25, 0.4],
    climatiseur: [0.75, 1.25],
  };
  const addDismantling = (key: string, size: number, quantity: number, dismantle: boolean) => {
    const duration = dismantle ? (dismantlingMinutes[key] ?? [0.2, 0.3]) : undefined;
    if (!duration || quantity <= 0) return;
    const multiplier = key === 'armoire' ? size : 1;
    dismantlingBySide.from += duration[0] * multiplier * quantity;
    dismantlingBySide.to += duration[1] * multiplier * quantity;
  };
  Object.entries(inventory.entries).forEach(([key, entry]) =>
    addDismantling(key, entry.size, entry.quantity, entry.dismantle),
  );
  inventory.variants.forEach((variant) =>
    addDismantling(variant.itemKey, variant.size, variant.quantity, variant.dismantle),
  );
  inventory.custom.forEach((item) => {
    if (item.dismantle && item.quantity > 0) {
      dismantlingBySide.from += 0.2 * item.quantity;
      dismantlingBySide.to += 0.3 * item.quantity;
    }
  });
  const heavyKeys = new Set([
    'frigo',
    'congelateur',
    'cuisiniere',
    'machine-laver',
    'buffet',
    'vitrine',
    'armoire',
  ]);
  const heavyCount =
    Object.entries(inventory.entries).reduce(
      (sum, [key, entry]) => sum + (heavyKeys.has(key) && !entry.dismantle ? entry.quantity : 0),
      0,
    ) +
    inventory.variants.reduce(
      (sum, variant) =>
        sum + (heavyKeys.has(variant.itemKey) && !variant.dismantle ? variant.quantity : 0),
      0,
    );
  const stairsRequireExtra =
    heavyCount > 0 &&
    ((inventory.fromFloor >= 2 && !inventory.fromLift) ||
      (inventory.toFloor >= 2 && !inventory.toLift));
  const smallVolume = (['carton', 'sac'] as const).reduce((sum, key) => {
    const entry = inventory.entries[key];
    const base = entry
      ? itemVolume(key, entry.size, entry.dismantle, entry.format) * entry.quantity
      : 0;
    const variants = inventory.variants
      .filter((item) => item.itemKey === key)
      .reduce(
        (total, item) =>
          total + itemVolume(key, item.size, item.dismantle, item.format) * item.quantity,
        0,
      );
    return sum + base + variants;
  }, 0);
  const annexVolume =
    inventory.annexOn === false
      ? 0
      : Math.max(0, (dwellingVolumes[inventory.dwellingType] ?? 0) - smallVolume);
  const weight = inventoryWeight(inventory, annexVolume);
  const densityFactor =
    volume > 0 ? Math.max(0.85, Math.min(1.4, Math.sqrt(weight.total / volume / 110))) : 1;
  const isoLimit = (distance: number) =>
    distance <= 1
      ? 10000
      : distance <= 20
        ? 10000 - ((distance - 1) * 4000) / 19
        : (6000 * 20) / distance;
  const isoSiteLimit = (floor: number, lift: boolean) => {
    const distance = Math.round(15 * (inventory.flags.acces ? 2 : 1) + (lift ? 2 : 15) * floor);
    return Math.round(isoLimit(distance));
  };
  const isoCrew = Math.max(
    1,
    Math.ceil(
      weight.total / isoSiteLimit(inventory.fromFloor, inventory.fromLift) +
        weight.total / isoSiteLimit(inventory.toFloor, inventory.toLift) -
        0.05,
    ),
  );
  const stairFloors = Math.max(
    inventory.fromLift ? 0 : inventory.fromFloor,
    inventory.toLift ? 0 : inventory.toFloor,
  );
  const stairExtra =
    stairFloors > 0
      ? Math.ceil(stairFloors / 2)
      : Math.max(inventory.fromFloor, inventory.toFloor) >= 4
        ? 1
        : 0;
  const volumeCrew =
    Math.max(Math.ceil(volume / 6), Math.ceil(weight.total / Math.max(100, 6 * 110))) + stairExtra;
  const minimumCrew = Math.max(
    stairsRequireExtra ? 3 : 2,
    Math.min(labor.maxMoversPerVehicle, Math.max(volumeCrew, isoCrew)),
    weight.largestHandlingCrew,
    2 * parallelVehicles,
  );
  const efficiency = (crew: number) => {
    const perVehicle = crew / parallelVehicles;
    const referenceEfficiency =
      perVehicle <= 2
        ? perVehicle
        : perVehicle <= 4
          ? 2 + 0.75 * (perVehicle - 2)
          : 3.5 + 0.4 * (perVehicle - 4);
    return parallelVehicles * referenceEfficiency;
  };
  const loadingBase = siteHours(inventory.fromFloor, inventory.fromLift) * densityFactor;
  const unloadingBase = siteHours(inventory.toFloor, inventory.toLift, true) * densityFactor;
  const tripOverheadHours = (15 / 60) * Math.ceil(requestedTrips / parallelVehicles);
  const loadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(loadingBase / efficiency(crew), carpenter ? dismantlingBySide.from / carpenter : 0) +
    tripOverheadHours;
  const unloadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(unloadingBase / efficiency(crew), carpenter ? dismantlingBySide.to / carpenter : 0) +
    tripOverheadHours;
  let recommendedCrew = minimumCrew;
  let recommendedCarpenters =
    dismantlingBySide.from + dismantlingBySide.to > 0 ? parallelVehicles : 0;
  let recommendationPass = 0;
  while (
    loadingWithCrew(recommendedCrew, recommendedCarpenters) +
      unloadingWithCrew(recommendedCrew, recommendedCarpenters) >
      labor.maxHandlingHours &&
    recommendationPass++ < 80
  ) {
    const carpentryIsBottleneck =
      recommendedCarpenters > 0 &&
      (dismantlingBySide.from / recommendedCarpenters > loadingBase / efficiency(recommendedCrew) ||
        dismantlingBySide.to / recommendedCarpenters > unloadingBase / efficiency(recommendedCrew));
    if (carpentryIsBottleneck && recommendedCarpenters < 3 * parallelVehicles)
      recommendedCarpenters += 1;
    else if (recommendedCrew < Math.round(labor.maxMoversPerVehicle * parallelVehicles))
      recommendedCrew += 1;
    else break;
  }
  const crew = Math.min(20, Math.max(1, options.crew || recommendedCrew));
  const loadingHours = loadingWithCrew(crew, recommendedCarpenters);
  const unloadingHours = unloadingWithCrew(crew, recommendedCarpenters);
  const packingHours =
    inventory.flags.emballage || inventory.ready === 'non'
      ? 0.45 * groups.light + 0.1 * (groups.furniture + groups.bulky + groups.heavy)
      : 0;
  const packingMinutes = (packingHours / efficiency(crew)) * 60;
  const routeKm = route?.distanceKm ?? 0;
  const routeMinutes = referenceTravelMinutes({
    distanceKm: routeKm,
    startTime: options.startTime ?? '',
    date: options.date,
    month: options.month,
    from: options.fromAddress,
    to: options.toAddress,
    hasToll: options.hasToll,
    ignoreTraffic: options.ignoreTraffic,
    manualMinutes: options.manualLegMinutes,
    vehicleId: vehicle.id,
  });
  const legLoaded = routeMinutes ? 10 + routeMinutes : 0;
  const legEmpty = routeMinutes ? 10 + routeMinutes * 0.85 : 0;
  const journeyCount = Math.ceil(requestedTrips / parallelVehicles);
  const loadingMinutes = roundFive((loadingHours * 60) / journeyCount) * journeyCount;
  const unloadingMinutes = roundFive((unloadingHours * 60) / journeyCount) * journeyCount;
  const packingOnPreviousDay = packingMinutes > 90;
  const driveMinutes = journeyCount * legLoaded + Math.max(0, journeyCount - 1) * legEmpty;
  const startAt = startMinutes(options.startTime ?? '', labor.defaultStartHour);
  type PlanningSegment = {
    title: string;
    detail: string;
    minutes: number;
    split: boolean;
    kind: string;
  };
  const segments: PlanningSegment[] = [];
  const addSegment = (
    title: string,
    detail: string,
    minutes: number,
    split: boolean,
    kind: string,
  ) => {
    if (minutes > 0) segments.push({ title, detail, minutes: roundFive(minutes), split, kind });
  };
  addSegment(
    'Arrivée et briefing',
    'Tour du logement avec le client, consignes du chef d’équipe, protection des sols et des portes',
    20,
    false,
    'arrival',
  );
  if (packingMinutes > 0 && !packingOnPreviousDay)
    addSegment(
      'Emballage',
      'Cartons, film, serviettes de protection',
      packingMinutes,
      true,
      'packing',
    );
  for (let trip = 1; trip <= journeyCount; trip += 1) {
    const last = trip === journeyCount;
    const tag = journeyCount > 1 ? ` ${trip} / ${journeyCount}` : '';
    addSegment(
      `Chargement${tag}`,
      `${crew} manœuvres${recommendedCarpenters && trip === 1 ? ', démontage par le menuisier' : ''} · mur par mur, sanglé`,
      loadingMinutes / journeyCount,
      true,
      'load',
    );
    if (legLoaded)
      addSegment(
        `Trajet${tag}`,
        `${routeKm.toLocaleString('fr-FR')} km, stationnement compris`,
        legLoaded,
        false,
        'drive',
      );
    addSegment(
      `Déchargement${tag}`,
      `${crew} manœuvres${recommendedCarpenters && last ? ', remontage par le menuisier' : ''} · placement pièce par pièce`,
      unloadingMinutes / journeyCount,
      true,
      'unload',
    );
    if (!last && legEmpty)
      addSegment(`Retour à vide${tag}`, 'Vers le logement de départ', legEmpty, false, 'back');
  }
  addSegment(
    'Vérification finale',
    'Tour des pièces avec le client, état des lieux, signature',
    15,
    false,
    'finish',
  );
  const heat = heatRecovery(
    options.date ?? '',
    options.month ?? '',
    Math.max(
      inventory.fromLift ? 0 : inventory.fromFloor,
      inventory.toLift ? 0 : inventory.toFloor,
    ) >= 2
      ? 4
      : 3,
    labor,
    options.heatOff,
    options.heatRest,
  );
  const restRule = heat ?? { work: 150, rest: 15, wbgt: 0, reference: 0, manual: false };
  const planning: PlanningStep[] = [];
  let cursor = startAt;
  let workSinceRest = 0;
  let lunchTaken = false;
  let dinnerTaken = false;
  for (const segment of segments) {
    let remaining = segment.minutes;
    let part = 0;
    while (remaining > 0) {
      if (!lunchTaken && cursor >= 12 * 60 + 15 && cursor < 14 * 60 && cursor - startAt >= 120) {
        planning.push({
          time: '',
          title: 'Pause déjeuner',
          detail: 'Repas, eau, repos de l’équipe',
          minutes: 45,
        });
        cursor += 45;
        workSinceRest = 0;
        lunchTaken = true;
        continue;
      }
      if (!dinnerTaken && cursor >= 19 * 60 + 30 && cursor < 21 * 60 && cursor - startAt >= 180) {
        planning.push({
          time: '',
          title: 'Pause dîner',
          detail: 'Repas et repos de l’équipe',
          minutes: 30,
        });
        cursor += 30;
        workSinceRest = 0;
        dinnerTaken = true;
        continue;
      }
      if (workSinceRest >= restRule.work) {
        planning.push({
          time: '',
          title: heat && heat.work < 150 ? 'Récupération chaleur' : 'Pause',
          detail:
            heat && heat.work < 150
              ? `${heat.rest} min à l’ombre et eau après ${heat.work} min de portage (ISO 7243 : WBGT ${String(heat.wbgt).replace('.', ',')} °C, référence ${heat.reference} °C)`
              : '15 min toutes les 2 h 30 de portage, hydratation',
          minutes: restRule.rest,
        });
        cursor += restRule.rest;
        workSinceRest = 0;
        continue;
      }
      let chunk = segment.split
        ? Math.min(
            remaining,
            Number.POSITIVE_INFINITY,
            Math.max(Math.min(30, restRule.work), restRule.work - workSinceRest),
          )
        : remaining;
      if (
        segment.split &&
        !lunchTaken &&
        cursor < 12 * 60 + 15 &&
        cursor + chunk > 12 * 60 + 30 &&
        12 * 60 + 15 - cursor >= 20
      )
        chunk = 12 * 60 + 15 - cursor;
      if (segment.split && remaining - chunk < 15) chunk = remaining;
      planning.push({
        time: '',
        title: `${segment.title}${part ? ' (suite)' : ''}`,
        detail: segment.detail,
        minutes: chunk,
      });
      cursor += chunk;
      remaining -= chunk;
      if (segment.kind !== 'drive' && segment.kind !== 'back') workSinceRest += chunk;
      if (segment.kind === 'drive') workSinceRest = Math.max(0, workSinceRest - chunk);
      part += 1;
    }
  }
  cursor = startAt;
  planning.forEach((step) => {
    step.time = formatTime(cursor);
    cursor += step.minutes;
  });
  const totalMinutes = planning.reduce((sum, step) => sum + step.minutes, 0);
  const endAt = cursor;
  const warnings: string[] = [];
  const dimensionsWarnings = vehicleDimensionWarnings(inventory, vehicle);
  warnings.push(...dimensionsWarnings);
  const itemCount = (key: string) =>
    (inventory.entries[key]?.quantity ?? 0) +
    inventory.variants
      .filter((variant) => variant.itemKey === key)
      .reduce((sum, variant) => sum + variant.quantity, 0);
  if (itemCount('lit') > itemCount('matelas'))
    warnings.push(
      `${itemCount('lit') - itemCount('matelas')} lit(s) sans matelas compté(s) : vérifier avec le client.`,
    );
  if (itemCount('table-manger') > 0 && itemCount('chaise') === 0)
    warnings.push('Table à manger sans chaise comptée : vérifier avec le client.');
  if (!inventory.dwellingType)
    warnings.push('Type de logement non précisé : les effets annexes ne sont pas estimés.');
  if (loadingHours + unloadingHours > labor.maxHandlingHours)
    warnings.push(
      `Chargement et déchargement dépassent le plafond conseillé de ${labor.maxHandlingHours} h avec ${crew} manœuvres.`,
    );
  if (totalMinutes > labor.maxDayHours * 60)
    warnings.push(
      `La durée dépasse ${labor.maxDayHours} h : prévoir un départ plus tôt, un véhicule supplémentaire ou deux jours.`,
    );
  if (endAt > 19 * 60)
    warnings.push('Fin après 19 h : commencer plus tôt ou répartir sur 2 jours.');
  if (routeMinutes <= 0)
    warnings.push('Placez les deux points sur la carte pour calculer le trajet.');
  if (!inventory.ready) warnings.push('Confirmer si les affaires sont prêtes à être chargées.');
  if (!inventory.stairs) warnings.push('Confirmer si les objets passent dans les escaliers.');
  if (inventory.stairs === 'non')
    warnings.push('Certains objets ne passent pas dans les escaliers : prévoir un accès adapté.');
  if (inventory.stairs === 'verif')
    warnings.push('Le passage des objets dans les escaliers reste à vérifier.');
  const carpenterCount = recommendedCarpenters;
  return {
    vehicleName: vehicle.name,
    volume,
    trips,
    plannedTrips: requestedTrips,
    capacity,
    fillRate,
    crew,
    recommendedCrew,
    carpenterCount,
    dismantleFromMinutes: recommendedCarpenters
      ? (dismantlingBySide.from / recommendedCarpenters) * 60
      : 0,
    dismantleToMinutes: recommendedCarpenters
      ? (dismantlingBySide.to / recommendedCarpenters) * 60
      : 0,
    loadingMinutes,
    unloadingMinutes,
    handlingMinutes: loadingMinutes + unloadingMinutes,
    packingMinutes,
    travelMinutes: driveMinutes,
    travelLegMinutes: legLoaded,
    totalMinutes,
    rawTotalMinutes: totalMinutes,
    lowDurationMinutes: totalMinutes * 0.85,
    highDurationMinutes: totalMinutes * 1.3,
    minimumDays: Math.max(1, Math.ceil(totalMinutes / (labor.maxDayHours * 60))),
    startTime: formatTime(startAt),
    endTime: formatTime(endAt),
    endLate: endAt > 19 * 60,
    planning,
    heat,
    warnings,
    vehicleWarnings: dimensionsWarnings,
    warning:
      volume === 0
        ? 'Renseignez les objets ou le type de logement pour calculer une estimation.'
        : (warnings[0] ?? null),
  };
}

export function bookingInventorySnapshot(
  inventory: Inventory,
  estimate: MovingEstimate,
): BookingInventorySnapshot {
  const items = inventoryItems.flatMap((definition) => {
    const entries = [
      inventory.entries[definition.key],
      ...inventory.variants.filter((variant) => variant.itemKey === definition.key),
    ].filter((entry) => entry && entry.quantity > 0);
    return entries.map((entry) => {
      const format = entry.format ?? 'medium';
      const details = [
        definition.sizeLabel
          ? `${entry.size} ${entry.size === 1 ? definition.sizeLabel.replace(/s$/u, '') : definition.sizeLabel}`
          : definition.hasFormat
            ? `${inventoryFormats.find((item) => item.value === format)?.label ?? 'Moyen'} : ${inventoryFormatHint(definition.key, format)}`
            : '',
        entry.dismantle ? 'démontage et montage' : '',
      ]
        .filter(Boolean)
        .join(', ');
      return {
        section: definition.section,
        label: definition.label,
        quantity: entry.quantity,
        details: details || '—',
        volumeM3: itemVolume(definition.key, entry.size, entry.dismantle, format) * entry.quantity,
      };
    });
  });
  const customItems = inventory.custom
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const format = item.format ?? 'medium';
      return {
        section: 'Autres objets',
        label: item.label.charAt(0).toLocaleUpperCase('fr-FR') + item.label.slice(1),
        quantity: item.quantity,
        details: item.dismantle ? 'démontage et montage' : '—',
        volumeM3: itemVolume('custom', 1, Boolean(item.dismantle), format) * item.quantity,
      };
    });
  const allItems = [...items, ...customItems];
  const boxVolume = ['carton', 'sac'].reduce((sum, key) => {
    const entry = inventory.entries[key];
    const entryVolume = entry
      ? itemVolume(key, entry.size, entry.dismantle, entry.format) * entry.quantity
      : 0;
    const variantVolume = inventory.variants
      .filter((variant) => variant.itemKey === key)
      .reduce(
        (total, variant) =>
          total +
          itemVolume(key, variant.size, variant.dismantle, variant.format) * variant.quantity,
        0,
      );
    return sum + entryVolume + variantVolume;
  }, 0);
  const annexIncluded = Boolean(inventory.dwellingType) && inventory.annexOn !== false;
  const annexVolumeM3 = annexIncluded
    ? Math.max(0, (dwellingVolumes[inventory.dwellingType] ?? 0) - boxVolume)
    : 0;
  return {
    sourceInventory: inventory,
    dwellingType: inventory.dwellingType,
    annexIncluded,
    annexVolumeM3,
    fromFloor: inventory.fromFloor,
    toFloor: inventory.toFloor,
    fromLift: inventory.fromLift,
    toLift: inventory.toLift,
    ready: inventory.ready ?? '',
    stairs: inventory.stairs ?? '',
    flags: inventoryFlags.filter((flag) => inventory.flags[flag.key]).map((flag) => flag.label),
    items: allItems,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    totalVolumeM3: estimate.volume,
    vehicleCapacityM3: estimate.capacity,
    fillRate: estimate.fillRate,
    estimatedTrips: estimate.trips,
    moverCount: estimate.crew,
    carpenterCount: estimate.carpenterCount,
    loadingMinutes: estimate.loadingMinutes,
    unloadingMinutes: estimate.unloadingMinutes,
    packingMinutes: estimate.packingMinutes,
    travelMinutes: estimate.travelMinutes,
    travelLegMinutes: estimate.travelLegMinutes,
    totalMinutes: estimate.totalMinutes,
    lowDurationMinutes: estimate.lowDurationMinutes,
    highDurationMinutes: estimate.highDurationMinutes,
    startTime: estimate.startTime,
    endTime: estimate.endTime,
  };
}

export { movingEstimateNote, formatDuration } from './moving-estimate-note';
