import type { BookingInventorySource, Options, Settings } from '../../../shared/domain/model';
import { inventoryItems } from './inventory';
import { assemblyUnitPrice } from '../pricing/labour-price';

export const referenceInventoryAliases: Record<string, string> = {
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

export const referenceInventoryKey = (key: string) => referenceInventoryAliases[key] ?? key;

type AssemblyLine = { label: string; quantity: number; unitPrice: number };

export function inventoryAssemblyLines(
  inventory: BookingInventorySource | undefined,
  settings: Settings,
): AssemblyLine[] {
  if (!inventory) return [];
  const grouped = new Map<string, AssemblyLine>();
  const append = (
    key: string,
    label: string,
    quantity: number,
    size: number,
    origin: 'local' | 'import',
    defaultSize = 1,
    sizeLabel?: string,
  ) => {
    if (quantity <= 0 || key === 'clim' || key === 'climatiseur') return;
    const normalizedKey = referenceInventoryKey(key);
    const sizedLabel = sizeLabel
      ? ` ${size} ${size === 1 ? sizeLabel.replace(/s$/u, '') : sizeLabel}`
      : '';
    const originLabel = origin === 'import' ? ' (importé)' : ' (local)';
    const groupKey = `${normalizedKey}|${normalizedKey === 'custom' ? label.trim().toLocaleLowerCase('fr-FR') : ''}|${sizeLabel ? size : ''}|${origin}`;
    const current = grouped.get(groupKey);
    if (current) {
      current.quantity += quantity;
      return;
    }
    grouped.set(groupKey, {
      label: `Menuisier · démontage / montage ${label}${sizedLabel}${originLabel}`,
      quantity,
      unitPrice: assemblyUnitPrice(
        settings,
        normalizedKey,
        origin,
        sizeLabel ? size : undefined,
        defaultSize,
      ),
    });
  };

  for (const item of inventoryItems) {
    const entry = inventory.entries[item.key];
    if (entry && (entry.dismantle || (['salon', 'chaise'].includes(item.key) && entry.menuisier)))
      append(
        item.key,
        item.label.toLocaleLowerCase('fr-FR'),
        entry.quantity,
        entry.size,
        entry.origin ?? 'local',
        item.defaultSize ?? 1,
        item.sizeLabel,
      );
    for (const variant of inventory.variants.filter(
      (candidate) => candidate.itemKey === item.key,
    )) {
      if (!variant.dismantle && !(['salon', 'chaise'].includes(item.key) && variant.menuisier))
        continue;
      append(
        item.key,
        item.label.toLocaleLowerCase('fr-FR'),
        variant.quantity,
        variant.size,
        variant.origin ?? 'local',
        item.defaultSize ?? 1,
        item.sizeLabel,
      );
    }
  }
  for (const item of inventory.custom) {
    if (!item.dismantle) continue;
    const origin = item.origin ?? 'local';
    append('custom', item.label.trim() || 'autre objet', item.quantity, 1, origin, 1, undefined);
  }
  return [...grouped.values()];
}

export function inventoryAssemblyOptions(inventory: BookingInventorySource | undefined): Options {
  const counts: Options = { labour: 0, desk: 0, wardrobe: 0, bed: 0 };
  if (!inventory) return counts;
  for (const item of inventoryItems) {
    if (!item.assembly) continue;
    const count = inventory.entries[item.key]?.dismantle ? inventory.entries[item.key].quantity : 0;
    counts[item.assembly] += count;
    for (const variant of inventory.variants) {
      if (variant.itemKey === item.key && variant.dismantle)
        counts[item.assembly] += variant.quantity;
    }
  }
  return counts;
}

export function subtractInventoryAssemblyOptions(
  options: Options,
  inventory: BookingInventorySource | undefined,
): Options {
  const included = inventoryAssemblyOptions(inventory);
  return {
    ...options,
    desk: Math.max(0, options.desk - included.desk),
    wardrobe: Math.max(0, options.wardrobe - included.wardrobe),
    bed: Math.max(0, options.bed - included.bed),
  };
}
