import assert from 'node:assert/strict';
import test from 'node:test';
import {
  referenceTrafficDetails,
  referenceTravelMinutes,
} from '../src/modules/moving/domain/routing/reference-traffic';

test('l’estimation expose les mêmes facteurs que ceux utilisés pour le temps de trajet', () => {
  const input = {
    distanceKm: 18,
    startTime: '08:00',
    date: '2026-08-03',
    month: '2026-08',
    from: 'Plateau, Dakar',
    to: 'Colobane, Dakar',
    vehicleId: 'sprinter',
  };
  const details = referenceTrafficDetails(input);

  assert.equal(details.departureTime, '09:30');
  assert.equal(details.minutes, referenceTravelMinutes(input));
  assert.ok(details.factors.some((factor) => factor.label.startsWith('Départ estimé 09:30')));
  assert.ok(details.factors.some((factor) => factor.label.startsWith('Lundi')));
  assert.ok(details.factors.some((factor) => factor.label.startsWith('Août · hivernage')));
  assert.ok(details.factors.some((factor) => factor.label.startsWith('Points noirs')));
});

test('le mode manuel et le mode sans embouteillages suivent la présentation de référence', () => {
  const base = {
    distanceKm: 20,
    startTime: '15:00',
    date: '2026-08-03',
    vehicleId: 'trafic',
  };
  const manual = referenceTrafficDetails({ ...base, manualMinutes: 37 });
  assert.equal(manual.minutes, 37);
  assert.equal(manual.manual, true);
  assert.deepEqual(manual.factors, []);

  const ignored = referenceTrafficDetails({ ...base, ignoreTraffic: true });
  assert.equal(ignored.ignored, true);
  assert.equal(ignored.coefficient, 1.15);
  assert.deepEqual(ignored.factors, []);
});
