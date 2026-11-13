import {
  customItemVolume,
  dwellingVolumes,
  formatTime,
  inventoryWeight,
  inventoryVolumes,
  itemVolume,
  roundFive,
  startMinutes,
  vehicleCapacity,
} from './moving-estimate-inventory';
export {
  estimatedInventoryItemVolume,
  inventoryDismantleFactor,
} from './moving-estimate-inventory';
import {
  inventoryFormatHint,
  inventoryFormats,
  inventoryItems,
  inventoryFlags,
  type Inventory,
} from '../inventory/inventory';
import type {
  BookingInventorySnapshot,
  MovingLaborPlanningSettings,
} from '../../../shared/domain/model';
import type { Route, Vehicle } from '../../../shared/domain/model';
import { referenceTravelMinutes } from '../routing/reference-traffic';
import { vehicleDimensionWarnings } from '../../../moving/domain/vehicle-dimensions';

export const defaultMovingLaborPlanning: MovingLaborPlanningSettings = {
  maxHandlingHours: 3,
  maxDayHours: 8,
  defaultStartHour: 8,
  maxMoversPerVehicle: 6,
  cubicMetersPerHourPerMover: 2.7,
  pauseMinutes: 30,
  teamVolumePerMover: 6,
  tripSetupMinutes: 15,
  handlingCalibration: 1,
  carryDistanceMeters: 15,
  heat: 1,
  wbgtAdj: 0,
  maxTotalHours: 12,
  metabolicReference: 200,
  effortGround: 200,
  effortLift: 210,
  effortStairs: 230,
  effortPerFloor: 12,
  effortMaximum: 290,
  followingTripDiscountPercent: 60,
  lowDemandDiscountPercent: 10,
  manoeuvreOvertimeThresholdHours: 8,
  manoeuvreOvertimeHourlyRate: 0,
};

export type PlanningStep = {
  time: string;
  title: string;
  detail: string;
  minutes: number;
  kind?: string;
};
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
  totalWeightKg: number;
  fromIsoDistanceMeters: number;
  toIsoDistanceMeters: number;
  fromIsoLimitKg: number;
  toIsoLimitKg: number;
  maxItemWeightKg: number;
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
  fatigueEffort: {
    percentage: number;
    carrying: number;
    travel: number;
    other: number;
    from: number;
    to: number;
  };
  heatPenalty: number;
  heat: HeatRecovery | null;
  warnings: string[];
  vehicleWarnings: string[];
  warning: string | null;
};
type EstimateOptions = {
  trips?: number;
  recommendedTrips?: number;
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
  const volumeTrips = volume > 0 ? Math.max(1, Math.ceil(volume / (capacity * fillRate))) : 0;
  const trips = options.recommendedTrips ?? volumeTrips;
  const requestedTrips = Math.max(1, Math.min(99, (options.trips ?? trips) || 1));
  const labor = { ...defaultMovingLaborPlanning, ...options.laborPlanning };
  const parallelVehicles = options.parallelVehicles ?? 1;
  const categoryRates = {
    light: { r: 1.4, st: 0.1, lift: 0.03 },
    furn: { r: 1, st: 0.15, lift: 0.05 },
    bulky: { r: 1.2, st: 0.2, lift: 0.15 },
    heavy: { r: 0.72, st: 0.25, lift: 0.08 },
  } as const;
  const categoryVolumes = {
    light: groups.light,
    furn: groups.furniture,
    bulky: groups.bulky,
    heavy: groups.heavy,
  };
  const accessFactor = inventory.flags.acces ? 1.2 : 1;
  const fragileFactor = inventory.flags.fragile ? 1.1 : 1;
  const siteHours = (floor: number, lift: boolean, unloading = false) =>
    Object.keys(categoryRates).reduce((sum, category) => {
      const key = category as keyof typeof categoryRates;
      const config = categoryRates[key];
      const rate = labor.cubicMetersPerHourPerMover * config.r * (unloading ? 1.2 : 1);
      const floorFactor = !(floor > 0)
        ? 1
        : lift
          ? 1.05 + config.lift * floor
          : 1 + config.st * floor * (inventory.flags.escalier ? 1.4 : 1);
      return sum + (categoryVolumes[key] / rate) * floorFactor * accessFactor * fragileFactor;
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
  const isoSite = (floor: number, lift: boolean) => {
    const distance = Math.round(
      (Number(labor.carryDistanceMeters) || 15) * (inventory.flags.acces ? 2 : 1) +
        (lift ? 2 : 15) * floor,
    );
    return { distance, limit: Math.round(isoLimit(distance)) };
  };
  const fromIso = isoSite(inventory.fromFloor, inventory.fromLift);
  const toIso = isoSite(inventory.toFloor, inventory.toLift);
  const isoCrew = Math.max(
    1,
    Math.ceil(weight.total / fromIso.limit + weight.total / toIso.limit - 0.05),
  );
  const nonLiftStairFloors = Math.max(
    inventory.fromLift ? 0 : inventory.fromFloor,
    inventory.toLift ? 0 : inventory.toFloor,
  );
  const liftFloors = Math.max(
    inventory.fromLift ? inventory.fromFloor : 0,
    inventory.toLift ? inventory.toFloor : 0,
  );
  // Keep the legacy reference rule: stairs add one mover per two floors;
  // an elevator adds one only from the fourth floor.
  const stairExtra = nonLiftStairFloors > 0
    ? Math.ceil(nonLiftStairFloors / 2)
    : liftFloors >= 4
      ? 1
      : 0;
  const teamVolumePerMover = Math.max(1, Number(labor.teamVolumePerMover) || 6);
  const volumeCrew =
    Math.max(
      Math.ceil(volume / teamVolumePerMover),
      Math.ceil(weight.total / Math.max(100, teamVolumePerMover * 110)),
    ) + stairExtra;
  const handlingCrew =
    weight.largestHandlingCrew > 2 &&
    weight.itemsAtLargestHandlingCrew <= 2 &&
    dismantlingBySide.from + dismantlingBySide.to > 0
      ? weight.largestHandlingCrew - 1
      : weight.largestHandlingCrew;
  const minimumCrew = Math.max(
    stairsRequireExtra ? 3 : 2,
    Math.min(labor.maxMoversPerVehicle, Math.max(volumeCrew, isoCrew)),
    handlingCrew,
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
  const loadingBase =
    siteHours(inventory.fromFloor, inventory.fromLift) *
    densityFactor *
    (inventory.stairs === 'balcon'
      ? 1 + (volume > 0 ? (0.4 * (groups.bulky + groups.heavy)) / volume : 0)
      : 1);
  const unloadingBase = siteHours(inventory.toFloor, inventory.toLift, true) * densityFactor;
  const tripOverheadHours =
    (Math.max(0, Number(labor.tripSetupMinutes) || 0) / 60) *
    Math.ceil(requestedTrips / parallelVehicles);
  const handlingCalibration = Math.max(0.5, Number(labor.handlingCalibration) || 1);
  const loadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(loadingBase / efficiency(crew), carpenter ? dismantlingBySide.from / carpenter : 0) *
      handlingCalibration +
    tripOverheadHours;
  const unloadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(unloadingBase / efficiency(crew), carpenter ? dismantlingBySide.to / carpenter : 0) *
      handlingCalibration +
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
  const packingHours = inventory.flags.emballage
    ? 0.45 * groups.light + 0.1 * (groups.furniture + groups.bulky + groups.heavy)
    : 0;
  const packingMinutes = (packingHours / efficiency(crew)) * handlingCalibration * 60;
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
  // Keep raw totals for summaries. The reference rounds each trip segment
  // separately when it builds the schedule below.
  const loadingMinutes = loadingHours * 60;
  const unloadingMinutes = unloadingHours * 60;
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
  const heatWithoutPauses = options.heatOff
    ? heatRecovery(
        options.date ?? '',
        options.month ?? '',
        Math.max(
          inventory.fromLift ? 0 : inventory.fromFloor,
          inventory.toLift ? 0 : inventory.toFloor,
        ) >= 2
          ? 4
          : 3,
        labor,
        false,
        options.heatRest,
      )
    : null;
  const heatPenalty =
    heatWithoutPauses && heatWithoutPauses.work < 150
      ? 100 + Math.round(Math.max(0, heatWithoutPauses.wbgt - heatWithoutPauses.reference) * 10)
      : 0;
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
          kind: 'pause',
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
          kind: 'pause',
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
          kind: 'pause',
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
        kind: segment.kind,
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
  const effortAt = (floor: number, lift: boolean) =>
    floor <= 0
      ? (labor.effortGround ?? 200)
      : lift
        ? (labor.effortLift ?? 210)
        : Math.min(
            labor.effortMaximum ?? 290,
            (labor.effortStairs ?? 230) + (labor.effortPerFloor ?? 12) * floor,
          );
  const effortFrom = effortAt(inventory.fromFloor, inventory.fromLift);
  const effortTo = effortAt(inventory.toFloor, inventory.toLift);
  const fatigueWork = planning.reduce(
    (sum, step) =>
      sum +
      (step.kind === 'load'
        ? step.minutes * effortFrom
        : step.kind === 'unload'
          ? step.minutes * effortTo
          : step.kind === 'drive' || step.kind === 'back'
            ? step.minutes * 100
            : step.kind === 'pause' || step.kind === 'night'
              ? 0
              : step.minutes * 150),
    0,
  );
  const effortReference = 480 * (labor.metabolicReference ?? 200);
  const fatigueEffort = {
    percentage: Math.round((fatigueWork / effortReference) * 100),
    carrying: Math.round(
      (planning.reduce(
        (sum, step) =>
          sum +
          (step.kind === 'load'
            ? step.minutes * effortFrom
            : step.kind === 'unload'
              ? step.minutes * effortTo
              : 0),
        0,
      ) /
        effortReference) *
        100,
    ),
    travel: Math.round(
      (planning.reduce(
        (sum, step) =>
          sum + (step.kind === 'drive' || step.kind === 'back' ? step.minutes * 100 : 0),
        0,
      ) /
        effortReference) *
        100,
    ),
    other: Math.round(
      (planning.reduce(
        (sum, step) =>
          sum +
          (step.kind !== 'load' &&
          step.kind !== 'unload' &&
          step.kind !== 'drive' &&
          step.kind !== 'back' &&
          step.kind !== 'pause' &&
          step.kind !== 'night'
            ? step.minutes * 150
            : 0),
        0,
      ) /
        effortReference) *
        100,
    ),
    from: effortFrom,
    to: effortTo,
  };
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
  if (totalMinutes > (labor.maxTotalHours ?? 12) * 60)
    warnings.push(
      `La durée dépasse ${labor.maxTotalHours ?? 12} h : prévoir une relève, deux véhicules ou deux jours.`,
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
    totalWeightKg: weight.total,
    fromIsoDistanceMeters: fromIso.distance,
    toIsoDistanceMeters: toIso.distance,
    fromIsoLimitKg: fromIso.limit,
    toIsoLimitKg: toIso.limit,
    maxItemWeightKg: weight.max,
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
    fatigueEffort,
    heatPenalty,
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
      return {
        section: 'Autres objets',
        label: item.label.charAt(0).toLocaleUpperCase('fr-FR') + item.label.slice(1),
        quantity: item.quantity,
        details: item.dismantle ? 'démontage et montage' : '—',
        volumeM3: customItemVolume(item) * item.quantity,
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
    balcPx: inventory.balcPx,
    flags: inventoryFlags.filter((flag) => inventory.flags[flag.key]).map((flag) => flag.label),
    items: allItems,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    totalVolumeM3: estimate.volume,
    vehicleCapacityM3: estimate.capacity,
    fillRate: estimate.fillRate,
    estimatedTrips: estimate.trips,
    moverCount: estimate.crew,
    carpenterCount: estimate.carpenterCount,
    totalWeightKg: estimate.totalWeightKg,
    maxItemWeightKg: estimate.maxItemWeightKg,
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
