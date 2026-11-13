import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKmForEstimateRequest } from '../src/modules/booking/application/services/estimate-request-distance.ts';

test('le devis administrateur transmet la distance du trajet sans override', () => {
  assert.equal(distanceKmForEstimateRequest(null, 18.4, true), 18.4);
});

test('le devis administrateur conserve la distance personnalisée, y compris zéro', () => {
  assert.equal(distanceKmForEstimateRequest(22, 18.4, true), 22);
  assert.equal(distanceKmForEstimateRequest(0, 18.4, true), 0);
});

test('la réservation publique laisse le serveur utiliser la distance du trajet', () => {
  assert.equal(distanceKmForEstimateRequest(null, 18.4, false), undefined);
});
