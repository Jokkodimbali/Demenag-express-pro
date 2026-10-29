import assert from 'node:assert/strict';
import test from 'node:test';
import { blankInventory, inventoryFormatHint } from '../src/domain/inventory.ts';
import {
  bookingInventorySnapshot,
  estimateMovingWork,
  estimatedInventoryItemVolume,
} from '../src/domain/moving-estimate.ts';
import type { Vehicle } from '../src/domain/model.ts';

const vehicle: Vehicle = {
  id: 'sprinter',
  name: 'Mercedes Sprinter',
  volume: '13,9 m³',
  length: '4,30 m',
  height: '1,94 m',
  width: '1,78 m',
  wheelWidth: '1,35 m',
  image: '/assets/sprinter-profil.png',
  interior: '/assets/sprinter-interieur.png',
  prices: [30000, 37000, 44000],
};

test('l’estimation affichée sous un objet reprend le volume utilisé par le devis', () => {
  assert.equal(estimatedInventoryItemVolume('meuble-tv', 1, false, 'medium'), 0.6);
  assert.ok(Math.abs(estimatedInventoryItemVolume('armoire', 3, true) - 1.44) < 0.001);
  assert.equal(estimatedInventoryItemVolume('custom', 1, false, 'large'), 0.8);
  assert.equal(estimatedInventoryItemVolume('salon', 5, false), 3.75);
  assert.equal(inventoryFormatHint('table-basse', 'medium'), 'standard');
  assert.equal(inventoryFormatHint('custom', 'large'), 'plus grand que la moyenne');
});

test('les objets sans sélecteur de format gardent leur volume de référence', () => {
  assert.equal(estimatedInventoryItemVolume('micro-ondes', 1, false, 'large'), 0.1);
  assert.equal(estimatedInventoryItemVolume('ventilateur', 1, false, 'small'), 0.15);
  assert.equal(estimatedInventoryItemVolume('gaz', 1, false, 'large'), 0.08);
});

test('les objets qui dépassent le gabarit sont signalés séparément pour chaque véhicule', () => {
  const inventory = blankInventory();
  inventory.entries.frigo = {
    quantity: 1,
    size: 1,
    format: 'large',
    dismantle: false,
  };
  inventory.entries.salon = {
    quantity: 1,
    size: 5,
    format: 'medium',
    dismantle: false,
  };
  const compactVehicle = { ...vehicle, height: '1,70 m', length: '1,80 m' };
  const estimate = estimateMovingWork(inventory, compactVehicle);

  assert.equal(estimate.vehicleWarnings.length, 2);
  assert.ok(estimate.vehicleWarnings.some((warning) => warning.includes('Frigo debout')));
  assert.ok(estimate.vehicleWarnings.some((warning) => warning.includes('Salon')));
  assert.ok(estimate.warnings.includes(estimate.vehicleWarnings[0]!));
});

test('le démontage d’un objet personnalisé réduit son volume comme dans la maquette', () => {
  const inventory = blankInventory();
  inventory.custom = [
    { id: 'armoire-custom', label: 'Armoire ancienne', quantity: 1, format: 'medium' },
  ];
  const assembled = estimateMovingWork(inventory, vehicle, null, { trips: 1 });
  inventory.custom[0].dismantle = true;
  const dismantled = estimateMovingWork(inventory, vehicle, null, { trips: 1 });

  assert.equal(assembled.volume, 0.5);
  assert.equal(dismantled.volume, 0.4);
});

test('la recommandation ne rajoute pas de menuisiers quand la manutention reste limitante', () => {
  const inventory = blankInventory();
  inventory.entries.carton = {
    quantity: 1000,
    size: 1,
    format: 'medium',
    dismantle: false,
  };
  inventory.entries.armoire = {
    quantity: 1,
    size: 3,
    format: 'medium',
    dismantle: true,
  };
  const estimate = estimateMovingWork(inventory, vehicle, null, {
    trips: 1,
    laborPlanning: {
      maxHandlingHours: 3,
      maxDayHours: 8,
      defaultStartHour: 8,
      maxMoversPerVehicle: 2,
      cubicMetersPerHourPerMover: 2.5,
      pauseMinutes: 30,
    },
  });

  assert.equal(estimate.recommendedCrew, 2);
  assert.equal(estimate.carpenterCount, 1);
});

test('une réponse « pas prêt » ajoute le temps d’emballage au planning', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const ready = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });
  inventory.ready = 'non';
  const notReady = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });

  assert.equal(ready.packingMinutes, 0);
  assert.equal(notReady.packingMinutes, 1.5);
});

test('le trajet utilise la correction de circulation et le facteur du véhicule du modèle', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const estimate = estimateMovingWork(
    inventory,
    vehicle,
    { distanceKm: 20, durationMinutes: 35 },
    { trips: 1 },
  );

  assert.ok(Math.abs(estimate.travelMinutes - 58.86632769355671) < 0.001);
});

test('la durée Google avec bouchons remplace la correction de trajet du modèle', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const route = { distanceKm: 20, durationMinutes: 35 };
  const sprinter = estimateMovingWork(inventory, vehicle, route, {
    trips: 1,
    trafficDurationMinutes: 60,
  });
  const trafic = estimateMovingWork(inventory, { ...vehicle, id: 'trafic' }, route, {
    trips: 1,
    trafficDurationMinutes: 60,
  });

  assert.equal(sprinter.travelMinutes, 76);
  assert.equal(trafic.travelMinutes, 73);
});

test('l’heure et les cadences de planning peuvent être réglées dans les paramètres admin', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const standard = estimateMovingWork(inventory, vehicle, null, { trips: 1 });
  const configured = estimateMovingWork(inventory, vehicle, null, {
    trips: 1,
    laborPlanning: {
      maxHandlingHours: 3,
      maxDayHours: 8,
      defaultStartHour: 10,
      maxMoversPerVehicle: 6,
      cubicMetersPerHourPerMover: 1,
      pauseMinutes: 30,
    },
  });

  assert.equal(standard.startTime, '08:00');
  assert.equal(configured.startTime, '10:00');
  assert.ok(configured.loadingMinutes > standard.loadingMinutes);
});

test('le nombre de manœuvres se recalcule automatiquement quand l’inventaire change', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'cartons', label: 'Cartons', quantity: 1, format: 'medium' }];
  const smallInventory = estimateMovingWork(inventory, vehicle, null, { trips: 1 });

  inventory.custom[0].quantity = 24;
  const largerInventory = estimateMovingWork(inventory, vehicle, null, { trips: 1 });

  assert.equal(smallInventory.recommendedCrew, 2);
  assert.equal(largerInventory.recommendedCrew, 3);
  assert.equal(largerInventory.crew, largerInventory.recommendedCrew);
});

test('deux véhicules en parallèle reprennent la solution proposée par la référence', () => {
  const inventory = blankInventory();
  inventory.dwellingType = 'Villa';
  inventory.entries.salon = {
    quantity: 15,
    size: 5,
    format: 'medium',
    dismantle: false,
  };
  const single = estimateMovingWork(inventory, vehicle);
  const parallel = estimateMovingWork(inventory, vehicle, null, {
    parallelVehicles: 2,
  });

  assert.equal(single.trips, 6);
  assert.equal(single.totalMinutes, 505);
  assert.equal(parallel.crew, 12);
  assert.equal(Math.round(parallel.handlingMinutes / 5) * 5, 225);
  assert.equal(Math.round(parallel.rawTotalMinutes / 5) * 5, 250);
});

test('le choix manuel est conservé et reste comparé à la recommandation automatique', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'cartons', label: 'Cartons', quantity: 24, format: 'medium' }];
  const estimate = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });

  assert.equal(estimate.recommendedCrew, 3);
  assert.equal(estimate.crew, 2);
  assert.ok(estimate.warnings.some((warning) => warning.includes('avec 2 manœuvres')));
});

test('l’instantané de facture reprend les objets, accès et volumes du devis', () => {
  const inventory = blankInventory();
  inventory.dwellingType = 'F2';
  inventory.fromFloor = 2;
  inventory.fromLift = true;
  inventory.entries.carton = { quantity: 2, size: 1, format: 'medium', dismantle: false };
  const estimate = estimateMovingWork(inventory, vehicle, null, { trips: 1 });
  const snapshot = bookingInventorySnapshot(inventory, estimate);

  assert.equal(snapshot.itemCount, 2);
  assert.equal(snapshot.items[0]?.label, 'Carton');
  assert.equal(snapshot.items[0]?.volumeM3, 0.14);
  assert.equal(snapshot.fromFloor, 2);
  assert.equal(snapshot.fromLift, true);
  assert.equal(snapshot.annexVolumeM3, 2.36);
  assert.equal(snapshot.totalVolumeM3, estimate.volume);
  assert.equal(snapshot.moverCount, estimate.crew);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).sourceInventory, inventory);
});
