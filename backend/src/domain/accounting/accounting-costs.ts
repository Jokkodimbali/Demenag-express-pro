import type { AccountingFinanceConfiguration, Booking, Price, Quote } from '../shared/model.js';
import referenceAssemblyPayrollDefaults from '../../../../shared/reference-assembly-payroll-prices.js';

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
  config: Pick<AccountingFinanceConfiguration, 'menuPrices'> | null,
  key: string,
  origin: 'local' | 'import',
  size?: number,
) {
  const normalizedKey = aliases[key] ?? key;
  const prices =
    config?.menuPrices?.[normalizedKey] ?? referenceAssemblyPayrollDefaults[normalizedKey];
  const sized = size == null ? undefined : prices?.sz?.[String(size)]?.[origin];
  if (sized != null) return asInt(sized);
  return asInt(prices?.[origin] ?? (origin === 'import' ? 10_000 : 5_000));
}

function customMenuUnitPrice(
  config: Pick<AccountingFinanceConfiguration, 'menuPrices'> | null,
  custom: {
    mp?: number;
    menuPriceLocal?: number;
    menuPriceImport?: number;
    typeKey?: string;
    like?: string;
  },
  origin: 'local' | 'import',
) {
  if (Number(custom.mp) > 0) return asInt(Number(custom.mp));
  const savedPrice = origin === 'import' ? custom.menuPriceImport : custom.menuPriceLocal;
  if (savedPrice != null) return asInt(savedPrice);
  return menuUnitPrice(config, custom.typeKey ?? custom.like ?? 'custom', origin);
}

export function captureAccountingCosts(
  booking: Booking,
  price: Price,
  config: Pick<AccountingFinanceConfiguration, 'menuPrices' | 'moverCostPerMove'> | null,
  billingMode?: Quote['billingMode'],
  providedCrew?: number,
) {
  const source = booking.inventorySnapshot?.sourceInventory;
  const movers =
    billingMode === 'driver-rental'
      ? 0
      : booking.crew?.manoeuvre.length ||
        (providedCrew && providedCrew > 0 ? providedCrew : 0) ||
        source?.crew ||
        booking.inventorySnapshot?.moverCount ||
        price.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
        booking.estimate.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
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
    custom?: {
      mp?: number;
      menuPriceLocal?: number;
      menuPriceImport?: number;
      typeKey?: string;
      like?: string;
    },
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
    const itemOrigin = origin ?? 'local';
    const unitPrice =
      normalized === 'custom' && custom
        ? customMenuUnitPrice(config, custom, itemOrigin)
        : menuUnitPrice(config, normalized, itemOrigin, sized);
    carpenterAmount += quantity * unitPrice;
  };
  for (const [key, item] of Object.entries(source?.entries ?? {}))
    add(key, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  for (const item of source?.variants ?? [])
    add(item.itemKey, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  for (const item of source?.custom ?? [])
    add('custom', item.quantity, 1, item.origin, !!item.dismantle, false, item);
  return {
    movers,
    moverAmount: asInt(movers * (config?.moverCostPerMove ?? 5_000)),
    carpenters,
    carpenterAmount: asInt(carpenterAmount),
  };
}

export function accountingCostsForQuote(
  booking: Booking,
  quote: Pick<Quote, 'price' | 'billingMode' | 'accountingCosts' | 'providedCrew'>,
  config: Pick<AccountingFinanceConfiguration, 'menuPrices' | 'moverCostPerMove'> | null,
) {
  const costs =
    quote.accountingCosts ??
    captureAccountingCosts(booking, quote.price, config, quote.billingMode, quote.providedCrew);
  return quote.billingMode === 'driver-rental' ? { ...costs, movers: 0, moverAmount: 0 } : costs;
}
