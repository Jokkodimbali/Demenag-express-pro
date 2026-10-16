import type { CatalogueRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Catalogue, Settings, Vehicle } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { fromSettings, fromVehicle, toSettings, toVehicle } from './mapping.js';
export class PrismaCatalogue implements CatalogueRepository {
  constructor(private db: PrismaClient) {}
  async get(): Promise<Catalogue> {
    const [rows, settings] = await Promise.all([
      this.db.vehicule.findMany({ orderBy: { nom: 'asc' } }),
      this.db.parametreApplication.findUnique({ where: { id: 'main' } }),
    ]);
    if (!settings) throw new AppError(503, messages.leCatalogueDoitEtreInitialise);
    return {
      vehicles: rows.map(fromVehicle),
      settings: fromSettings(settings),
    };
  }
  async update(vehicles: Vehicle[], settings: Settings) {
    await this.db.$transaction([
      ...vehicles.map((v) =>
        this.db.vehicule.upsert({
          where: { id: v.id },
          update: toVehicle(v),
          create: toVehicle(v),
        }),
      ),
      this.db.parametreApplication.update({ where: { id: 'main' }, data: toSettings(settings) }),
    ]);
  }
}
