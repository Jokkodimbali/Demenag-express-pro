import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLabourPriceMatrix,
  labourUnitPrice,
  labourUnitPriceOverrideFromQuote,
} from '../src/domain/labour-price.ts';
import type { Price } from '../src/domain/model.ts';

const workAccess = { fromFloor: 2, toFloor: 1, fromLift: false, toLift: true };
const historicalSettings = {
  labourPrice: 6000,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
};
const quotePrice: Price = {
  lines: [
    {
      label: 'Manœuvre (2e étage → 1er étage avec ascenseur)',
      quantity: 2,
      unitPrice: 7500,
      total: 15000,
    },
  ],
  total: 15000,
  discount: 0,
  tier: 0,
  trips: 1,
  currency: 'XOF',
};

test('la réouverture d’un devis reprend le tarif de la matrice actuelle si son prix était automatique', () => {
  assert.equal(labourUnitPriceOverrideFromQuote(quotePrice, historicalSettings, workAccess), null);
});

test('la réouverture d’un devis conserve un prix de manœuvre réellement personnalisé', () => {
  assert.equal(
    labourUnitPriceOverrideFromQuote(
      { ...quotePrice, lines: [{ ...quotePrice.lines[0]!, unitPrice: 8200, total: 16400 }] },
      historicalSettings,
      workAccess,
    ),
    8200,
  );
});

test('les 144 cellules de la matrice Paramètres égalent le tarif calculé du devis', () => {
  const matrix = createLabourPriceMatrix(historicalSettings);
  for (const scenario of ['none', 'from', 'to', 'both'] as const) {
    const fromLift = scenario === 'from' || scenario === 'both';
    const toLift = scenario === 'to' || scenario === 'both';
    for (let fromFloor = 0; fromFloor <= 5; fromFloor += 1) {
      for (let toFloor = 0; toFloor <= 5; toFloor += 1) {
        assert.equal(
          matrix[scenario][fromFloor]?.[toFloor],
          labourUnitPrice(historicalSettings, { fromFloor, toFloor, fromLift, toLift }),
        );
      }
    }
  }
});
