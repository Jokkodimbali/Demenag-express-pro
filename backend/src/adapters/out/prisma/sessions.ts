import type { SessionRepository } from '../../../application/ports/index.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { safeUser } from './helpers.js';
import { fromUser } from './mapping.js';
export class PrismaSessions implements SessionRepository {
  private lastCleanupAt = 0;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private db: PrismaClient) {}

  private async cleanupExpired() {
    if (Date.now() - this.lastCleanupAt < 60_000) return;
    if (!this.cleanupPromise) {
      this.cleanupPromise = this.db.sessionConnexion
        .deleteMany({ where: { expireLe: { lt: new Date() } } })
        .then(() => {
          this.lastCleanupAt = Date.now();
        })
        .finally(() => {
          this.cleanupPromise = null;
        });
    }
    await this.cleanupPromise;
  }

  async create(tokenHash: string, userId: string, expiresAt: Date) {
    await this.cleanupExpired();
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
