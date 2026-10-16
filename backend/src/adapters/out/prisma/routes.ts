import type { RouteRepository } from '../../../application/ports/index.js';
import type { RouteTicket } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { json } from './helpers.js';
export class PrismaRoutes implements RouteRepository {
  constructor(private db: PrismaClient) {}
  async save(route: RouteTicket) {
    await this.db.itineraire.deleteMany({ where: { expireLe: { lt: new Date() } } });
    await this.db.itineraire.create({
      data: { id: route.id, donnees: json(route), expireLe: new Date(route.expiresAt) },
    });
  }
  async find(id: string) {
    const row = await this.db.itineraire.findUnique({ where: { id } });
    return row && row.expireLe > new Date() ? (row.donnees as unknown as RouteTicket) : null;
  }
}
