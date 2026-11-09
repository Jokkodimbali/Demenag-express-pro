import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogueService } from '../src/application/services/catalogue.js';
import type { CatalogueRepository } from '../src/application/ports/index.js';
import type { User } from '../src/domain/model.js';

test('Le brouillon est adressé à son administrateur et refusé aux autres rôles', async () => {
  const calls: unknown[][] = [];
  const repository = {
    adminQuoteDraft: async (userId: string) => {
      calls.push(['read', userId]);
      return { draft: 'saved' };
    },
    saveAdminQuoteDraft: async (userId: string, data: unknown) => {
      calls.push(['save', userId, data]);
    },
    clearAdminQuoteDraft: async (userId: string) => {
      calls.push(['clear', userId]);
    },
  } as unknown as CatalogueRepository;
  const service = new CatalogueService(repository);
  const admin = { id: 'd251f068-d803-4f91-9f00-4215d914c8aa', role: 'admin' } as User;
  const client = { id: 'd251f068-d803-4f91-9f00-4215d914c8ab', role: 'client' } as User;

  assert.deepEqual(await service.adminQuoteDraft(admin), { draft: 'saved' });
  await service.saveAdminQuoteDraft(admin, { draft: 'new' });
  await service.clearAdminQuoteDraft(admin);
  assert.deepEqual(calls, [
    ['read', admin.id],
    ['save', admin.id, { draft: 'new' }],
    ['clear', admin.id],
  ]);
  assert.throws(() => service.adminQuoteDraft(client));
  assert.throws(() => service.saveAdminQuoteDraft(client, {}));
  assert.throws(() => service.clearAdminQuoteDraft(client));
  assert.equal(calls.length, 3);
});
