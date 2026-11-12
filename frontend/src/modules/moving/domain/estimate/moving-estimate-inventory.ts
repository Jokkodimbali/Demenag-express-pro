import { inventoryItems, type Inventory, type InventoryFormat } from '../inventory/inventory';
import type { Vehicle } from '../../../shared/domain/model';

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

export const dwellingVolumes: Record<string, number> = {
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

export const customItemVolume = (item: Inventory['custom'][number]) => {
  if ([item.cL, item.cW, item.cH].every((value) => Number(value) > 0)) {
    return ((item.cL! * item.cW! * item.cH!) / 1_000_000) * (item.dismantle ? 0.8 : 1);
  }
  if (item.like && inventoryItems.some((definition) => definition.key === item.like)) {
    const definition = inventoryItems.find((candidate) => candidate.key === item.like);
    return estimatedInventoryItemVolume(
      item.like,
      definition?.defaultSize ?? 1,
      Boolean(item.dismantle),
      item.format,
    );
  }
  return estimatedInventoryItemVolume('custom', 1, Boolean(item.dismantle), item.format);
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

export const itemVolume = estimatedInventoryItemVolume;

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

export function inventoryWeight(inventory: Inventory, annexVolume: number) {
  let total = 0;
  let max = 0;
  let largestHandlingCrew = 1;
  let itemsAtLargestHandlingCrew = 0;
  const stairAccess =
    (inventory.fromFloor > 0 && !inventory.fromLift) ||
    (inventory.toFloor > 0 && !inventory.toLift);
  const needs = (
    key: string,
    maxKg: number,
    size: number,
    dismantle: boolean,
    format: InventoryFormat,
    forceTwoPerson = false,
  ) => {
    const handlingWeight = Math.round(maxKg || 0);
    const itemCount = Math.min(4, Math.max(1, Math.ceil(handlingWeight / 25)));
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
    if (kind === 'mattress') count = (size || 2) >= 2 ? 2 : 1;
    if (kind === 'table') count = dismantle ? Math.max(1, count) : Math.max(2, count);
    if (kind === 'tv') count = handlingWeight > 15 || format === 'large' ? 2 : 1;
    if (kind === 'single') count = 1;
    if (kind === 'roll') count = handlingWeight > 25 ? 2 : 1;
    if (forceTwoPerson) count = Math.max(2, count);
    if (stairAccess && handlingWeight > 33 && ['appliance', 'case'].includes(kind))
      count = Math.min(4, count + 1);
    if (count > largestHandlingCrew) {
      largestHandlingCrew = count;
      itemsAtLargestHandlingCrew = 1;
    } else if (count === largestHandlingCrew) {
      itemsAtLargestHandlingCrew += 1;
    }
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
    needs(key, weight.max, size, dismantle, format);
  };
  Object.entries(inventory.entries).forEach(([key, item]) =>
    consume(key, item.quantity, item.size, item.format ?? 'medium', item.dismantle),
  );
  inventory.variants.forEach((item) =>
    consume(item.itemKey, item.quantity, item.size, item.format ?? 'medium', item.dismantle),
  );
  inventory.custom.forEach((item) => {
    if (item.quantity <= 0) return;
    const likeKey =
      item.like && inventoryItems.some((definition) => definition.key === item.like)
        ? item.like
        : 'custom';
    const assumedWeight = referenceLineWeight(
      likeKey,
      1,
      item.format ?? 'medium',
      Boolean(item.dismantle),
    );
    const itemWeight =
      Number(item.kg) > 0 ? { total: Number(item.kg), max: Number(item.kg) } : assumedWeight;
    total += itemWeight.total * item.quantity;
    max = Math.max(max, itemWeight.max);
    needs(
      likeKey,
      itemWeight.max,
      1,
      Boolean(item.dismantle),
      item.format ?? 'medium',
      (Boolean(item.frag) && itemWeight.max > 15) ||
        Boolean(item.cL && item.cW && item.cH && Math.max(item.cL, item.cW, item.cH) > 180),
    );
  });
  total += Math.round(annexVolume * 110);
  return {
    total: Math.round(total),
    max,
    largestHandlingCrew,
    itemsAtLargestHandlingCrew,
  };
}

export function vehicleCapacity(vehicle: Vehicle): number {
  return numberFrom(vehicle.volume) || 10;
}

type VolumeGroups = {
  light: number;
  furniture: number;
  bulky: number;
  heavy: number;
  boxes: number;
};

export function inventoryVolumes(inventory: Inventory): VolumeGroups {
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
    groups.furniture += customItemVolume(item) * item.quantity;
  });
  const homeVolume =
    inventory.annexOn === false ? 0 : (dwellingVolumes[inventory.dwellingType] ?? 0);
  groups.light += Math.max(0, homeVolume - groups.boxes);
  return groups;
}

export function formatTime(minutes: number): string {
  const rounded = Math.round(minutes / 5) * 5;
  return `${String(Math.floor(rounded / 60) % 24).padStart(2, '0')}:${String(rounded % 60).padStart(
    2,
    '0',
  )}`;
}

export function startMinutes(value: string, defaultHour = 8): number {
  const match = /(?:^|\D)(\d{1,2})[:h](\d{2})?/iu.exec(value);
  if (!match) return defaultHour * 60;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

export function roundFive(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}
