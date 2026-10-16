import { AppError } from '../../domain/errors.js';
import type { User } from '../../domain/model.js';
import type {
  AdministrationRepository,
  IdGenerator,
  PasswordHasher,
  UserRepository,
} from '../ports/index.js';
import { normalizePhone } from './auth.js';
export class AdministrationService {
  constructor(
    private repository: AdministrationRepository,
    private users: UserRepository,
    private passwords: PasswordHasher,
    private ids: IdGenerator,
  ) {}
  private authorize(actor: User) {
    if (actor.role !== 'admin') throw new AppError(403, 'Action réservée à l’administration.');
  }
  listUsers(actor: User) {
    this.authorize(actor);
    return this.repository.listUsers();
  }
  updateUser(actor: User, user: User) {
    this.authorize(actor);
    if (user.id === actor.id && (user.role !== 'admin' || user.active === false))
      throw new AppError(400, 'Vous ne pouvez pas retirer votre propre accès administrateur.');
    return this.repository.updateUser(actor.id, { ...user, phone: normalizePhone(user.phone) });
  }
  async createUser(actor: User, input: Omit<User, 'id'> & { password: string }) {
    this.authorize(actor);
    return this.users.create({
      id: this.ids.next(),
      name: input.name,
      phone: normalizePhone(input.phone),
      role: input.role,
      active: true,
      passwordHash: await this.passwords.hash(input.password),
    });
  }
}
