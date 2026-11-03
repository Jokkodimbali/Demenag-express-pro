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
