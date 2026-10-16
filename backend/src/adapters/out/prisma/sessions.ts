import type { SessionRepository } from '../../../application/ports/index.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { safeUser } from './helpers.js';
import { fromUser } from './mapping.js';
export class PrismaSessions implements SessionRepository {
  constructor(private db: PrismaClient) {}
  async create(tokenHash: string, userId: string, expiresAt: Date) {
    await this.db.sessionConnexion.deleteMany({ where: { expireLe: { lt: new Date() } } });
    await this.db.sessionConnexion.create({
      data: { empreinteJeton: tokenHash, utilisateurId: userId, expireLe: expiresAt },
    });
  }
  async findUser(tokenHash: string) {
    const session = await this.db.sessionConnexion.findUnique({
      where: { empreinteJeton: tokenHash },
      include: { utilisateur: true },
    });
    return session && session.utilisateur.actif && session.expireLe > new Date()
      ? safeUser(fromUser(session.utilisateur))
      : null;
  }
  async deleteForUser(userId: string) {
    await this.db.sessionConnexion.deleteMany({ where: { utilisateurId: userId } });
  }
  async delete(tokenHash: string) {
    await this.db.sessionConnexion.deleteMany({ where: { empreinteJeton: tokenHash } });
  }
}
