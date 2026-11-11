import type {
  Booking,
  CustomInventoryType,
  MovingLaborPlanningSettings,
  Options,
  Point,
  Vehicle,
} from '../../../shared/domain/model';
import {
  estimatedInventoryItemVolume,
  estimateMovingWork,
} from '../../../moving/domain/estimate/moving-estimate';
import { referenceAnnexVolume } from '../../../moving/domain/estimate/reference-inventory-note';
import { assemblyCount } from '../../../moving/domain/inventory/inventory-count';
import {
  blankInventory,
  inventoryItems,
  type Inventory,
} from '../../../moving/domain/inventory/inventory';

export function assemblyLimitError(
  next: Inventory,
  current: Inventory,
  options: Options,
  maximum: number,
) {
  const exceedsLimit = (['desk', 'wardrobe', 'bed'] as const).some((key) => {
    const nextValue = options[key] + assemblyCount(next, key) - assemblyCount(current, key);
    return nextValue < 0 || nextValue > maximum;
  });
  return exceedsLimit
    ? `Le maximum de ${maximum} montages par type est atteint. Ajustez les options avant de continuer.`
    : undefined;
}

export function reconcileAssemblyOptions(
  options: Options,
  next: Inventory,
  current: Inventory,
  maximum: number,
  crewEstimate?: number,
): Options {
  const updated = { ...options };
  for (const key of ['desk', 'wardrobe', 'bed'] as const) {
    const difference = assemblyCount(next, key) - assemblyCount(current, key);
    updated[key] = Math.max(0, Math.min(maximum, updated[key] + difference));
  }
  if (crewEstimate !== undefined) updated.labour = crewEstimate;
  return updated;
}

export function clearInventoryAndAssemblyOptions(options: Options, inventory: Inventory) {
  const updated = { ...options };
  for (const key of ['desk', 'wardrobe', 'bed'] as const)
    updated[key] = Math.max(0, updated[key] - assemblyCount(inventory, key));
  return { inventory: blankInventory(), options: updated };
}

export function addCustomInventoryItem(inventory: Inventory, label: string, id: string): Inventory {
  const normalizedLabel = label.trim().toLowerCase();
  if (!normalizedLabel) return inventory;
  return {
    ...inventory,
    custom: [
      ...inventory.custom,
      {
        id,
        label: normalizedLabel,
        quantity: 1,
        format: 'medium',
        dismantle: false,
        origin: 'local',
      },
    ],
  };
}

export function addCustomInventoryType(
  inventory: Inventory,
  type: CustomInventoryType,
  id: string,
): Inventory {
  const current = inventory.custom.find((item) => item.typeKey === type.k);
  if (current)
    return {
      ...inventory,
      custom: inventory.custom.map((item) =>
        item.id === current.id ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item,
      ),
    };
  return {
    ...inventory,
    custom: [
      ...inventory.custom,
      {
        id,
        typeKey: type.k,
        label: type.n.trim().toLocaleLowerCase('fr-FR'),
        quantity: 1,
        format: 'medium',
        dismantle: Boolean(type.dm),
        origin: 'local',
        cL: Number(type.L) || undefined,
        cW: Number(type.W) || undefined,
        cH: Number(type.H) || undefined,
        kg: Number(type.kg) || undefined,
        menuPriceLocal: Number(type.menuPriceLocal) || undefined,
        menuPriceImport: Number(type.menuPriceImport) || undefined,
        like: type.like || undefined,
        up: Boolean(type.up),
        frag: Boolean(type.frag),
        notop: Boolean(type.notop),
      },
    ],
  };
}

export function inventoryEntryWithPatch(
  inventory: Inventory,
  key: string,
  patch: Partial<Inventory['entries'][string]>,
): Inventory {
  const item = inventoryItems.find((entry) => entry.key === key);
  const current = inventory.entries[key] ?? {
    quantity: 0,
    size: item?.defaultSize ?? 1,
    format: 'medium' as const,
    dismantle: Boolean(item?.defaultDismantle),
  };
  return { ...inventory, entries: { ...inventory.entries, [key]: { ...current, ...patch } } };
}

export function estimateCallInventory(input: {
  inventory: Inventory;
  vehicle?: Vehicle;
  route: { distanceKm: number; durationMinutes: number; geometry?: Point[] } | null;
  trips?: number;
  startTime: string;
  laborPlanning?: MovingLaborPlanningSettings;
  fromAddress: string;
  toAddress: string;
  date: string;
  month: string;
  ignoreTraffic?: boolean;
  manualLegMinutes?: number;
  hasToll?: boolean;
  heatOff?: boolean;
  heatRest?: number;
}) {
  if (!input.vehicle) return null;
  return estimateMovingWork(input.inventory, input.vehicle, input.route, {
    ...(input.trips === undefined ? {} : { trips: input.trips }),
    crew: input.inventory.crew,
    startTime: input.startTime,
    laborPlanning: input.laborPlanning,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    date: input.date,
    month: input.month,
    ignoreTraffic: input.ignoreTraffic,
    manualLegMinutes: input.manualLegMinutes,
    hasToll: input.hasToll,
    heatOff: input.heatOff,
    heatRest: input.heatRest,
  });
}

export function summarizeCallInventory(inventory: Inventory) {
  const total =
    Object.values(inventory.entries).reduce((sum, item) => sum + item.quantity, 0) +
    inventory.variants.reduce((sum, item) => sum + item.quantity, 0) +
    inventory.custom.reduce((sum, item) => sum + item.quantity, 0);
  const annexVolume = referenceAnnexVolume(inventory);
  const countedObjectVolume =
    Object.entries(inventory.entries).reduce(
      (sum, [key, entry]) =>
        sum +
        estimatedInventoryItemVolume(key, entry.size, Boolean(entry.dismantle), entry.format) *
          entry.quantity,
      0,
    ) +
    inventory.variants.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume(
          item.itemKey,
          item.size,
          Boolean(item.dismantle),
          item.format,
        ) *
          item.quantity,
      0,
    ) +
    inventory.custom.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume('custom', 1, Boolean(item.dismantle), item.format) *
          item.quantity,
      0,
    );
  const quantityOf = (key: string) =>
    (inventory.entries[key]?.quantity ?? 0) +
    inventory.variants
      .filter((item) => item.itemKey === key)
      .reduce((sum, item) => sum + item.quantity, 0);
  const inventoryChecks = [
    ...(quantityOf('lit') > quantityOf('matelas')
      ? [
          `${quantityOf('lit') - quantityOf('matelas')} lit(s) sans matelas compté : ajoutez-les si le client les emporte.`,
        ]
      : []),
    ...(quantityOf('table-manger') > 0 && quantityOf('chaise') === 0
      ? ['Table à manger sans chaises : à vérifier avec le client.']
      : []),
    ...(!inventory.ready ? ['Demandez si le matériel sera prêt à être chargé.'] : []),
    ...(!inventory.stairs ? ['Demandez si tout le matériel passe dans les escaliers.'] : []),
    ...(inventory.stairs === 'non'
      ? ['Objets qui ne passent pas les escaliers : prévoir démontage, corde ou monte-meuble.']
      : []),
    ...(inventory.stairs === 'balcon'
      ? ['Passage par le balcon : prévoir et chiffrer le supplément correspondant.']
      : []),
    ...(!inventory.dwellingType
      ? [
          "Type de logement non précisé : les sacs d'habits, la vaisselle et le linge ne sont pas estimés.",
        ]
      : []),
  ];
  const volumeDetail = `Meubles et objets comptés ≈ ${countedObjectVolume.toFixed(1).replace('.', ',')} m³${annexVolume > 0 ? ` · effets annexes ≈ ${annexVolume.toFixed(1).replace('.', ',')} m³` : ''}`;
  return { total, annexVolume, countedObjectVolume, volumeDetail, inventoryChecks, quantityOf };
}

export function historicalInventorySizeMaximum(bookings: readonly Booking[]) {
  const maximum: Record<string, number> = {};
  for (const booking of bookings) {
    const source = booking.inventorySnapshot?.sourceInventory;
    if (!source) continue;
    for (const [key, entry] of Object.entries(source.entries))
      maximum[key] = Math.max(maximum[key] ?? 0, entry.size);
    for (const entry of source.variants)
      maximum[entry.itemKey] = Math.max(maximum[entry.itemKey] ?? 0, entry.size);
  }
  return maximum;
}
