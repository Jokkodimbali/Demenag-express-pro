import assert from 'node:assert/strict';
import test from 'node:test';
import { clientBookingCardModel } from '../src/modules/account/application/services/client-booking-card.ts';
import { clientBookingPdfDocument } from '../src/modules/account/application/services/client-booking-pdf.ts';
import type { Booking, Catalogue, Quote } from '../src/modules/shared/domain/model.ts';

const savedPrice: Quote['price'] = {
  lines: [
    { label: 'Transport Sprinter', quantity: 2, unitPrice: 10_000, total: 20_000 },
    { label: 'Manœuvre', quantity: 2, unitPrice: 6_500, total: 13_000 },
  ],
  total: 33_000,
  discount: 0,
  tier: 1,
  trips: 2,
  currency: 'XOF',
};

const quote: Quote = {
  id: 'quote-provisional',
  reference: 'DV-PROVISIONAL',
  kind: 'provisional',
  createdAt: '2026-11-20T00:00:00.000Z',
  notes: '',
  price: savedPrice,
};

const booking = {
  id: 'booking-client-pdf',
  reference: 'DEM-CLIENT-PDF',
  status: 'pending',
  distanceKm: 20,
  from: [14.7, -17.4],
  to: [14.8, -16.9],
  fromAddress: 'Dakar',
  toAddress: 'Thiès',
  date: null,
  timeSlot: '',
  vehicle: { id: 'sprinter', name: 'Mercedes Sprinter', shortName: 'Sprinter', prices: [1, 2, 3] },
  estimate: { ...savedPrice, total: 99_000 },
  quotes: [quote],
  options: { labour: 2, desk: 0, wardrobe: 0, bed: 0 },
  pricingSettings: { distanceBounds: [15, 25, 35] },
} as unknown as Booking;

const catalogue = {
  settings: { distanceBounds: [15, 25, 35], labourPrice: 6_500 },
  vehicles: [
    {
      ...booking.vehicle,
      prices: [90_000, 100_000, 110_000],
    },
  ],
} as unknown as Catalogue;

test('le PDF et la carte client reprennent le devis provisoire sauvegardé sans recalcul', () => {
  const pdf = clientBookingPdfDocument(booking, catalogue, quote);
  const card = clientBookingCardModel(booking, catalogue);

  assert.equal(pdf.booking.estimate, savedPrice);
  assert.equal(pdf.quote?.price, savedPrice);
  assert.equal(card.displayedEstimate, savedPrice.total);
});

test('un ancien devis provisoire au tarif non fixé reste « Sur devis » sur la carte', () => {
  const pendingPrice: Quote['price'] = {
    ...savedPrice,
    lines: [
      {
        label: 'Transport Sprinter · plus de 35 km, prix à fixer',
        quantity: 2,
        unitPrice: 0,
        total: 0,
      },
      { label: 'Manœuvre', quantity: 2, unitPrice: 6_500, total: 13_000 },
    ],
    total: 13_000,
    tier: 3,
  };
  const pendingQuote = { ...quote, price: pendingPrice };
  const pendingBooking = {
    ...booking,
    distanceKm: 50,
    quotes: [pendingQuote],
  } as Booking;
  const pdf = clientBookingPdfDocument(pendingBooking, catalogue, pendingQuote);
  const card = clientBookingCardModel(pendingBooking, catalogue);

  assert.equal(pdf.booking.estimate, pendingPrice);
  assert.equal(pdf.quote?.price, pendingPrice);
  assert.equal(card.displayedEstimate, null);
});
