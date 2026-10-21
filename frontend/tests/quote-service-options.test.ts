import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Booking, Price, Quote } from '../src/domain/model';
import { quotedServiceOptions } from '../src/application/services/quote-service-options';

const price = (quantities: [number, number, number, number]): Price => ({
  lines: [
    { label: 'Transport', quantity: 2, unitPrice: 20_000, total: 40_000 },
    ...(
      [
        ['Manœuvre', quantities[0], 6_000],
        ['Menuisier · bureau', quantities[1], 15_000],
        ['Menuisier · armoire', quantities[2], 15_000],
        ['Menuisier · lit', quantities[3], 15_000],
      ] as const
    )
      .filter(([, quantity]) => quantity > 0)
      .map(([label, quantity, unitPrice]) => ({
        label,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      })),
  ],
  total: 0,
  discount: 0,
  tier: 0,
  trips: 2,
  currency: 'XOF',
});

test('la réservation reprend les quantités imprimées sur le devis PDF', () => {
  const booking = {
    options: { labour: 3, desk: 1, wardrobe: 1, bed: 1 },
    estimate: price([3, 1, 1, 1]),
  } as Booking;
  const quote = {
    price: price([2, 0, 2, 1]),
    options: { labour: 3, desk: 1, wardrobe: 1, bed: 1 },
  } as Quote;

  assert.deepEqual(quotedServiceOptions(booking, undefined), booking.options);
  assert.deepEqual(quotedServiceOptions(booking, quote), {
    labour: 2,
    desk: 0,
    wardrobe: 2,
    bed: 1,
  });
});
