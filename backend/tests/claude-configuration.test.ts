import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaClaudeConfiguration } from '../src/adapters/out/prisma/claude-configuration.js';

type EncryptedRow = {
  cleChiffree: string;
  vecteur: string;
  etiquette: string;
  modele: string;
  modeles: { id: string; name: string }[];
};

function createRepository(secret = 'settings-test-encryption-secret') {
  let row: EncryptedRow | null = null;
  const repository = new PrismaClaudeConfiguration(
    {
      configurationClaude: {
        findUnique: async () => row,
        upsert: async ({ create }: { create: EncryptedRow }) => {
          row = create;
        },
        update: async ({ data }: { data: Partial<EncryptedRow> }) => {
          if (row) row = { ...row, ...data };
        },
        deleteMany: async () => {
          row = null;
        },
      },
    } as unknown as PrismaClient,
    secret,
  );
  return { repository, getRow: () => row };
}

test('la clé Claude est chiffrée en base et relue après redémarrage', async () => {
  const { repository, getRow } = createRepository();
  const key = 'sk-ant-api-test-key';
  await repository.saveKey(key, {
    model: 'claude-opus-test',
    models: [{ id: 'claude-opus-test', name: 'Claude Opus test' }],
  });

  const stored = getRow();
  assert.ok(stored);
  assert.notEqual(stored.cleChiffree, key);
  assert.equal(await repository.apiKey(), key);
  assert.deepEqual(await repository.find(), {
    model: 'claude-opus-test',
    models: [{ id: 'claude-opus-test', name: 'Claude Opus test' }],
  });
});

test('la clé Claude refuse un déchiffrement avec un secret serveur différent', async () => {
  const { repository, getRow } = createRepository();
  await repository.saveKey('sk-ant-api-test-key', { model: 'claude-opus-test', models: [] });
  const stored = getRow();
  assert.ok(stored);
  const db = {
    configurationClaude: {
      findUnique: async () => stored,
      upsert: async () => undefined,
      update: async () => undefined,
      deleteMany: async () => undefined,
    },
  } as unknown as PrismaClient;
  const mismatched = new PrismaClaudeConfiguration(db, 'another-server-secret');
  await assert.rejects(() => mismatched.apiKey(), /ne peut pas être déchiffrée/u);
});
