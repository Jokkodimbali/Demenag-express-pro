import { AppError } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  SessionRepository,
  TokenProvider,
  UserRepository,
} from '../ports/index.js';
import type { AuthUseCases } from '../ports/use-cases.js';
export function normalizePhone(phone: string) {
  const clean = phone.replace(/[\s().-]/g, '').replace(/^00/, '+');
  const local = clean.replace(/^\+?221/, '');
  if (!/^(70|71|75|76|77|78)\d{7}$/.test(local))
    throw new AppError(400, messages.saisissezUnNumeroMobileSenegalaisValide);
  return '+221' + local;
}
export class AuthService implements AuthUseCases {
  constructor(
    private users: UserRepository,
    private sessions: SessionRepository,
    private passwords: PasswordHasher,
    private tokens: TokenProvider,
    private clock: Clock,
    private ids: IdGenerator,
  ) {}
  async register(name: string, phone: string, password: string) {
    const normalized = normalizePhone(phone);
    if (await this.users.findByPhone(normalized))
      throw new AppError(409, messages.unCompteUtiliseDejaCeNumero);
    const user = await this.users.create({
      id: this.ids.next(),
      name,
      phone: normalized,
      passwordHash: await this.passwords.hash(password),
      role: 'client',
      active: false,
    });
    return this.issue(user);
  }
  async login(phone: string, password: string) {
    const user = await this.users.findByPhone(normalizePhone(phone));
    const valid = await this.passwords.verify(password, user?.passwordHash ?? '');
    if (!user || user.active === false || !valid)
      throw new AppError(401, messages.telephoneOuMotDePasseIncorrect);
    return this.issue({ id: user.id, name: user.name, phone: user.phone, role: user.role });
  }
  async changePassword(
    user: { id: string; phone: string; name: string; role: 'client' | 'admin' | 'driver' },
    oldPassword: string,
    newPassword: string,
  ) {
    const account = await this.users.findByPhone(user.phone);
    if (!account || !(await this.passwords.verify(oldPassword, account.passwordHash)))
      throw new AppError(400, messages.motDePasseActuelIncorrect);
    await this.users.updatePassword(user.id, await this.passwords.hash(newPassword));
    await this.sessions.deleteForUser(user.id);
    return this.issue(user);
  }
  private async issue(user: {
    id: string;
    name: string;
    phone: string;
    role: 'client' | 'admin' | 'driver';
  }) {
    const token = this.tokens.create();
    await this.sessions.create(
      this.tokens.digest(token),
      user.id,
      new Date(+this.clock.now() + 7 * 86400000),
    );
    return { user, token };
  }
  async current(token?: string) {
    return token ? this.sessions.findUser(this.tokens.digest(token)) : null;
  }
  async logout(token?: string) {
    if (token) await this.sessions.delete(this.tokens.digest(token));
  }
}
