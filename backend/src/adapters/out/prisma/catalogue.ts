import type { CatalogueRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type {
  Catalogue,
  Settings,
  TollPoint,
  TollPointInput,
  Vehicle,
} from '../../../domain/model.js';
import { Prisma, type PointPeage, type PrismaClient } from '../../../generated/prisma/client.js';
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
  async removeVehicle(id: string) {
    await this.db.$transaction(async (tx) => {
      const [bookingCount, driverCount] = await Promise.all([
        tx.reservation.count({ where: { vehiculeId: id } }),
        tx.chauffeur.count({ where: { vehiculeId: id } }),
      ]);
      if (bookingCount > 0)
        throw new AppError(
          409,
          `Impossible : ce véhicule est utilisé dans ${bookingCount} réservation${bookingCount > 1 ? 's' : ''}.`,
        );
      if (driverCount > 0)
        throw new AppError(409, 'Impossible : un membre de l’équipe est affecté à ce véhicule.');
      try {
        await tx.vehicule.delete({ where: { id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
          throw new AppError(404, 'Véhicule introuvable.');
        throw error;
      }
    });
  }
  async listTollPoints(): Promise<TollPoint[]> {
    const rows = await this.db.pointPeage.findMany({
      orderBy: [{ creeLe: 'asc' }, { id: 'asc' }],
    });
    return rows.map(fromTollPoint);
  }
  async createTollPoint(input: TollPointInput): Promise<TollPoint> {
    try {
      return fromTollPoint(await this.db.pointPeage.create({ data: toTollPoint(input) }));
    } catch (error) {
      throw tollPointError(error);
    }
  }
  async updateTollPoint(id: string, input: TollPointInput): Promise<TollPoint> {
    try {
      return fromTollPoint(
        await this.db.pointPeage.update({ where: { id }, data: toTollPoint(input) }),
      );
    } catch (error) {
      throw tollPointError(error);
    }
  }
  async deleteTollPoint(id: string): Promise<void> {
    try {
      await this.db.pointPeage.delete({ where: { id } });
    } catch (error) {
      throw tollPointError(error);
    }
  }
}

function fromTollPoint(row: PointPeage): TollPoint {
  return {
    id: row.id,
    name: row.nom,
    region: row.region,
    axis: row.axe,
    heavyPrice: row.tarifLourd,
    vehiclePrices: (row.tarifsVehicules ?? {}) as Record<string, number>,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function toTollPoint(input: TollPointInput) {
  return {
    nom: input.name.trim(),
    region: input.region.trim(),
    axe: input.axis.trim(),
    tarifLourd: input.heavyPrice,
    tarifsVehicules: input.vehiclePrices,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

function tollPointError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return new AppError(409, 'Ce point de péage existe déjà.');
    if (error.code === 'P2025') return new AppError(404, 'Point de péage introuvable.');
  }
  return error;
}
