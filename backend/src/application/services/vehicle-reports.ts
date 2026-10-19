import { AppError } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type { User } from '../../domain/model.js';
import { requireActiveUser, requireAdministrator } from '../../domain/policies/access.js';
import type {
  BreakdownInput,
  DriverRepository,
  NotificationPublisher,
  VehicleInspectionInput,
  VehicleReportRepository,
} from '../ports/index.js';
import type { VehicleReportUseCases } from '../ports/use-cases.js';

function dakarDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export class VehicleReportService implements VehicleReportUseCases {
  constructor(
    private readonly reports: VehicleReportRepository,
    private readonly drivers: DriverRepository,
    private readonly notifications?: NotificationPublisher,
  ) {}
  async submitInspection(actor: User, input: VehicleInspectionInput) {
    const driver = await this.driver(actor);
    if (!driver.vehicleId) throw new AppError(400, 'Aucun véhicule ne vous est affecté.');
    if (input.photos.length !== 6)
      throw new AppError(
        400,
        'Ajoutez une photo de preuve pour chacun des cinq niveaux et pour l’état général du véhicule.',
      );
    const date = dakarDate();
    const previousInspection = await this.reports.findInspection(driver.id, date);
    if (Array.isArray(previousInspection?.photos) && previousInspection.photos.length === 6)
      throw new AppError(409, 'Le contrôle du véhicule a déjà été envoyé pour aujourd’hui.');
    const report = await this.reports.createInspection(driver.id, driver.vehicleId, date, input);
    this.notify(
      'Contrôle véhicule reçu',
      `${driver.name} a envoyé le contrôle quotidien du véhicule.`,
      `inspection-${driver.id}-${date}`,
    );
    return report;
  }
  async reportBreakdown(actor: User, input: BreakdownInput) {
    const driver = await this.driver(actor);
    if (!driver.vehicleId) throw new AppError(400, 'Aucun véhicule ne vous est affecté.');
    const report = await this.reports.createBreakdown(driver.id, driver.vehicleId, input);
    this.notify(
      'Panne signalée',
      `${driver.name} a signalé une panne.`,
      `breakdown-${String(report.id)}`,
    );
    return report;
  }
  async driverReports(actor: User) {
    const driver = await this.driver(actor);
    const [inspections, breakdowns] = await Promise.all([
      this.reports.listDriverInspections(driver.id),
      this.reports.listDriverBreakdowns(driver.id),
    ]);
    return { inspections, breakdowns };
  }
  async adminReports(actor: User) {
    requireAdministrator(actor);
    const [inspections, breakdowns] = await Promise.all([
      this.reports.listInspections(),
      this.reports.listBreakdowns(),
    ]);
    return { inspections, breakdowns };
  }
  private async driver(actor: User) {
    requireActiveUser(actor);
    if (actor.role !== 'driver') throw new AppError(403, messages.actionReserveeAuxChauffeurs);
    const driver = await this.drivers.findByUserId(actor.id);
    if (!driver) throw new AppError(404, messages.profilChauffeurIntrouvable);
    return driver;
  }
  private notify(title: string, message: string, id: string) {
    void this.notifications?.publish(
      { id, title, message, createdAt: new Date().toISOString() },
      { roles: ['admin'] },
    );
  }
}
