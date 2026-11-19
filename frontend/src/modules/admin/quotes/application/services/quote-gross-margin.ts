import type { AccountingFinanceConfiguration, Quote } from '../../../../shared/domain/model';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import { accountingMenuPrice } from '../../../accounting/domain/accounting-forecast';

type QuoteAccountingCosts = NonNullable<Quote['accountingCosts']>;

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

function quoteAccountingCosts(input: {
  inventory: Inventory;
  accounting: AccountingFinanceConfiguration;
  billingMode: Quote['billingMode'];
  providedCrew: number;
  manoeuvreCount: number;
}): QuoteAccountingCosts {
  const { inventory, accounting, billingMode, providedCrew, manoeuvreCount } = input;
  const movers =
    billingMode === 'driver-rental'
      ? 0
      : Math.max(0, Math.round(providedCrew || inventory.crew || manoeuvreCount));
  let carpenters = 0;
  let carpenterAmount = 0;

  const addCarpenterCost = (
    key: string,
    quantity: number,
    size: number,
    origin: 'local' | 'import' | undefined,
    dismantle: boolean,
    menuisier: boolean,
    custom?: Inventory['custom'][number],
  ) => {
    const normalized = aliases[key] ?? key;
    if (
      quantity <= 0 ||
      normalized === 'clim' ||
      !(dismantle || (['salon', 'chaise'].includes(normalized) && menuisier))
    )
      return;

    const itemOrigin = origin ?? 'local';
    const sized = sizedItems.has(normalized) ? size : undefined;
    const unitPrice =
      normalized === 'custom' && custom
        ? Number(custom.mp) > 0
          ? Math.round(Number(custom.mp))
          : ((itemOrigin === 'import' ? custom.menuPriceImport : custom.menuPriceLocal) ??
            accountingMenuPrice(accounting, custom.typeKey ?? custom.like ?? 'custom', itemOrigin))
        : accountingMenuPrice(accounting, normalized, itemOrigin, sized);
    carpenters += quantity;
    carpenterAmount += quantity * unitPrice;
  };

  for (const [key, item] of Object.entries(inventory.entries)) {
    addCarpenterCost(key, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  }
  for (const item of inventory.variants) {
    addCarpenterCost(
      item.itemKey,
      item.quantity,
      item.size,
      item.origin,
      item.dismantle,
      !!item.menuisier,
    );
  }
  for (const item of inventory.custom) {
    addCarpenterCost('custom', item.quantity, 1, item.origin, !!item.dismantle, false, item);
  }

  return {
    movers,
    moverAmount: Math.max(0, Math.round(movers * accounting.moverCostPerMove)),
    carpenters,
    carpenterAmount: Math.max(0, Math.round(carpenterAmount)),
  };
}

export function quoteGrossMargin(input: {
  quoteTotal: number | null;
  hasBillableContent: boolean;
  inventory: Inventory;
  accounting: AccountingFinanceConfiguration | null;
  billingMode: Quote['billingMode'];
  providedCrew: number;
  manoeuvreCount: number;
  taxiCharges: number;
  nightWorkCharge?: number;
}): number | null {
  const { quoteTotal, hasBillableContent, accounting, taxiCharges, nightWorkCharge = 0 } = input;
  if (!hasBillableContent || quoteTotal == null || !accounting) return null;
  const costs = quoteAccountingCosts({ ...input, accounting });
  return quoteTotal - costs.moverAmount - costs.carpenterAmount - taxiCharges - nightWorkCharge;
}
