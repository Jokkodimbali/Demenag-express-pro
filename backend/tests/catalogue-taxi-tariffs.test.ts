import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaCatalogue } from '../src/adapters/out/prisma/catalogue.js';
import type { Settings } from '../src/domain/shared/model.js';

test('la mise à jour du catalogue remplace atomiquement les tarifs taxi par des lignes SQL', async () => {
  const operations: string[] = [];
  let insertedRows: unknown;
  type TransactionMock = {
    vehicule: { upsert: (input: unknown) => Promise<unknown> };
    parametreApplication: { update: (input: unknown) => Promise<unknown> };
    taxiDistanceTariff: {
      deleteMany: (input: unknown) => Promise<unknown>;
      createMany: (input: { data: unknown[] }) => Promise<unknown>;
    };
  };
  const transaction: TransactionMock = {
    vehicule: { upsert: async () => ({}) },
    parametreApplication: {
      update: async () => {
        operations.push('settings');
        return {};
      },
    },
    taxiDistanceTariff: {
      deleteMany: async () => {
        operations.push('delete-old-tariffs');
        return { count: 0 };
      },
      createMany: async (input) => {
        operations.push('insert-tariffs');
        insertedRows = input.data;
        return { count: input.data.length };
      },
    },
  };
  const db = {
    $transaction: async (callback: (tx: TransactionMock) => Promise<void>) => callback(transaction),
  } as unknown as PrismaClient;
  const tariffs = [
    {
      id: 'taxi-short',
      label: 'Course courte',
      minDistanceKm: 0,
      maxDistanceKm: 4,
      amountFcfa: 1800,
      sortOrder: 0,
    },
  ];

  await new PrismaCatalogue(db).update([], { taxiDistanceTariffs: tariffs } as Settings);

  assert.deepEqual(operations, ['settings', 'delete-old-tariffs', 'insert-tariffs']);
  assert.deepEqual(insertedRows, [{ ...tariffs[0], settingsId: 'main' }]);
});
