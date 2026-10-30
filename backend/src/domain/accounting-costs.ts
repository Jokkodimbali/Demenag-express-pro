import type { AccountingFinanceConfiguration, Booking, Price } from './model.js';

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
const sizedItems = new Set(['salon', 'tablem', 'lit', 'matelas', 'armoire']);
const asInt = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

function menuUnitPrice(
  config: AccountingFinanceConfiguration | null,
  key: string,
  origin: 'local' | 'import',
  size?: number,
) {
  const prices = config?.menuPrices?.[aliases[key] ?? key];
  const sized = size == null ? undefined : prices?.sz?.[String(size)]?.[origin];
  if (sized != null) return asInt(sized);
  return asInt(prices?.[origin] ?? (origin === 'import' ? 10_000 : 5_000));
}

export function captureAccountingCosts(
  booking: Booking,
  price: Price,
  config: AccountingFinanceConfiguration | null,
) {
  const source = booking.inventorySnapshot?.sourceInventory;
  const movers =
    booking.crew?.manoeuvre.length ||
    price.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
    booking.estimate.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
    source?.crew ||
    0;
  let carpenters = 0;
  let carpenterAmount = 0;
  const add = (
    key: string,
    quantity: number,
    size: number,
    origin: 'local' | 'import' | undefined,
    dismantle: boolean,
    menuisier: boolean,
  ) => {
    const normalized = aliases[key] ?? key;
    if (
      quantity <= 0 ||
      normalized === 'clim' ||
      !(dismantle || (['salon', 'chaise'].includes(normalized) && menuisier))
    )
      return;
    const sized = sizedItems.has(normalized) ? size : undefined;
    carpenters += quantity;
    carpenterAmount += quantity * menuUnitPrice(config, normalized, origin ?? 'local', sized);
  };
  for (const [key, item] of Object.entries(source?.entries ?? {}))
    add(key, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  for (const item of source?.variants ?? [])
    add(item.itemKey, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  for (const item of source?.custom ?? [])
    add('custom', item.quantity, 1, item.origin, !!item.dismantle, false);
  return {
    movers,
    moverAmount: asInt(movers * (config?.moverCostPerMove ?? 5_000)),
    carpenters,
    carpenterAmount: asInt(carpenterAmount),
  };
}
