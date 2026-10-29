import assert from 'node:assert/strict';
import test from 'node:test';
import { AdministrationService } from '../src/application/services/administration.js';
import type {
  AdministrationRepository,
  AdministrationTransaction,
  UserRepository,
} from '../src/application/ports/index.js';
import type { User } from '../src/domain/model.js';
const actor: User = {
  id: 'admin',
  name: 'Admin',
  phone: '+221771411251',
  role: 'admin',
  active: true,
};
const target: User = { ...actor, id: 'other' };
function fixture(count: number, currentActor: User = actor) {
  const saved: User[] = [];
  const revoked: string[] = [];
  const transaction: AdministrationTransaction = {
    findUser: async (id) => (id === actor.id ? currentActor : target),
    countActiveAdministrators: async () => count,
    saveUser: async (user) => {
      saved.push(user);
      return user;
    },
    revokeSessions: async (id) => {
      revoked.push(id);
    },
  };
  const repository: AdministrationRepository = {
    listUsers: async () => [actor, target],
    listHiddenClients: async () => [],
    listClientProfiles: async () => [],
    hideClient: async (phone) => ({ phone, hiddenAt: new Date().toISOString() }),
    updateClient: async () => {},
    transaction: (work) => work(transaction),
  };
  const users: UserRepository = {
    findByPhone: async () => null,
    create: async (user) => user,
    updatePassword: async () => {},
    updateProfile: async (id, name, phone, photo) => ({
      id,
      name,
      phone,
      role: 'admin',
      active: true,
      photo: photo ?? null,
    }),
  };
  const service = new AdministrationService(
    repository,
    users,
    { hash: async (value) => value, verify: async () => false },
    { next: () => 'id' },
  );
  return { service, saved, revoked };
}
test('Le service révoque les sessions après une rétrogradation, sans dépendre de Prisma', async () => {
  const { service, saved, revoked } = fixture(2);
  const updated = await service.updateUser(actor, { ...target, role: 'client' });
  assert.equal(updated.role, 'client');
  assert.equal(saved.length, 1);
  assert.deepEqual(revoked, [target.id]);
});
test('Le service refuse de retirer le dernier administrateur et ne persiste rien', async () => {
  const { service, saved, revoked } = fixture(1);
  await assert.rejects(service.updateUser(actor, { ...target, active: false }));
  assert.deepEqual(saved, []);
  assert.deepEqual(revoked, []);
});
test('Le service revérifie les droits dans la transaction', async () => {
  const { service, saved } = fixture(2, { ...actor, active: false });
  await assert.rejects(service.updateUser(actor, { ...target, name: 'Modified' }));
  assert.deepEqual(saved, []);
});
