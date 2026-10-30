import type {
  BreakdownInput,
  VehicleInspectionInput,
  VehicleReportRepository,
} from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';

const inspectionInclude = {
  chauffeur: { select: { nom: true, telephone: true } },
  vehicule: { select: { id: true, nom: true, image: true } },
} as const;
const breakdownInclude = inspectionInclude;
type InspectionRow = Prisma.ControleVehiculeGetPayload<{ include: typeof inspectionInclude }>;
type BreakdownRow = Prisma.SignalementPanneGetPayload<{ include: typeof breakdownInclude }>;
export class PrismaVehicleReports implements VehicleReportRepository {
  constructor(private readonly db: PrismaClient) {}
  async createInspection(
    driverId: string,
    vehicleId: string,
    date: string,
    input: VehicleInspectionInput,
  ) {
    const row = await this.db.controleVehicule.create({
      data: {
        chauffeurId: driverId,
        vehiculeId: vehicleId,
        dateControle: new Date(`${date}T00:00:00.000Z`),
        niveaux: input.levels,
        etatVehicule: input.condition,
        observations: input.notes,
        photos: input.photos,
      },
      include: inspectionInclude,
    });
    return this.inspection(row);
  }
  async createBreakdown(driverId: string, vehicleId: string, input: BreakdownInput) {
    const row = await this.db.signalementPanne.create({
      data: {
        chauffeurId: driverId,
        vehiculeId: vehicleId,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        precision: input.accuracy,
        photos: input.photos,
      },
      include: breakdownInclude,
    });
    return this.breakdown(row);
  }
  async updateInspectionLevel(id: string, key: string, level: 'good' | 'low') {
    const row = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "demenag"."vehicle_inspections" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await tx.controleVehicule.findUnique({ where: { id } });
      if (!current) throw new AppError(404, 'Contrôle introuvable.');
      const photos = Array.isArray(current.photos) ? current.photos : [];
      const levels = { ...(current.niveaux as Record<string, string>), [key]: level };
      const condition = Object.values(levels).every((value) => value === 'good')
        ? 'good'
        : 'attention';
      return tx.controleVehicule.update({
        where: { id },
        data: {
          niveaux: levels,
          etatVehicule: condition,
          // Adding fuel switches the legacy layout to the current five-point layout.
          // Migrate the photos atomically with that switch, including its empty fuel slot.
          ...(key === 'fuel' && !('fuel' in (current.niveaux as Record<string, string>))
            ? {
                photos: [
                  ...[0, 2, 1, 4, -1].map((index) => photos[index] ?? ''),
                  ...photos.filter((_, index) => ![0, 2, 1, 4].includes(index)),
                ],
              }
            : {}),
        },
        include: inspectionInclude,
      });
    });
    return this.inspection(row);
  }
  async deleteInspection(id: string) {
    try {
      await this.db.controleVehicule.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025')
        throw new AppError(404, 'Contrôle introuvable.');
      throw error;
    }
  }
  async listInspections() {
    return (
      await this.db.controleVehicule.findMany({
        include: inspectionInclude,
        orderBy: { creeLe: 'desc' },
      })
    ).map((r) => this.inspection(r));
  }
  async listBreakdowns() {
    return (
      await this.db.signalementPanne.findMany({
        include: breakdownInclude,
        orderBy: { creeLe: 'desc' },
      })
    ).map((r) => this.breakdown(r));
  }
  async listDriverInspections(driverId: string) {
    return (
      await this.db.controleVehicule.findMany({
        where: { chauffeurId: driverId },
        include: inspectionInclude,
        orderBy: { creeLe: 'desc' },
      })
    ).map((r) => this.inspection(r));
  }
  async listDriverBreakdowns(driverId: string) {
    return (
      await this.db.signalementPanne.findMany({
        where: { chauffeurId: driverId },
        include: breakdownInclude,
        orderBy: { creeLe: 'desc' },
        take: 30,
      })
    ).map((r) => this.breakdown(r));
  }
  async findInspection(driverId: string, date: string) {
    const row = await this.db.controleVehicule.findFirst({
      where: { chauffeurId: driverId, dateControle: new Date(`${date}T00:00:00.000Z`) },
      orderBy: { creeLe: 'desc' },
      include: inspectionInclude,
    });
    return row ? this.inspection(row) : null;
  }
  private inspection(row: InspectionRow) {
    return {
      id: row.id,
      driverId: row.chauffeurId,
      driverName: row.chauffeur.nom,
      driverPhone: row.chauffeur.telephone,
      vehicleId: row.vehicule.id,
      vehicleName: row.vehicule.nom,
      vehicleImage: row.vehicule.image,
      date: row.dateControle.toISOString().slice(0, 10),
      levels: row.niveaux,
      condition: row.etatVehicule,
      notes: row.observations,
      photos: row.photos,
      createdAt: row.creeLe.toISOString(),
    };
  }
  private breakdown(row: BreakdownRow) {
    return {
      id: row.id,
      driverId: row.chauffeurId,
      driverName: row.chauffeur.nom,
      driverPhone: row.chauffeur.telephone,
      vehicleId: row.vehicule.id,
      vehicleName: row.vehicule.nom,
      vehicleImage: row.vehicule.image,
      description: row.description,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.precision,
      photos: row.photos,
      status: row.statut,
      createdAt: row.creeLe.toISOString(),
    };
  }
}
