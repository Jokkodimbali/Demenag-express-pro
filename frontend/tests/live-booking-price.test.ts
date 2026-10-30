import assert from 'node:assert/strict';
import test from 'node:test';
import { liveBookingPrice } from '../src/application/services/live-booking-price.ts';
import { revenueFor } from '../src/application/services/revenue.ts';
import type { Booking, Catalogue, Settings, Price } from '../src/domain/model.ts';

const settings = {
  distanceBounds: [15, 25, 35],
  labourPrice: 6000,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 15000,
} as Settings;
const price: Price = {
  tier: 0,
  trips: 2,
  currency: 'XOF',
  discount: 0,
  total: 102000,
  lines: [
    { label: 'Transport Sprinter', quantity: 2, unitPrice: 30000, total: 60000 },
    { label: 'Manœuvre', quantity: 2, unitPrice: 6000, total: 12000 },
    { label: 'Menuisier · lit', quantity: 2, unitPrice: 15000, total: 30000 },
  ],
};
const booking = {
  status: 'pending',
  distanceKm: 10,
  vehicle: { id: 'sprinter', shortName: 'Sprinter', prices: [30000, 37000, 44000] },
  estimate: price,
  pricingSettings: settings,
  quotes: [],
} as unknown as Booking;
const catalogue: Catalogue = {
  settings,
  vehicles: [{ ...booking.vehicle, prices: [99000, 37000, 44000] }],
};

test('le catalogue courant recalcule les estimations et laisse les données historiques intactes', () => {
  assert.equal(liveBookingPrice(booking, catalogue).total, 240000);
  assert.equal(booking.estimate.total, 102000);
  assert.equal(liveBookingPrice({ ...booking, status: 'completed' }, catalogue).total, 102000);
});

test('les revenus prévisionnels suivent le catalogue, les terminés restent figés et les annulés sont exclus', () => {
  assert.deepEqual(
    revenueFor(
      [booking, { ...booking, status: 'completed' }, { ...booking, status: 'cancelled' }],
      catalogue,
    ),
    {
      provisional: 240000,
      definitive: 102000,
      total: 342000,
    },
  );
});
test('les tarifs manœuvre, montage et remise en pourcentage sont recalculés ensemble', () => {
  const result = liveBookingPrice(
    { ...booking, estimate: { ...price, discountType: 'pct', discountValue: 10 } },
    { ...catalogue, settings: { ...settings, labourPrice: 8000, assemblyPrice: 20000 } },
  );
  assert.equal(result.discount, 25400);
  assert.equal(result.total, 228600);
});
test('une nouvelle tranche sans tarif conserve les prestations et son transport nul', () => {
  const result = liveBookingPrice({ ...booking, distanceKm: 50 }, catalogue);
  assert.equal(result.tier, 3);
  assert.equal(result.lines[0]?.unitPrice, 0);
  assert.equal(result.total, 42000);
});
test('un prix de manœuvre personnalisé est conservé, un prix automatique suit les paramètres', () => {
  const updated = { ...catalogue, settings: { ...settings, labourPrice: 8000 } };
  assert.equal(liveBookingPrice(booking, updated).lines[1]?.unitPrice, 8000);
  const custom = {
    ...booking,
    estimate: {
      ...price,
      lines: price.lines.map((line, index) => (index === 1 ? { ...line, unitPrice: 7500 } : line)),
    },
  };
  assert.equal(liveBookingPrice(custom, updated).lines[1]?.unitPrice, 7500);
});
