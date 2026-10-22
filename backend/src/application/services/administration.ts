import { AppError } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type { User } from '../../domain/model.js';
import { requireAdministrator } from '../../domain/policies/access.js';
import type {
  AdministrationRepository,
  IdGenerator,
  PasswordHasher,
  UserRepository,
} from '../ports/index.js';
import type { AdministrationUseCases } from '../ports/use-cases.js';
import { normalizePhone } from './auth.js';
export class AdministrationService implements AdministrationUseCases {
  constructor(
    private repository: AdministrationRepository,
    private users: UserRepository,
    private passwords: PasswordHasher,
    private ids: IdGenerator,
  ) {}
  listUsers(actor: User) {
    requireAdministrator(actor);
    return this.repository.listUsers();
  }
  listHiddenClients(actor: User) {
    requireAdministrator(actor);
    return this.repository.listHiddenClients();
  }
  hideClient(actor: User, phone: string) {
    requireAdministrator(actor);
    return this.repository.hideClient(phone);
  }
  updateClient(actor: User, phone: string, name: string, nextPhone: string) {
    requireAdministrator(actor);
    return this.repository.updateClient(phone, name.trim(), normalizePhone(nextPhone));
  }
  updateUser(actor: User, user: User) {
    requireAdministrator(actor);
    if (user.id === actor.id && (user.role !== 'admin' || user.active === false))
      throw new AppError(400, messages.vousNePouvezPasRetirerVotrePropreAcces);
    const next = { ...user, phone: normalizePhone(user.phone) };
    return this.repository.transaction(async (repository) => {
      requireAdministrator(await repository.findUser(actor.id));
      const previous = await repository.findUser(next.id);
      if (!previous) throw new AppError(404, messages.compteIntrouvable);
      if (
        previous.role === 'admin' &&
        (next.role !== 'admin' || next.active === false) &&
        (await repository.countActiveAdministrators()) <= 1
      )
        throw new AppError(400, messages.conservezAuMoinsUnAdministrateurActif);
      const updated = await repository.saveUser(next);
      if (updated.active === false || previous.role !== updated.role)
        await repository.revokeSessions(next.id);
      return updated;
    });
  }
  async createUser(actor: User, input: Omit<User, 'id'> & { password: string }) {
    requireAdministrator(actor);
    return this.users.create({
      id: this.ids.next(),
      name: input.name,
      phone: normalizePhone(input.phone),
      role: input.role,
      active: true,
      passwordHash: await this.passwords.hash(input.password),
    });
  }
  async updateProfile(actor: User, input: Pick<User, 'name' | 'phone' | 'photo'>) {
    requireAdministrator(actor);
    return this.users.updateProfile(
      actor.id,
      input.name.trim(),
      normalizePhone(input.phone),
      input.photo ?? null,
    );
  }
}
