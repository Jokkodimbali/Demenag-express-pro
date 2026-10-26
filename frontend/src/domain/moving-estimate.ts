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
  cubicMetersPerHourPerMover: 2.5,
  pauseMinutes: 30,
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
    : (definition?.volumeByFormat?.[formatIndexes[format]] ??
      base * (genericFormatFactors[formatIndexes[format]] ?? 1));
  const nonStackable = key === 'salon' ? 1.25 : 1;
  return volume * nonStackable * (dismantle ? inventoryDismantleFactor(key) : 1);
}

const itemVolume = estimatedInventoryItemVolume;

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
  loadingMinutes: number;
  unloadingMinutes: number;
  packingMinutes: number;
  travelMinutes: number;
  totalMinutes: number;
  lowDurationMinutes: number;
  highDurationMinutes: number;
  minimumDays: number;
  startTime: string;
  endTime: string;
  planning: PlanningStep[];
  warnings: string[];
  vehicleWarnings: string[];
  warning: string | null;
};
type EstimateOptions = {
  trips?: number;
  crew?: number;
  startTime?: string;
  laborPlanning?: MovingLaborPlanningSettings;
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
    const duration = dismantle ? dismantlingMinutes[key] : undefined;
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
  const minimumCrew = stairsRequireExtra ? 3 : 2;
  const efficiency = (crew: number) => (crew <= 4 ? crew : 4 + 0.6 * (crew - 4));
  const loadingBase = siteHours(inventory.fromFloor, inventory.fromLift);
  const unloadingBase = siteHours(inventory.toFloor, inventory.toLift, true);
  const loadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(loadingBase / efficiency(crew), carpenter ? dismantlingBySide.from / carpenter : 0);
  const unloadingWithCrew = (crew: number, carpenter: number) =>
    Math.max(unloadingBase / efficiency(crew), carpenter ? dismantlingBySide.to / carpenter : 0);
  let recommendedCrew = minimumCrew;
  let recommendedCarpenters = dismantlingBySide.from + dismantlingBySide.to > 0 ? 1 : 0;
  while (
    loadingWithCrew(recommendedCrew, recommendedCarpenters) +
      unloadingWithCrew(recommendedCrew, recommendedCarpenters) >
      labor.maxHandlingHours &&
    (recommendedCrew < labor.maxMoversPerVehicle || recommendedCarpenters < 3)
  ) {
    const carpentryIsBottleneck =
      recommendedCarpenters > 0 &&
      (dismantlingBySide.from / recommendedCarpenters > loadingBase / efficiency(recommendedCrew) ||
        dismantlingBySide.to / recommendedCarpenters > unloadingBase / efficiency(recommendedCrew));
    if (carpentryIsBottleneck && recommendedCarpenters < 3) recommendedCarpenters += 1;
    else if (recommendedCrew < labor.maxMoversPerVehicle) recommendedCrew += 1;
    else if (recommendedCarpenters < 3) recommendedCarpenters += 1;
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
  const routeDuration = route?.durationMinutes ?? 0;
  const averageSpeed = routeDuration > 0 ? routeKm / (routeDuration / 60) : 0;
  const routeBaseMinutes =
    routeKm <= 0
      ? 0
      : routeDuration > 0 && averageSpeed > 8 && averageSpeed < 100
        ? routeDuration * (1.15 + 0.35 * Math.exp(-routeKm / 30))
        : (routeKm / (18 + 37 * (1 - Math.exp(-routeKm / 40)))) * 60;
  const vehicleRouteFactor = vehicle.id === 'trafic' ? 1 : 1.05;
  const routeMinutes = routeBaseMinutes * vehicleRouteFactor;
  const legLoaded = routeMinutes ? 10 + routeMinutes : 0;
  const legEmpty = routeMinutes ? 10 + routeMinutes * 0.85 : 0;
  const journeyCount = requestedTrips;
  const loadingMinutes = loadingHours * 60;
  const unloadingMinutes = unloadingHours * 60;
  const packingOnPreviousDay = packingMinutes > 90;
  const driveMinutes = journeyCount * legLoaded + Math.max(0, journeyCount - 1) * legEmpty;
  const activeWorkMinutes =
    25 +
    (packingOnPreviousDay ? 0 : packingMinutes) +
    loadingMinutes +
    unloadingMinutes +
    driveMinutes;
  const pauseMinutes = activeWorkMinutes > 300 ? roundFive(labor.pauseMinutes) : 0;
  const startAt = startMinutes(options.startTime ?? '', labor.defaultStartHour);
  const planning: PlanningStep[] = [];
  const addStep = (title: string, detail: string, minutes: number) =>
    planning.push({ time: '', title, detail, minutes: roundFive(minutes) });
  addStep('Arrivée au départ', 'Stationnement, protection des sols et des portes', 15);
  if (packingMinutes > 0 && !packingOnPreviousDay)
    addStep('Emballage', 'Cartons, film et couvertures', packingMinutes);
  if (journeyCount <= 1) {
    addStep(
      'Chargement',
      `${crew} manœuvres${recommendedCarpenters ? ` · ${recommendedCarpenters} menuisier(s)` : ''}`,
      loadingMinutes,
    );
    if (legLoaded)
      addStep(
        'Trajet vers l’arrivée',
        `${routeKm.toLocaleString('fr-FR')} km, stationnement compris`,
        legLoaded,
      );
    addStep(
      'Déchargement',
      `${crew} manœuvres${recommendedCarpenters ? ` · ${recommendedCarpenters} menuisier(s)` : ''}`,
      unloadingMinutes,
    );
  } else {
    for (let trip = 1; trip <= journeyCount; trip++) {
      const last = trip === journeyCount;
      const loading = roundFive(loadingMinutes / journeyCount);
      const unloading = roundFive(unloadingMinutes / journeyCount);
      const loadedTravel = legLoaded ? roundFive(legLoaded) : 0;
      const emptyTravel = !last && legEmpty ? roundFive(legEmpty) : 0;
      addStep(
        `Voyage ${trip} / ${journeyCount}`,
        `Chargement ${formatDuration(loading)}${loadedTravel ? ` · trajet ${formatDuration(loadedTravel)}` : ''} · déchargement ${formatDuration(unloading)}${emptyTravel ? ` · retour à vide ${formatDuration(emptyTravel)}` : ''}`,
        loading + loadedTravel + unloading + emptyTravel,
      );
    }
  }
  addStep('Vérification finale', 'État des lieux et signature', 10);
  const startForPause = startAt;
  let elapsed = 0;
  planning.forEach((step) => {
    elapsed += step.minutes;
  });
  if (pauseMinutes) {
    const target = (elapsed + pauseMinutes) / 2;
    let running = 0;
    let position = Math.max(1, planning.length - 1);
    let closest = Number.POSITIVE_INFINITY;
    planning.forEach((step, index) => {
      running += step.minutes;
      if (index > 0 && index < planning.length - 1 && Math.abs(running - target) < closest) {
        position = index + 1;
        closest = Math.abs(running - target);
      }
    });
    planning.splice(position, 0, {
      time: '',
      title: 'Pause',
      detail: 'Repas et repos de l’équipe',
      minutes: pauseMinutes,
    });
  }
  let cursor = startForPause;
  planning.forEach((step) => {
    step.time = formatTime(cursor);
    cursor += step.minutes;
  });
  const totalMinutes = planning.reduce((sum, step) => sum + step.minutes, 0);
  const endAt = cursor;
  const warnings: string[] = [];
  const dimensionsWarnings = vehicleWarnings(inventory, vehicle);
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
    loadingMinutes,
    unloadingMinutes,
    packingMinutes,
    travelMinutes: driveMinutes,
    totalMinutes,
    lowDurationMinutes: totalMinutes * 0.85,
    highDurationMinutes: totalMinutes * 1.3,
    minimumDays: Math.max(1, Math.ceil(totalMinutes / (labor.maxDayHours * 60))),
    startTime: formatTime(startAt),
    endTime: formatTime(endAt),
    planning,
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
          ? `${entry.size} ${definition.sizeLabel}${definition.sizeName ? ` · ${definition.sizeName(entry.size)}` : ''}`
          : definition.hasFormat
            ? `${inventoryFormats.find((item) => item.value === format)?.label ?? 'Moyen'}${inventoryFormatHint(definition.key, format) ? ` · ${inventoryFormatHint(definition.key, format)}` : ''}`
            : '',
        entry.dismantle ? 'démontage et montage' : '',
      ]
        .filter(Boolean)
        .join(' · ');
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
        label: item.label,
        quantity: item.quantity,
        details: `${inventoryFormats.find((option) => option.value === format)?.label ?? 'Moyen'} format${item.dismantle ? ' · démontage et montage' : ''}`,
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
    estimatedTrips: estimate.plannedTrips,
    moverCount: estimate.crew,
    carpenterCount: estimate.carpenterCount,
    loadingMinutes: estimate.loadingMinutes,
    unloadingMinutes: estimate.unloadingMinutes,
    packingMinutes: estimate.packingMinutes,
    travelMinutes: estimate.travelMinutes,
    totalMinutes: estimate.totalMinutes,
    lowDurationMinutes: estimate.lowDurationMinutes,
    highDurationMinutes: estimate.highDurationMinutes,
    startTime: estimate.startTime,
    endTime: estimate.endTime,
  };
}

function vehicleWarnings(inventory: Inventory, vehicle: Vehicle): string[] {
  const height = numberFrom(vehicle.height);
  const length = numberFrom(vehicle.length);
  const warnings: string[] = [];
  const entries = [
    ...Object.entries(inventory.entries).map(([key, item]) => ({ key, ...item })),
    ...inventory.variants.map((item) => ({ key: item.itemKey, ...item })),
  ].filter((item) => item.quantity > 0);
  entries.forEach((item) => {
    const { key } = item;
    if (key === 'frigo') {
      const itemHeight = [0.85, 1.6, 1.85][formatIndexes[item.format ?? 'medium']];
      if (height && itemHeight > height)
        warnings.push(
          `Frigo debout ≈ ${itemHeight.toFixed(2)} m : dépasse la hauteur utile de ${height.toFixed(2)} m.`,
        );
    }
    if (key === 'vitrine' && item.format !== 'small' && height && height < 1.8)
      warnings.push(
        `Vitrine debout ≈ 1,80 m : dépasse la hauteur utile de ${height.toFixed(2)} m.`,
      );
    if (key === 'armoire' && !item.dismantle && height && height < 2)
      warnings.push(
        `Armoire montée ≈ 2 m : ne rentre pas debout dans ce véhicule (${height.toFixed(2)} m utiles). À coucher ou démonter.`,
      );
    if (key === 'salon' && !item.dismantle && length) {
      const itemLength = item.size >= 6 ? 2.6 : item.size >= 3 ? 2.1 : 1.6;
      if (itemLength > length)
        warnings.push(
          `Salon ≈ ${itemLength.toFixed(1)} m : dépasse la longueur utile du plancher (${length.toFixed(1)} m).`,
        );
    }
    if (key === 'table-manger' && !item.dismantle && length) {
      const itemLength = item.size >= 8 ? 2.2 : item.size >= 6 ? 1.8 : 1.2;
      if (itemLength > length)
        warnings.push(
          `Table ≈ ${itemLength.toFixed(1)} m : dépasse la longueur utile du plancher (${length.toFixed(1)} m).`,
        );
    }
  });
  return [...new Set(warnings)];
}

export function movingEstimateNote(estimate: MovingEstimate): string {
  const vehicleName = estimate.vehicleName.replace(/^(Mercedes|Renault)\s+/u, '');
  return [
    `Estimation des allers-retours : volume ≈ ${estimate.volume.toFixed(1).replace('.', ',')} m³, soit ${estimate.plannedTrips} aller-retour${estimate.plannedTrips > 1 ? 's' : ''} en ${vehicleName}.`,
    `Main-d’œuvre : ${estimate.crew} manœuvre${estimate.crew > 1 ? 's' : ''}${estimate.carpenterCount ? ` + ${estimate.carpenterCount} menuisier${estimate.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ≈ ${formatDuration(estimate.loadingMinutes + estimate.unloadingMinutes)}.`,
    ...(estimate.packingMinutes > 0
      ? [
          `Emballage : ≈ ${formatDuration(estimate.packingMinutes)}${estimate.packingMinutes > 90 ? ', la veille.' : ', le jour même avant le chargement.'}`,
        ]
      : []),
    ...(estimate.travelMinutes > 0
      ? [
          `Trajet : ≈ ${formatDuration(estimate.travelMinutes)} pour ${estimate.plannedTrips} voyage${estimate.plannedTrips > 1 ? 's' : ''}.`,
        ]
      : []),
    `Planning prévisionnel : de ${estimate.startTime} à ${estimate.endTime}, durée ≈ ${formatDuration(estimate.totalMinutes)} (entre ${formatDuration(estimate.lowDurationMinutes)} et ${formatDuration(estimate.highDurationMinutes)}).`,
    ...(estimate.minimumDays > 1
      ? [
          `Durée à organiser sur environ ${estimate.minimumDays} jours ou avec un véhicule supplémentaire.`,
        ]
      : []),
  ].join('\n');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return Math.ceil(minutes) + ' min';
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? hours + ' h ' + remaining.toString().padStart(2, '0') : hours + ' h';
}
