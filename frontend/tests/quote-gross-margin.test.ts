import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  Booking,
  AccountingFinanceConfiguration,
  Price,
} from '../src/modules/shared/domain/model.ts';
import { defaultAccountingFinanceConfiguration } from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import { quoteGrossMargin } from '../src/modules/admin/quotes/application/services/quote-gross-margin.ts';
import { captureAccountingCosts } from '../../backend/src/domain/accounting/accounting-costs.ts';

const defaultAccounting = defaultAccountingFinanceConfiguration(new Date('2026-11-18T12:00:00Z'));
const accounting = {
  ...defaultAccounting,
  moverCostPerMove: 5_000,
  menuPrices: {
    ...defaultAccounting.menuPrices,
    salon: {
      ...defaultAccounting.menuPrices.salon,
      sz: {
        ...defaultAccounting.menuPrices.salon?.sz,
        '5': { local: 10_000, import: 12_000 },
      },
    },
    armoire: {
      ...defaultAccounting.menuPrices.armoire,
      sz: {
        ...defaultAccounting.menuPrices.armoire?.sz,
        '3': { local: 5_000, import: 7_000 },
      },
    },
  },
} as AccountingFinanceConfiguration;

function inventoryForQuote() {
  const inventory = blankInventory();
  inventory.crew = 6;
  inventory.entries.salon = {
    quantity: 1,
    size: 5,
    dismantle: false,
    menuisier: true,
    origin: 'local',
  };
  inventory.entries.armoire = {
    quantity: 1,
    size: 3,
    dismantle: true,
    origin: 'local',
  };
  return inventory;
}

test('la marge reprend les coûts comptables configurés et retire taxi et trajet locaux une seule fois', () => {
  const inventory = inventoryForQuote();
  const price = { lines: [] } as unknown as Price;
  const booking = {
    inventorySnapshot: { sourceInventory: inventory },
    estimate: { lines: [] },
  } as unknown as Booking;
  const accountingCosts = captureAccountingCosts(booking, price, accounting, 'complete', 6);

  assert.deepEqual(accountingCosts, {
    movers: 6,
    moverAmount: 30_000,
    carpenters: 2,
    carpenterAmount: 15_000,
  });
  assert.equal(
    quoteGrossMargin({
      quoteTotal: 120_000,
      inventory,
      accounting,
      billingMode: 'complete',
      providedCrew: 6,
      manoeuvreCount: 6,
      taxiCharges: 0,
    }),
    75_000,
  );
  assert.equal(
    quoteGrossMargin({
      quoteTotal: 120_000,
      inventory,
      accounting,
      billingMode: 'complete',
      providedCrew: 6,
      manoeuvreCount: 6,
      taxiCharges: 41_880,
    }),
    33_120,
  );
});

test('activer des frais taxi refacturés augmente le devis sans changer la marge brute', () => {
  const inventory = inventoryForQuote();
  const marginWithoutTaxi = quoteGrossMargin({
    quoteTotal: 120_000,
    inventory,
    accounting,
    billingMode: 'complete',
    providedCrew: 6,
    manoeuvreCount: 6,
    taxiCharges: 0,
  });
  const taxiAndLocalFees = 41_880;
  const marginWithTaxi = quoteGrossMargin({
    quoteTotal: 120_000 + taxiAndLocalFees,
    inventory,
    accounting,
    billingMode: 'complete',
    providedCrew: 6,
    manoeuvreCount: 6,
    taxiCharges: taxiAndLocalFees,
  });

  assert.equal(marginWithoutTaxi, 75_000);
  assert.equal(marginWithTaxi, marginWithoutTaxi);
});

test('la marge reste indisponible tant que les paramètres comptables ne sont pas chargés', () => {
  assert.equal(
    quoteGrossMargin({
      quoteTotal: 120_000,
      inventory: inventoryForQuote(),
      accounting: null,
      billingMode: 'complete',
      providedCrew: 6,
      manoeuvreCount: 6,
      taxiCharges: 0,
    }),
    null,
  );
});
