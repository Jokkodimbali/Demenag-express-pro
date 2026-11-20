import assert from 'node:assert/strict';
import test from 'node:test';
import {
  persistedVehicleEstimate,
  shouldPreserveAppliedVehicleEstimate,
} from '../src/modules/admin/quotes/application/services/automatic-quote-estimate.ts';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config.ts';

test('une estimation automatique enregistrée est réappliquée sans suivre une nouvelle estimation', () => {
  const persisted = persistedVehicleEstimate('sprinter', 'inventaire-a', {
    ...defaultAdminQuoteConfig(),
    trips: 4,
  });

  assert.deepEqual(persisted, {
    vehicleId: 'sprinter',
    inventoryKey: 'inventaire-a',
    trips: 4,
  });
  assert.equal(
    shouldPreserveAppliedVehicleEstimate({
      applied: persisted,
      selectedVehicleId: 'sprinter',
      inventoryKey: 'inventaire-a',
      configuredTrips: 4,
    }),
    true,
  );
  assert.equal(
    shouldPreserveAppliedVehicleEstimate({
      applied: persisted,
      selectedVehicleId: 'sprinter',
      inventoryKey: 'inventaire-b',
      configuredTrips: 4,
    }),
    false,
  );
});

test('le nombre appliqué depuis une carte véhicule ne bascule pas vers le plan 3D', () => {
  const inventoryKey = '{"salon":1,"frigo":1,"carton":30}';
  const referenceCardTrips = [
    { vehicleId: 'sprinter', trips: 1, simulatedTrips: 2 },
    { vehicleId: 'trafic', trips: 2, simulatedTrips: 3 },
    { vehicleId: 'master', trips: 1, simulatedTrips: 2 },
  ];

  for (const candidate of referenceCardTrips) {
    assert.equal(
      shouldPreserveAppliedVehicleEstimate({
        applied: { vehicleId: candidate.vehicleId, inventoryKey, trips: candidate.trips },
        selectedVehicleId: candidate.vehicleId,
        inventoryKey,
        configuredTrips: candidate.trips,
      }),
      true,
      `${candidate.vehicleId}: conserver les ${candidate.trips} trajet(s) choisis sur la carte`,
    );
    assert.notEqual(candidate.trips, candidate.simulatedTrips);
  }
});

test('le calcul automatique se remet à jour après un changement d’inventaire ou de véhicule', () => {
  const applied = { vehicleId: 'sprinter', inventoryKey: 'inventaire-a', trips: 1 };
  assert.equal(
    shouldPreserveAppliedVehicleEstimate({
      applied,
      selectedVehicleId: 'sprinter',
      inventoryKey: 'inventaire-b',
      configuredTrips: 1,
    }),
    false,
  );
  assert.equal(
    shouldPreserveAppliedVehicleEstimate({
      applied,
      selectedVehicleId: 'trafic',
      inventoryKey: 'inventaire-a',
      configuredTrips: 1,
    }),
    false,
  );
});
