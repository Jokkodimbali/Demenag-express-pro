import type { RouteRepository } from '../../../application/ports/index.js';
import type { RouteTicket } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { json } from './helpers.js';
export class PrismaRoutes implements RouteRepository {
  private lastCleanupAt = 0;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private db: PrismaClient) {}

  private async cleanupExpired() {
    if (Date.now() - this.lastCleanupAt < 60_000) return;
    if (!this.cleanupPromise) {
      this.cleanupPromise = this.db.itineraire
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

  async save(route: RouteTicket) {
    await this.cleanupExpired();
    await this.db.itineraire.create({
      data: { id: route.id, donnees: json(route), expireLe: new Date(route.expiresAt) },
    });
  }
  async find(id: string) {
    const row = await this.db.itineraire.findUnique({ where: { id } });
    return row && row.expireLe > new Date() ? (row.donnees as unknown as RouteTicket) : null;
  }
}
