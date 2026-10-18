import type { BreakdownInput, VehicleInspectionInput, VehicleReportRepository } from '../../../application/ports/index.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

const inspectionInclude = { chauffeur: { select: { nom: true, telephone: true } }, vehicule: { select: { id: true, nom: true, image: true } } } as const;
const breakdownInclude = inspectionInclude;
export class PrismaVehicleReports implements VehicleReportRepository {
  constructor(private readonly db: PrismaClient) {}
  async createInspection(driverId: string, vehicleId: string, date: string, input: VehicleInspectionInput) {
    const row = await this.db.controleVehicule.create({ data: { chauffeurId: driverId, vehiculeId: vehicleId, dateControle: new Date(`${date}T00:00:00.000Z`), niveaux: input.levels, etatVehicule: input.condition, observations: input.notes, photos: input.photos }, include: inspectionInclude });
    return this.inspection(row);
  }
  async createBreakdown(driverId: string, vehicleId: string, input: BreakdownInput) {
    const row = await this.db.signalementPanne.create({ data: { chauffeurId: driverId, vehiculeId: vehicleId, description: input.description, latitude: input.latitude, longitude: input.longitude, precision: input.accuracy, photos: input.photos }, include: breakdownInclude });
    return this.breakdown(row);
  }
  async listInspections() { return (await this.db.controleVehicule.findMany({ include: inspectionInclude, orderBy: { creeLe: 'desc' }, take: 300 })).map((r) => this.inspection(r)); }
  async listBreakdowns() { return (await this.db.signalementPanne.findMany({ include: breakdownInclude, orderBy: { creeLe: 'desc' }, take: 300 })).map((r) => this.breakdown(r)); }
  async listDriverInspections(driverId: string) { return (await this.db.controleVehicule.findMany({ where: { chauffeurId: driverId }, include: inspectionInclude, orderBy: { creeLe: 'desc' }, take: 30 })).map((r) => this.inspection(r)); }
  async listDriverBreakdowns(driverId: string) { return (await this.db.signalementPanne.findMany({ where: { chauffeurId: driverId }, include: breakdownInclude, orderBy: { creeLe: 'desc' }, take: 30 })).map((r) => this.breakdown(r)); }
  async findInspection(driverId: string, date: string) {
    const row = await this.db.controleVehicule.findUnique({ where: { chauffeurId_dateControle: { chauffeurId: driverId, dateControle: new Date(`${date}T00:00:00.000Z`) } }, include: inspectionInclude });
    return row ? this.inspection(row) : null;
  }
  private inspection(row: any) { return { id: row.id, driverId: row.chauffeurId, driverName: row.chauffeur.nom, driverPhone: row.chauffeur.telephone, vehicleId: row.vehicule.id, vehicleName: row.vehicule.nom, vehicleImage: row.vehicule.image, date: row.dateControle.toISOString().slice(0, 10), levels: row.niveaux, condition: row.etatVehicule, notes: row.observations, photos: row.photos, createdAt: row.creeLe.toISOString() }; }
  private breakdown(row: any) { return { id: row.id, driverId: row.chauffeurId, driverName: row.chauffeur.nom, driverPhone: row.chauffeur.telephone, vehicleId: row.vehicule.id, vehicleName: row.vehicule.nom, vehicleImage: row.vehicule.image, description: row.description, latitude: row.latitude, longitude: row.longitude, accuracy: row.precision, photos: row.photos, status: row.statut, createdAt: row.creeLe.toISOString() }; }
}
