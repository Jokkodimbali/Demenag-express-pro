import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteTotal, savedCustomTransportPrice } from '../src/application/services/quote-total.ts';
import type { Booking, Settings } from '../src/domain/model.ts';

const settings = {
  maxTrips: 20,
  maxOptions: 20,
  labourPrice: 6000,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 15000,
} as Settings;
const booking = (tier: number) =>
  ({
    estimate: { tier },
    vehicle: { prices: [30000, 37000, 44000] },
    workAccess: { fromFloor: 0, toFloor: 0, fromLift: false, toLift: false },
  }) as Booking;
const draft = (customPrice: number | null) => ({
  trips: 2,
  customPrice,
  discount: 0,
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
});

test('le prix personnalisé ne remplace pas le tarif normal des tranches', () => {
  assert.equal(quoteTotal(booking(1), settings, draft(99000), []), 74000);
});

test('le prix personnalisé ne s’applique qu’à la tranche sur devis', () => {
  assert.equal(quoteTotal(booking(3), settings, draft(null), []), null);
  assert.equal(quoteTotal(booking(3), settings, draft(50000), []), 100000);
});

test('la réouverture ne reprend un ancien tarif transport que pour une tranche sur devis', () => {
  const regular = {
    price: {
      tier: 1,
      lines: [{ label: 'Transport Sprinter', unitPrice: 37000 }],
    },
  } as Booking['quotes'][number];
  const custom = {
    price: {
      tier: 3,
      lines: [{ label: 'Transport Sprinter', unitPrice: 50000 }],
    },
  } as Booking['quotes'][number];

  assert.equal(savedCustomTransportPrice(booking(1), regular), null);
  assert.equal(savedCustomTransportPrice(booking(3), custom), 50000);
});
