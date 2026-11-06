import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRentalKit } from '../src/domain/rental-kit.ts';
import type { Vehicle } from '../src/domain/model.ts';

const vehicle = {
  id: 'sprinter',
  name: 'Sprinter',
  shortName: 'Sprinter',
  image: '/assets/sprinter.webp',
} as Vehicle;

test('le matériel fourni reprend les besoins du plan et ses valeurs de repli', () => {
  const fromPlan = defaultRentalKit(vehicle, 3, undefined, { blankets: 9, straps: 7 });
  assert.equal(fromPlan.find((item) => item.id === 'blankets')?.quantity, 9);
  assert.equal(fromPlan.find((item) => item.id === 'tie-down-straps')?.quantity, 7);
  assert.equal(fromPlan.find((item) => item.id === 'lifting-straps')?.quantity, 2);

  const fallback = defaultRentalKit(vehicle, 3, undefined, { blankets: 0, straps: 2 });
  assert.equal(fallback.find((item) => item.id === 'blankets')?.quantity, 6);
  assert.equal(fallback.find((item) => item.id === 'tie-down-straps')?.quantity, 4);
});
