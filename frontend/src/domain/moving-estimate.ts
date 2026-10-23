import { inventoryItems, type Inventory, type InventoryFormat } from './inventory';
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
const sizeVolumes: Record<string, [number, number, number]> = {
  'table-basse': [0.25, 0.4, 0.6],
  'meuble-tv': [0.35, 0.6, 1],
  television: [0.15, 0.25, 0.4],
  buffet: [1, 1.5, 2.2],
  bibliotheque: [0.6, 1.2, 2],
  vitrine: [0.6, 1.2, 1.8],
  tapis: [0.05, 0.15, 0.3],
  coiffeuse: [0.4, 0.6, 1],
  commode: [0.5, 0.7, 1.1],
  chevet: [0.1, 0.2, 0.3],
  bureau: [0.5, 0.9, 1.5],
  frigo: [0.35, 1, 1.8],
  congelateur: [0.5, 0.9, 1.2],
  cuisiniere: [0.25, 0.6, 0.9],
  'machine-laver': [0.4, 0.5, 0.6],
  climatiseur: [0.25, 0.4, 0.7],
  carton: [0.04, 0.07, 0.12],
  chaise: [0.05, 0.25, 0.4],
  sac: [0.05, 0.1, 0.15],
  velo: [0.3, 0.5, 0.7],
  pot: [0.05, 0.15, 0.4],
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
const numberFrom = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;

function itemVolume(
  key: string,
  size: number,
  dismantle: boolean,
  format: InventoryFormat = 'medium',
) {
  const base = itemVolumes[key] ?? 0.5;
  const definition = inventoryItems.find((item) => item.key === key);
  const volume = definition?.sizeLabel
    ? base * Math.max(1, size)
    : (sizeVolumes[key]?.[formatIndexes[format]] ?? base);
  const nonStackable = key === 'salon' ? 1.25 : 1;
  const dismantleFactor = dismantle ? (dismantleFactors[key] ?? 0.8) : 1;
  return volume * nonStackable * dismantleFactor;
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
    const volume = [0.3, 0.5, 0.8][formatIndexes[item.format ?? 'medium']] * item.quantity;
    groups.furniture += volume;
  });
  const homeVolume = dwellingVolumes[inventory.dwellingType] ?? 0;
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
function startMinutes(value: string): number {
  const match = /(?:^|\D)(\d{1,2})[:h](\d{2})?/iu.exec(value);
  if (!match) return 8 * 60;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}
function roundFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export type PlanningStep = { time: string; title: string; detail: string; minutes: number };
export type MovingEstimate = {
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
  minimumDays: number;
  startTime: string;
  endTime: string;
  planning: PlanningStep[];
  warnings: string[];
  warning: string | null;
};
type EstimateOptions = { trips?: number; crew?: number; startTime?: string };

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
  const capacityPerWorker = (category: keyof VolumeGroups, unloading = false) => {
    const factor = { light: 1.4, furniture: 1, bulky: 1.2, heavy: 0.72, boxes: 1.4 }[category];
    return 2.5 * factor * (unloading ? 1.2 : 1);
  };
  const siteHours = (floor: number, lift: boolean, unloading = false) => {
    const floorFactor = (category: keyof VolumeGroups) => {
      if (floor <= 0) return 1;
      const stairRate = { light: 0.1, furniture: 0.15, bulky: 0.2, heavy: 0.25, boxes: 0.1 }[
        category
      ];
      const liftRate = { light: 0.03, furniture: 0.05, bulky: 0.15, heavy: 0.08, boxes: 0.03 }[
        category
      ];
      return lift
        ? 1.05 + liftRate * floor
        : 1 + stairRate * floor * (inventory.flags.escalier ? 1.4 : 1);
    };
    const carryingDifficulty =
      (inventory.flags.acces ? 1.2 : 1) * (inventory.flags.fragile ? 1.1 : 1);
    return (
      carryingDifficulty *
      ((groups.light * floorFactor('light')) / capacityPerWorker('light', unloading) +
        (groups.furniture * floorFactor('furniture')) / capacityPerWorker('furniture', unloading) +
        (groups.bulky * floorFactor('bulky')) / capacityPerWorker('bulky', unloading) +
        (groups.heavy * floorFactor('heavy')) / capacityPerWorker('heavy', unloading))
    );
  };
  const heavyCount = Object.entries(inventory.entries).reduce(
    (count, [key, item]) =>
      count +
      (['frigo', 'congelateur', 'cuisiniere', 'machine-laver'].includes(key) && !item.dismantle
        ? item.quantity
        : 0),
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
  const assemblyHours = Object.entries(inventory.entries).reduce((sum, [key, entry]) => {
    const item = inventoryItems.find((candidate) => candidate.key === key);
    if (!entry.dismantle || !item?.assembly) return sum;
    const base = item.assembly === 'bed' ? 0.35 : 0.25;
    const multiplier = item.assembly === 'wardrobe' ? entry.size : 1;
    return sum + base * multiplier * entry.quantity;
  }, 0);
  const packingMinutes = inventory.flags.emballage
    ? (0.45 * groups.light + 0.1 * (groups.furniture + groups.bulky + groups.heavy)) * 60
    : 0;
  const routeMinutes = route?.durationMinutes ?? 0;
  const legLoaded = routeMinutes ? 10 + routeMinutes * 1.05 : 0;
  const legEmpty = routeMinutes ? 10 + routeMinutes * 0.85 : 0;
  const journeyCount = requestedTrips;
  let recommendedCrew = minimumCrew;
  const handlingWithCrew = (crew: number) =>
    loadingBase / efficiency(crew) + unloadingBase / efficiency(crew) + assemblyHours;
  while (handlingWithCrew(recommendedCrew) > 3 && recommendedCrew < 6) recommendedCrew++;
  const crew = Math.min(20, Math.max(1, options.crew || recommendedCrew));
  const loadingMinutes = (loadingBase / efficiency(crew) + assemblyHours / 2) * 60;
  const unloadingMinutes = (unloadingBase / efficiency(crew) + assemblyHours / 2) * 60;
  const packingOnPreviousDay = packingMinutes > 90;
  const driveMinutes = journeyCount * legLoaded + Math.max(0, journeyCount - 1) * legEmpty;
  const activeWorkMinutes =
    25 +
    (packingOnPreviousDay ? 0 : packingMinutes) +
    loadingMinutes +
    unloadingMinutes +
    driveMinutes;
  const pauseMinutes = activeWorkMinutes > 300 ? 30 : 0;
  const totalMinutes = activeWorkMinutes + pauseMinutes;
  const startAt = startMinutes(options.startTime ?? '');
  const planning: PlanningStep[] = [];
  const addStep = (title: string, detail: string, minutes: number) =>
    planning.push({ time: '', title, detail, minutes: roundFive(minutes) });
  addStep('Arrivée au départ', 'Stationnement, protection des sols et des portes', 15);
  if (packingMinutes > 0 && !packingOnPreviousDay)
    addStep('Emballage', 'Cartons, film et couvertures', packingMinutes);
  if (journeyCount <= 1) {
    addStep('Chargement', `${crew} manœuvres · démontage des meubles sélectionnés`, loadingMinutes);
    if (legLoaded)
      addStep(
        'Trajet vers l’arrivée',
        `${route?.distanceKm.toLocaleString('fr-FR') ?? ''} km, stationnement compris`,
        legLoaded,
      );
    addStep('Déchargement', `${crew} manœuvres · remontage prévu`, unloadingMinutes);
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
  const endAt = cursor;
  const warnings: string[] = [];
  if (handlingWithCrew(crew) > 3)
    warnings.push(
      `Chargement et déchargement dépassent le plafond conseillé de 3 h avec ${crew} manœuvres.`,
    );
  if (totalMinutes > 8 * 60)
    warnings.push(
      'La durée dépasse 8 h : prévoir un départ plus tôt, un véhicule supplémentaire ou deux jours.',
    );
  if (endAt > 19 * 60)
    warnings.push('Fin après 19 h : commencer plus tôt ou répartir sur 2 jours.');
  if (routeMinutes <= 0)
    warnings.push('Placez les deux points sur la carte pour calculer le trajet.');
  const dimensionsWarnings = vehicleWarnings(inventory, vehicle);
  warnings.push(...dimensionsWarnings);
  const carpenterCount =
    Object.entries(inventory.entries).reduce((count, [key, entry]) => {
      const item = inventoryItems.find((candidate) => candidate.key === key);
      return count + (entry.dismantle && item?.assembly && entry.quantity ? 1 : 0);
    }, 0) > 0
      ? 1
      : 0;
  return {
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
    minimumDays: Math.max(1, Math.ceil(totalMinutes / (8 * 60))),
    startTime: formatTime(startAt),
    endTime: formatTime(endAt),
    planning,
    warnings,
    warning:
      volume === 0
        ? 'Renseignez les objets ou le type de logement pour calculer une estimation.'
        : (warnings[0] ?? null),
  };
}

function vehicleWarnings(inventory: Inventory, vehicle: Vehicle): string[] {
  const height = numberFrom(vehicle.height);
  const length = numberFrom(vehicle.length);
  const warnings: string[] = [];
  const entries = Object.entries(inventory.entries).filter(([, item]) => item.quantity > 0);
  entries.forEach(([key, item]) => {
    if (key === 'frigo') {
      const itemHeight = [0.85, 1.6, 1.85][formatIndexes[item.format ?? 'medium']];
      if (height && itemHeight > height)
        warnings.push(
          `Frigo debout ≈ ${itemHeight.toFixed(2)} m, hauteur utile ${height.toFixed(2)} m.`,
        );
    }
    if (key === 'vitrine' && item.format !== 'small' && height && height < 1.8)
      warnings.push('Vitrine debout ≈ 1,80 m : vérifier la hauteur utile du véhicule.');
    if (key === 'armoire' && !item.dismantle && height && height < 2)
      warnings.push('Armoire montée ≈ 2 m de haut : à coucher ou démonter.');
    if (key === 'salon' && !item.dismantle && length) {
      const itemLength = item.size >= 6 ? 2.6 : item.size >= 3 ? 2.1 : 1.6;
      if (itemLength > length)
        warnings.push(
          `Salon ≈ ${itemLength.toFixed(1)} m de long, plancher utile ${length.toFixed(1)} m.`,
        );
    }
    if (key === 'table-manger' && !item.dismantle && length) {
      const itemLength = item.size >= 8 ? 2.2 : item.size >= 6 ? 1.8 : 1.2;
      if (itemLength > length)
        warnings.push(
          `Table ≈ ${itemLength.toFixed(1)} m de long, plancher utile ${length.toFixed(1)} m.`,
        );
    }
  });
  return [...new Set(warnings)];
}

export function movingEstimateNote(estimate: MovingEstimate): string {
  return [
    `Estimation des allers-retours : ${estimate.volume.toFixed(1).replace('.', ',')} m³, ${estimate.plannedTrips} aller-retour${estimate.plannedTrips > 1 ? 's' : ''}.`,
    `Main-d’œuvre : ${estimate.crew} manœuvres, chargement ≈ ${formatDuration(estimate.loadingMinutes)}, déchargement ≈ ${formatDuration(estimate.unloadingMinutes)}${estimate.carpenterCount ? `, ${estimate.carpenterCount} menuisier(s)` : ''}.`,
    `Planning prévisionnel : ${estimate.startTime}–${estimate.endTime}, durée ≈ ${formatDuration(estimate.totalMinutes)}.`,
    ...estimate.planning.map(
      (step) =>
        `${step.time} · ${step.title} · ${formatDuration(step.minutes)}${step.detail ? ` (${step.detail})` : ''}`,
    ),
    ...estimate.warnings.map((warning) => `À vérifier : ${warning}`),
  ].join('\n');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return Math.ceil(minutes) + ' min';
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? hours + ' h ' + remaining.toString().padStart(2, '0') : hours + ' h';
}
