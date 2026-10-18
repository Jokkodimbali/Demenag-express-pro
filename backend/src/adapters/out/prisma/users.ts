import type { UserRepository } from '../../../application/ports/index.js';
import type { UserCredentials } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, safeUser } from './helpers.js';
import { fromUser, toUser } from './mapping.js';
export class PrismaUsers implements UserRepository {
  constructor(private db: PrismaClient) {}
  async updatePassword(userId: string, passwordHash: string) {
    await this.db.utilisateur.update({
      where: { id: userId },
      data: { empreinteMotDePasse: passwordHash },
    });
  }
  async updateProfile(userId: string, name: string, phone: string, photo?: string | null) {
    try {
      const row = await this.db.utilisateur.update({
        where: { id: userId },
        data: { nom: name, telephone: phone, ...(photo === undefined ? {} : { photo }) },
      });
      return safeUser(fromUser(row));
    } catch (error) {
      conflict(error);
    }
  }
  async findByPhone(phone: string) {
    const row = await this.db.utilisateur.findUnique({ where: { telephone: phone } });
    return row ? fromUser(row) : null;
  }
  async create(user: UserCredentials) {
    try {
      return safeUser(fromUser(await this.db.utilisateur.create({ data: toUser(user) })));
    } catch (error) {
      conflict(error);
    }
  }
}
