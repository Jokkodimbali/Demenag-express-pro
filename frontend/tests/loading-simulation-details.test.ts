import assert from 'node:assert/strict';
import test from 'node:test';
import { blankInventory } from '../src/domain/inventory';
import {
  crewPosts,
  equipmentAdvice,
  fatigueAdvice,
  handlingAdvice,
  simulationLineWeight,
  type SimulationLine,
} from '../src/domain/loading-simulation-details';

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
    fatigueAdvice(lines, inventory, 6).rows.some(
      ([label]) => label === 'Limite ISO 11228-1 au départ',
    ),
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
    ['Poids total à porter', '≈ 1 234 kg'],
    ['Durée totale prévue', 'Non calculée'],
    ['Effort départ · arrivée', '200 · 200 W/m²'],
    ['Masse portée par manœuvre', '≈ 617 kg'],
    ['Limite ISO 11228-1 au départ', '2 553 kg / jour (47 m équivalents)'],
    ['Limite ISO 11228-1 à l’arrivée', '1 935 kg / jour (62 m équivalents)'],
  ]);
});

test('sans estimation, le même accès est appliqué au départ et à l’arrivée', () => {
  const inventory = blankInventory();
  inventory.flags.acces = true;
  const result = fatigueAdvice([], inventory, 2);
  const from = result.rows.find(([label]) => label === 'Limite ISO 11228-1 au départ')?.[1];
  const to = result.rows.find(([label]) => label === 'Limite ISO 11228-1 à l’arrivée')?.[1];
  assert.equal(from, '4 000 kg / jour (30 m équivalents)');
  assert.equal(to, from);
});
