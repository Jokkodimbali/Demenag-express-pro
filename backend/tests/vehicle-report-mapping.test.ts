import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaVehicleReports } from '../src/adapters/out/prisma/vehicle-reports.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('ajouter le carburant à un ancien contrôle conserve les associations des photos', async () => {
  let row = {
    id: 'legacy',
    chauffeurId: 'driver',
    dateControle: new Date(),
    creeLe: new Date(),
    chauffeur: { nom: 'Conducteur', telephone: '' },
    vehicule: { id: 'truck', nom: 'Véhicule', image: '' },
    niveaux: { engineOil: 'good', coolant: 'good', brakeFluid: 'good', washerFluid: 'good' },
    photos: ['huile', 'refroidissement', 'freins', 'ancien-point', 'lave-glace'],
  };
  const tx = {
    $queryRaw: async () => [],
    controleVehicule: {
      findUnique: async () => row,
      update: async ({ data }: { data: Partial<typeof row> }) => {
        row = { ...row, ...data };
        return row;
      },
    },
  };
  const db = {
    $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as PrismaClient;
  const repository = new PrismaVehicleReports(db);
  await repository.updateInspectionLevel('legacy', 'fuel', 'good');
  assert.deepEqual(row.photos, [
    'huile',
    'freins',
    'refroidissement',
    'lave-glace',
    '',
    'ancien-point',
  ]);
  await repository.updateInspectionLevel('legacy', 'fuel', 'low');
  assert.deepEqual(row.photos, [
    'huile',
    'freins',
    'refroidissement',
    'lave-glace',
    '',
    'ancien-point',
  ]);
});

test('la liste des contrôles ne tronque pas silencieusement les données à 300', async () => {
  const rows = Array.from({ length: 301 }, (_, index) => ({
    id: String(index),
    chauffeurId: 'driver',
    dateControle: new Date(),
    creeLe: new Date(),
    chauffeur: { nom: 'Conducteur', telephone: '' },
    vehicule: { id: 'truck', nom: 'Véhicule', image: '' },
    niveaux: { fuel: 'good' },
    photos: [],
  }));
  const db = {
    controleVehicule: {
      findMany: async (query: { take?: number }) => rows.slice(0, query.take),
    },
  } as unknown as PrismaClient;
  const inspections = await new PrismaVehicleReports(db).listInspections();
  assert.equal(inspections.length, 301);
  assert.equal(inspections.at(-1)?.id, '300');
});
