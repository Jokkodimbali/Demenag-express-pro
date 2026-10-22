import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TollPoint } from '../src/domain/model';
import { tollLine, tollPointForLine } from '../src/domain/toll-selection';

const point: TollPoint = {
  id: 'rufisque',
  name: 'Péage de Rufisque',
  region: 'Dakar',
  axis: 'Autoroute de l’Avenir',
  heavyPrice: 700,
  vehiclePrices: { sprinter: 900 },
  latitude: 14.744997,
  longitude: -17.282019,
};

test('un péage sélectionné utilise le tarif du véhicule et le nombre exact de passages', () => {
  const oneWay = tollLine(point, 'sprinter', 'one-way', 3);
  assert.deepEqual(oneWay, {
    id: point.id,
    label: 'Péage de Rufisque · Aller simple',
    quantity: 3,
    unitPrice: 900,
  });
  assert.equal(oneWay.quantity * oneWay.unitPrice, 2700);

  const roundTrip = tollLine(point, 'autre-vehicule', 'round-trip', 2);
  assert.equal(roundTrip.quantity, 4);
  assert.equal(roundTrip.unitPrice, 700);
  assert.equal(roundTrip.quantity * roundTrip.unitPrice, 2800);
});

test('un devis enregistré retrouve le péage et conserve son tarif historique', () => {
  const saved = tollLine(point, 'sprinter', 'round-trip', 2, 800);
  assert.equal(tollPointForLine(saved.label, [point])?.id, point.id);
  assert.equal(saved.unitPrice, 800);
  assert.equal(saved.quantity * saved.unitPrice, 3200);
});
