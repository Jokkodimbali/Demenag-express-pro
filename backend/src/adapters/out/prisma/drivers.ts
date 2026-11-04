import type { DriverRepository } from '../../../application/ports/index.js';
import type { Driver } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict } from './helpers.js';
import { fromDriver, toDriver } from './mapping.js';

export class PrismaDrivers implements DriverRepository {
  constructor(private readonly db: PrismaClient) {}
  async list() {
    return (await this.db.chauffeur.findMany({ orderBy: { nom: 'asc' } })).map(fromDriver);
  }
  async vehicleExists(id: string) {
    return (await this.db.vehicule.findUnique({ where: { id }, select: { id: true } })) !== null;
  }
  async find(id: string) {
    const row = await this.db.chauffeur.findUnique({ where: { id } });
    return row ? fromDriver(row) : null;
  }
  async findByUserId(userId: string) {
    const row = await this.db.chauffeur.findUnique({ where: { utilisateurId: userId } });
    return row ? fromDriver(row) : null;
  }
  async create(driver: Driver) {
    try {
      return await this.db.$transaction(async (transaction) => {
        if (driver.vehicleId)
          await transaction.chauffeur.updateMany({
            where: { vehiculeId: driver.vehicleId, id: { not: driver.id } },
            data: { vehiculeId: null },
          });
        return fromDriver(await transaction.chauffeur.create({ data: toDriver(driver) }));
      });
    } catch (error) {
      conflict(error);
    }
  }
  async update(driver: Driver) {
    try {
      return await this.db.$transaction(async (transaction) => {
        if (driver.vehicleId)
          await transaction.chauffeur.updateMany({
            where: { vehiculeId: driver.vehicleId, id: { not: driver.id } },
            data: { vehiculeId: null },
          });
        const row = await transaction.chauffeur.update({
          where: { id: driver.id },
          data: toDriver(driver),
        });
        if (driver.userId)
          await transaction.utilisateur.update({
            where: { id: driver.userId },
            data: {
              nom: driver.name,
              telephone: driver.phone,
              photo: driver.photo,
              actif: driver.active,
            },
          });
        return fromDriver(row);
      });
    } catch (error) {
      conflict(error);
    }
  }
  async delete(id: string) {
    await this.db.chauffeur.delete({ where: { id } });
  }
}
