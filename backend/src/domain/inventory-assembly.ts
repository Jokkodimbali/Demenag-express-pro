import type { BookingInventorySource, Options, Settings } from './model.js';
import { assemblyUnitPrice } from './pricing.js';

const aliases: Record<string, string> = {
  'table-manger': 'tablem',
  bibliotheque: 'biblio',
  congelateur: 'congel',
  'machine-laver': 'mal',
  'micro-ondes': 'micro',
  climatiseur: 'clim',
  ventilateur: 'ventilo',
};
const labels: Record<string, string> = {
  salon: 'salon',
  'table-basse': 'table basse',
  tbasse: 'table basse',
  'meuble-tv': 'meuble TV',
  meubletv: 'meuble TV',
  television: 'télévision',
  tv: 'télévision',
  'table-manger': 'table à manger',
  tablem: 'table à manger',
  chaise: 'chaise',
  buffet: 'buffet',
  bibliotheque: 'bibliothèque',
  biblio: 'bibliothèque',
  vitrine: 'vitrine',
  tapis: 'tapis',
  lit: 'lit',
  matelas: 'matelas',
  armoire: 'armoire',
  coiffeuse: 'coiffeuse',
  commode: 'commode',
  chevet: 'table de chevet',
  bureau: 'bureau',
  frigo: 'frigo',
  congelateur: 'congélateur',
  congel: 'congélateur',
  cuisiniere: 'cuisinière',
  'machine-laver': 'machine à laver',
  mal: 'machine à laver',
  'micro-ondes': 'micro-ondes',
  micro: 'micro-ondes',
  climatiseur: 'climatiseur',
  clim: 'climatiseur',
  ventilateur: 'ventilateur',
  ventilo: 'ventilateur',
  gaz: 'bonbonne de gaz',
};
const sizeDefaults: Record<string, { size: string; default: number }> = {
  salon: { size: 'place', default: 5 },
  tablem: { size: 'place', default: 6 },
  lit: { size: 'place', default: 2 },
  matelas: { size: 'place', default: 2 },
  armoire: { size: 'battant', default: 3 },
};
const optionKeys = { bureau: 'desk', armoire: 'wardrobe', lit: 'bed' } as const;
type AssemblyLine = { label: string; quantity: number; unitPrice: number };

export function inventoryAssemblyLines(
  inventory: BookingInventorySource | undefined,
  settings: Settings,
): AssemblyLine[] {
  if (!inventory) return [];
  const grouped = new Map<string, AssemblyLine>();
  const append = (
    rawKey: string,
    rawLabel: string,
    quantity: number,
    size: number,
    origin: 'local' | 'import',
  ) => {
    const key = aliases[rawKey] ?? rawKey;
    if (quantity <= 0 || key === 'clim') return;
    const sizeMeta = sizeDefaults[key];
    const sized = sizeMeta ? ` ${size} ${size === 1 ? sizeMeta.size : `${sizeMeta.size}s`}` : '';
    const originLabel = origin === 'import' ? ' (importé)' : ' (local)';
    const groupKey = `${key}|${rawKey === 'custom' ? rawLabel.trim().toLocaleLowerCase('fr-FR') : ''}|${sizeMeta ? size : ''}|${origin}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    grouped.set(groupKey, {
      label: `Menuisier · démontage / montage ${rawLabel}${sized}${originLabel}`,
      quantity,
      unitPrice: assemblyUnitPrice(settings, key, origin, sizeMeta ? size : undefined, sizeMeta?.default ?? 1),
    });
  };
  for (const [key, entry] of Object.entries(inventory.entries)) {
    if (entry.dismantle || (['salon', 'chaise'].includes(key) && entry.menuisier))
      append(key, labels[key] ?? key, entry.quantity, entry.size, entry.origin ?? 'local');
  }
  for (const variant of inventory.variants) {
    if (variant.dismantle || (['salon', 'chaise'].includes(variant.itemKey) && variant.menuisier))
      append(variant.itemKey, labels[variant.itemKey] ?? variant.itemKey, variant.quantity, variant.size, variant.origin ?? 'local');
  }
  for (const item of inventory.custom) {
    if (item.dismantle)
      append('custom', item.label.trim() || 'autre objet', item.quantity, 1, item.origin ?? 'local');
  }
  return [...grouped.values()];
}

export function subtractInventoryAssemblyOptions(
  options: Options,
  inventory: BookingInventorySource | undefined,
): Options {
  if (!inventory) return options;
  const counts: Record<keyof typeof optionKeys, number> = { bureau: 0, armoire: 0, lit: 0 };
  for (const key of Object.keys(optionKeys) as (keyof typeof optionKeys)[]) {
    if (inventory.entries[key]?.dismantle) counts[key] += inventory.entries[key].quantity;
    for (const variant of inventory.variants) {
      if (variant.itemKey === key && variant.dismantle) counts[key] += variant.quantity;
    }
  }
  return {
    ...options,
    desk: Math.max(0, options.desk - counts.bureau),
    wardrobe: Math.max(0, options.wardrobe - counts.armoire),
    bed: Math.max(0, options.bed - counts.lit),
  };
}
