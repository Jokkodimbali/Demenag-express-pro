import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultTaxiDistanceTariffs,
  taxiDistanceTariffFor,
  taxiFareForDistance,
} from '../../shared/taxi-distance-tariffs.js';

test('les tarifs utilisent le prix haut de chaque tranche de la photo', () => {
  assert.deepEqual(
    [
      taxiFareForDistance(2, defaultTaxiDistanceTariffs),
      taxiFareForDistance(5, defaultTaxiDistanceTariffs),
      taxiFareForDistance(10, defaultTaxiDistanceTariffs),
      taxiFareForDistance(15, defaultTaxiDistanceTariffs),
      taxiFareForDistance(25, defaultTaxiDistanceTariffs),
      taxiFareForDistance(45, defaultTaxiDistanceTariffs),
    ],
    [1500, 2500, 3500, 5000, 7000, 30000],
  );
});

test('les limites exactes restent dans la tranche qui se termine à cette distance', () => {
  assert.deepEqual(
    [3, 3.01, 7, 7.01, 12, 12.01, 20, 20.01, 30, 30.01].map((distance) =>
      taxiFareForDistance(distance, defaultTaxiDistanceTariffs),
    ),
    [1500, 2500, 2500, 3500, 3500, 5000, 5000, 7000, 7000, 30000],
  );
});

test('la course sélectionnée expose son libellé et les distances invalides ne sont pas tarifées', () => {
  assert.equal(
    taxiDistanceTariffFor(45, defaultTaxiDistanceTariffs)?.label,
    'Aéroport AIBD (Diass), environ 45 km (>30 km)',
  );
  assert.equal(taxiFareForDistance(-1, defaultTaxiDistanceTariffs), null);
  assert.equal(taxiFareForDistance(Number.NaN, defaultTaxiDistanceTariffs), null);
});
