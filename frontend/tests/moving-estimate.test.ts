import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  blankInventory,
  inventoryFormatHint,
} from '../src/modules/moving/domain/inventory/inventory.ts';
import {
  bookingInventorySnapshot,
  estimateMovingWork,
  estimatedInventoryItemVolume,
} from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import { referenceTravelMinutes } from '../src/modules/moving/domain/routing/reference-traffic.ts';
import {
  referencePlannedTrips,
  simulationInput,
} from '../src/modules/moving/application/services/loading-simulation-model.ts';
import type { Vehicle } from '../src/modules/shared/domain/model.ts';

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

test('le devis reprend le nombre de trajets du simulateur de chargement de référence', () => {
  const inventory = blankInventory();
  inventory.dwellingType = 'F3';
  inventory.entries.salon = { quantity: 1, size: 5, format: 'medium', dismantle: false };
  inventory.entries.frigo = { quantity: 1, size: 2, format: 'large', dismantle: false };
  inventory.entries.carton = { quantity: 30, size: 1, format: 'medium', dismantle: false };
  const source = readFileSync(new URL('../public/reference/loading-sim.js', import.meta.url), 'utf8');
  const simulationWindow = {} as Window & { DemSim?: NonNullable<Window['DemSim']> };
  vm.runInNewContext(source, { window: simulationWindow });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    value: simulationWindow,
    configurable: true,
    writable: true,
  });
  try {
    const input = simulationInput(inventory, vehicle, 20, 204, 184);
    const expected = simulationWindow.DemSim!.plan(input).trips.length;
    assert.equal(
      referencePlannedTrips(inventory, vehicle, {
        blanketStock: 20,
        blanketLengthCm: 204,
        blanketWidthCm: 184,
      }),
      expected,
    );
    assert.equal(
      estimateMovingWork(inventory, vehicle, null, { recommendedTrips: expected }).trips,
      expected,
    );
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as typeof globalThis & { window?: Window }).window;
  }
});

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

test('le passage par le balcon applique le supplément proportionnel de la référence et reste figé', () => {
  const inventory = blankInventory();
  inventory.entries.salon = { quantity: 1, size: 5, dismantle: false };
  const laborPlanning = { tripSetupMinutes: 0 };
  const stairs = estimateMovingWork(inventory, vehicle, null, {
    trips: 1,
    crew: 2,
    laborPlanning,
  });
  inventory.stairs = 'balcon';
  inventory.balcPx = 25000;
  const balcony = estimateMovingWork(inventory, vehicle, null, {
    trips: 1,
    crew: 2,
    laborPlanning,
  });
  const snapshot = bookingInventorySnapshot(inventory, balcony);

  assert.ok(Math.abs(balcony.loadingMinutes / stairs.loadingMinutes - 1.4) < 0.000001);
  assert.equal(snapshot.stairs, 'balcon');
  assert.equal(snapshot.balcPx, 25000);
  assert.equal(snapshot.sourceInventory?.balcPx, 25000);
});

test('un objet libre décrit utilise ses dimensions et son poids dans les totaux figés', () => {
  const inventory = blankInventory();
  inventory.blanketLengthCm = 210;
  inventory.blanketWidthCm = 180;
  inventory.custom = [
    {
      id: 'aquarium',
      label: 'aquarium',
      quantity: 1,
      cL: 100,
      cW: 50,
      cH: 50,
      kg: 70,
      up: true,
      frag: true,
      notop: true,
    },
  ];

  const estimate = estimateMovingWork(inventory, vehicle, null, { trips: 1 });
  const snapshot = bookingInventorySnapshot(inventory, estimate);

  assert.equal(snapshot.items[0]?.volumeM3, 0.25);
  assert.equal(snapshot.totalWeightKg, 70);
  assert.equal(snapshot.maxItemWeightKg, 70);
  assert.equal(snapshot.sourceInventory?.blanketLengthCm, 210);
  assert.equal(snapshot.sourceInventory?.blanketWidthCm, 180);
  assert.equal(snapshot.sourceInventory?.custom[0]?.frag, true);
});

test('le poids saisi remplace le poids du meuble modèle de l’objet personnalisé', () => {
  const inventory = blankInventory();
  inventory.custom = [
    {
      id: 'custom-sofa',
      label: 'Canapé ancien',
      quantity: 1,
      format: 'large',
      like: 'salon',
      kg: 70,
    },
  ];

  const estimate = estimateMovingWork(inventory, vehicle, null, { trips: 1 });

  assert.equal(estimate.totalWeightKg, 70);
  assert.equal(estimate.maxItemWeightKg, 70);
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

test('la réponse « pas prêt » ne remplace pas l’option emballage de la référence', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const ready = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });
  inventory.ready = 'non';
  const notReady = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });

  assert.equal(ready.packingMinutes, 0);
  assert.equal(notReady.packingMinutes, 0);
});

test('le trajet reprend le calcul de circulation Dakar de la référence', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'objet', label: 'Objet', quantity: 1, format: 'medium' }];
  const estimate = estimateMovingWork(
    inventory,
    vehicle,
    { distanceKm: 20, durationMinutes: 35 },
    { trips: 1 },
  );

  assert.ok(Math.abs(estimate.travelMinutes - 56.39314914150304) < 0.001);
});

test('le trajet reprend les corrections de péage, d’horaires et de véhicule de la référence', () => {
  const standard = referenceTravelMinutes({
    distanceKm: 20,
    startTime: '08:00',
    vehicleId: 'sprinter',
  });
  const toll = referenceTravelMinutes({
    distanceKm: 20,
    startTime: '08:00',
    vehicleId: 'sprinter',
    hasToll: true,
  });
  const offPeak = referenceTravelMinutes({
    distanceKm: 20,
    startTime: '08:00',
    vehicleId: 'sprinter',
    ignoreTraffic: true,
  });
  const manual = referenceTravelMinutes({
    distanceKm: 20,
    startTime: '08:00',
    vehicleId: 'sprinter',
    manualMinutes: 60,
  });

  assert.ok(toll < standard);
  assert.ok(offPeak < standard);
  assert.equal(manual, 60);
  assert.ok(
    referenceTravelMinutes({ distanceKm: 20, startTime: '08:00', vehicleId: 'trafic' }) < standard,
  );
  assert.ok(
    referenceTravelMinutes({
      distanceKm: 20,
      startTime: '08:00',
      vehicleId: 'sprinter',
      date: '2026-05-27',
    }) < standard,
  );
  assert.ok(
    referenceTravelMinutes({
      distanceKm: 20,
      startTime: '08:00',
      vehicleId: 'sprinter',
      from: 'Plateau',
    }) > standard,
  );
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
  assert.equal(largerInventory.recommendedCrew, 4);
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
  const single = estimateMovingWork(inventory, vehicle, null, { heatOff: true });
  const parallel = estimateMovingWork(inventory, vehicle, null, {
    parallelVehicles: 2,
    heatOff: true,
  });

  assert.equal(single.trips, 6);
  assert.equal(single.totalMinutes, 785);
  assert.equal(parallel.crew, 12);
  assert.equal(Math.round(parallel.handlingMinutes / 5) * 5, 305);
  assert.equal(Math.round(parallel.rawTotalMinutes / 5) * 5, 410);
});

test('le scénario de référence conserve ses volumes, son équipe et ses durées', () => {
  const inventory = blankInventory();
  inventory.dwellingType = 'F3';
  inventory.annexOn = true;
  inventory.fromFloor = 3;
  inventory.toFloor = 1;
  inventory.toLift = true;
  inventory.flags = { acces: true, fragile: true, escalier: true, emballage: true };
  for (const [key, quantity, size, dismantle] of [
    ['salon', 1, 5, false],
    ['armoire', 1, 3, true],
    ['frigo', 1, 1, false],
    ['carton', 12, 1, false],
    ['lit', 1, 2, true],
    ['matelas', 1, 2, false],
  ] as const)
    inventory.entries[key] = { quantity, size, format: 'medium', dismantle };

  const estimate = estimateMovingWork(
    inventory,
    vehicle,
    { distanceKm: 20, durationMinutes: 0 },
    {
      startTime: '08:00',
      date: '2026-11-10',
      month: '2026-11',
      fromAddress: 'Ouakam, Dakar',
      toAddress: 'Almadies, Dakar',
    },
  );

  assert.equal(estimate.volume, 10.79);
  assert.equal(estimate.capacity, 13.9);
  assert.equal(estimate.trips, 2);
  assert.equal(estimate.crew, 6);
  assert.equal(estimate.carpenterCount, 2);
  assert.ok(Math.abs(estimate.handlingMinutes - 206.170947) < 0.001);
  assert.equal(estimate.totalMinutes, 525);
  assert.equal(estimate.endTime, '16:45');
  assert.equal(estimate.totalWeightKg, 819);
  assert.equal(estimate.maxItemWeightKg, 65);

  const manualEstimate = estimateMovingWork(
    inventory,
    vehicle,
    { distanceKm: 20, durationMinutes: 0 },
    {
      startTime: '08:00',
      date: '2026-11-10',
      month: '2026-11',
      fromAddress: 'Ouakam, Dakar',
      toAddress: 'Almadies, Dakar',
      crew: 4,
    },
  );
  assert.equal(manualEstimate.crew, 4);
  assert.equal(manualEstimate.recommendedCrew, 6);
  assert.ok(Math.abs(manualEstimate.handlingMinutes - 239.581449) < 0.001);
  assert.equal(manualEstimate.totalMinutes, 590);
  assert.equal(manualEstimate.endTime, '17:50');
});

test('le choix manuel est conservé et reste comparé à la recommandation automatique', () => {
  const inventory = blankInventory();
  inventory.custom = [{ id: 'cartons', label: 'Cartons', quantity: 24, format: 'medium' }];
  const estimate = estimateMovingWork(inventory, vehicle, null, { trips: 1, crew: 2 });

  assert.equal(estimate.recommendedCrew, 4);
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
