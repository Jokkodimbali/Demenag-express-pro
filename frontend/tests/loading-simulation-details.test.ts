import assert from 'node:assert/strict';
import test from 'node:test';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory';
import {
  crewPosts,
  equipmentAdvice,
  fatigueAdvice,
  handlingAdvice,
  simulationLineWeight,
  type SimulationLine,
} from '../src/modules/moving/domain/loading-simulation-details';

test('les masses des objets composés suivent les pièces et le démontage du modèle', () => {
  const salon: SimulationLine = { k: 'salon', q: 1, s: 5, g: 'm', dm: false, n: 'Salon' };
  const wardrobe: SimulationLine = { k: 'armoire', q: 1, s: 4, g: 'm', dm: true, n: 'Armoire' };
  assert.deepEqual(simulationLineWeight(salon), { total: 100, max: 56 });
  assert.deepEqual(simulationLineWeight(wardrobe), { total: 160, max: 30 });
});

test('les postes et le matériel évoluent avec étages, objets lourds et stock calculé', () => {
  const inventory = blankInventory();
  inventory.fromFloor = 2;
  const lines: SimulationLine[] = [
    { k: 'frigo', q: 1, s: 0, g: 'g', dm: false, n: 'Frigo' },
    { k: 'armoire', q: 1, s: 3, g: 'm', dm: true, n: 'Armoire' },
  ];
  const handling = handlingAdvice(lines, inventory);
  assert.equal(handling[0].carriers, 4);
  assert.ok(
    crewPosts(2, false, true, 6, handling).posts.some((post) =>
      post.label.includes('Binôme objets lourds'),
    ),
  );
  const equipment = equipmentAdvice(lines, inventory, 6, [{ straps: 8, blankets: 5 }]);
  assert.equal(equipment.find((item) => item.key === 'cliquet')?.quantity, '8');
  assert.equal(equipment.find((item) => item.key === 'serviette')?.quantity, '5');
  assert.ok(equipment.some((item) => item.key === 'diable'));
  assert.ok(equipment.some((item) => item.key === 'visseuse'));
  assert.ok(
    fatigueAdvice(lines, inventory, 6).rows.some(([label]) => label === 'Limite ISO 11228-1'),
  );
});

test('la fatigue reprend le poids et les distances ISO calculés avec les réglages du devis', () => {
  const inventory = blankInventory();
  inventory.fromFloor = 1;
  inventory.toFloor = 2;
  inventory.flags.acces = true;
  const estimate = {
    totalWeightKg: 1234,
    fromIsoDistanceMeters: 47,
    toIsoDistanceMeters: 62,
    fromIsoLimitKg: 2553,
    toIsoLimitKg: 1935,
  } as Parameters<typeof fatigueAdvice>[3];

  const result = fatigueAdvice([], inventory, 4, estimate);
  assert.deepEqual(result.rows.slice(0, 6), [
    ['Durée totale', 'Non calculée'],
    ['Effort de portage', '200 W/m² au départ · 200 W/m² à l’arrivée'],
    ['Poids total à porter', '≈ 1 234 kg'],
    ['Limite ISO 11228-1', '2 553 kg au départ · 1 935 kg à l’arrivée'],
    ['Départ · arrivée', '1er étage sans ascenseur · 2e étage sans ascenseur'],
    ['Équipe', '4 manœuvres'],
  ]);
});

test('sans estimation, le même accès est appliqué au départ et à l’arrivée', () => {
  const inventory = blankInventory();
  inventory.flags.acces = true;
  const result = fatigueAdvice([], inventory, 2);
  const limits = result.rows.find(([label]) => label === 'Limite ISO 11228-1')?.[1];
  assert.equal(limits, '4 000 kg au départ · 4 000 kg à l’arrivée');
});

test('la manutention reprend le score de la référence sans majoration par la chaleur', () => {
  const inventory = blankInventory();
  const lines: SimulationLine[] = [{ k: 'frigo', q: 1, s: 0, g: 'g', dm: false, n: 'Frigo' }];
  const estimate = {
    totalWeightKg: 1234,
    fromIsoDistanceMeters: 47,
    toIsoDistanceMeters: 62,
    fromIsoLimitKg: 2553,
    toIsoLimitKg: 1935,
    heat: { wbgt: 30, reference: 25, work: 100, rest: 20 },
    heatPenalty: 0,
  } as Parameters<typeof fatigueAdvice>[3];
  const result = fatigueAdvice(lines, inventory, 4, estimate);
  const heavy = simulationLineWeight(lines[0]!).max;
  const expected = Math.round(
    ((1234 / 2553 + 1234 / 1935) / 4) * 100 * (heavy > 33 ? 1.04 : heavy > 25 ? 1.02 : 1),
  );
  assert.equal(result.gauges[1]?.score, expected);
  assert.equal(result.score, expected);
});
