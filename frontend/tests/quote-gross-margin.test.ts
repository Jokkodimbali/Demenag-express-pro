import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  Booking,
  AccountingFinanceConfiguration,
  Price,
  Quote,
} from '../src/modules/shared/domain/model.ts';
import { defaultAccountingFinanceConfiguration } from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import {
  quoteGrossMargin,
  quoteGrossMarginForDisplayedPrice,
} from '../src/modules/admin/quotes/application/services/quote-gross-margin.ts';
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
      hasBillableContent: true,
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
      hasBillableContent: true,
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
    hasBillableContent: true,
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
    hasBillableContent: true,
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
      hasBillableContent: true,
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

test('la marge reste vide tant que le devis ne contient aucun élément facturable', () => {
  assert.equal(
    quoteGrossMargin({
      quoteTotal: 30_000,
      hasBillableContent: false,
      inventory: blankInventory(),
      accounting,
      billingMode: 'complete',
      providedCrew: 0,
      manoeuvreCount: 0,
      taxiCharges: 0,
    }),
    null,
  );
});

test('la marge de la barre utilise le prix sauvegardé, ses frais et sa formule active', () => {
  const savedQuote = {
    price: {
      lines: [
        { label: 'Manœuvres', quantity: 2, unitPrice: 6_500, total: 13_000 },
        {
          label: 'Majoration de travail de nuit (2 personnes)',
          quantity: 2,
          unitPrice: 1_000,
          total: 2_000,
        },
      ],
      total: 100_000,
      discount: 0,
      tier: 0,
      trips: 2,
      currency: 'XOF',
    },
    billingMode: 'standard',
    providedCrew: 2,
    pricingInput: { taxiFeeAmount: 1_000, taxiFeeApplied: true },
  } as unknown as Pick<Quote, 'price' | 'pricingInput' | 'billingMode' | 'providedCrew'>;
  const displayedPrice = {
    ...savedQuote.price,
    total: 102_000,
    lines: [
      ...savedQuote.price.lines,
      { label: 'Cartons supplémentaires', quantity: 1, unitPrice: 2_000, total: 2_000 },
    ],
  };

  assert.equal(
    quoteGrossMarginForDisplayedPrice({
      displayedPrice,
      savedQuote,
      fallbackBillingMode: 'complete',
      hasBillableContent: true,
      inventory: blankInventory(),
      accounting,
      fallbackProvidedCrew: 6,
      fallbackTaxiCharges: 8_000,
    }),
    89_000,
  );
});

test('la marge économique ne retire pas les frais taxi ni les heures des manœuvres', () => {
  const savedQuote = {
    price: {
      lines: [
        { label: 'Manœuvres', quantity: 2, unitPrice: 6_500, total: 13_000 },
        {
          label: 'Majoration de travail de nuit (2 personnes)',
          quantity: 2,
          unitPrice: 1_000,
          total: 2_000,
        },
      ],
      total: 50_000,
      discount: 0,
      tier: 0,
      trips: 2,
      currency: 'XOF',
    },
    billingMode: 'driver-rental',
    providedCrew: 2,
    pricingInput: { taxiFeeAmount: 9_000, taxiFeeApplied: true },
  } as unknown as Pick<Quote, 'price' | 'pricingInput' | 'billingMode' | 'providedCrew'>;

  assert.equal(
    quoteGrossMarginForDisplayedPrice({
      displayedPrice: savedQuote.price,
      savedQuote,
      fallbackBillingMode: 'complete',
      hasBillableContent: true,
      inventory: blankInventory(),
      accounting,
      fallbackProvidedCrew: 6,
      fallbackTaxiCharges: 8_000,
    }),
    null,
  );
});

test('la marge reste vide tant que le tarif transport du dernier palier est à fixer', () => {
  const pendingPrice: Price = {
    lines: [
      {
        label: 'Transport Master · plus de 35 km, prix à fixer',
        quantity: 2,
        unitPrice: 0,
        total: 0,
      },
      { label: 'Manœuvre', quantity: 2, unitPrice: 6_500, total: 13_000 },
    ],
    total: 13_000,
    discount: 0,
    tier: 3,
    trips: 2,
    currency: 'XOF',
  };

  assert.equal(
    quoteGrossMarginForDisplayedPrice({
      displayedPrice: pendingPrice,
      fallbackBillingMode: 'complete',
      hasBillableContent: true,
      inventory: blankInventory(),
      accounting,
      fallbackProvidedCrew: 2,
      fallbackTaxiCharges: 0,
    }),
    null,
  );
});
