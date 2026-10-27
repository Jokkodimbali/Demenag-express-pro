import { AppError } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type { Driver, User } from '../../domain/model.js';
import { requireActiveUser, requireAdministrator } from '../../domain/policies/access.js';
import type {
  BookingRepository,
  DriverRepository,
  IdGenerator,
  NotificationPublisher,
  PasswordHasher,
  UserRepository,
} from '../ports/index.js';
import type { DriverCreation, DriverUpdate, DriverUseCases } from '../ports/use-cases.js';
import { normalizePhone } from './auth.js';

export class DriverService implements DriverUseCases {
  constructor(
    private readonly drivers: DriverRepository,
    private readonly users: UserRepository,
    private readonly bookingsRepository: BookingRepository,
    private readonly passwords: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly notifications?: NotificationPublisher,
  ) {}
  async list(actor: User) {
    requireAdministrator(actor);
    return this.drivers.list();
  }
  async create(actor: User, input: DriverCreation) {
    requireAdministrator(actor);
    const phone = normalizePhone(input.phone);
    if (await this.users.findByPhone(phone))
      throw new AppError(409, messages.unCompteUtiliseDejaCeNumero);
    const user = await this.users.create({
      id: this.ids.next(),
      name: input.name,
      phone,
      passwordHash: await this.passwords.hash(input.password),
      role: 'driver',
      active: true,
    });
    const driver = {
      id: this.ids.next(),
      userId: user.id,
      name: input.name,
      phone,
      photo: input.photo,
      active: true,
      vehicleId: input.vehicleId,
    };
    await this.releaseVehicle(driver.vehicleId, driver.id);
    const created = await this.drivers.create(driver);
    if (created.vehicleId) await this.notifyVehicleAssignment(created);
    return created;
  }
  async update(actor: User, input: DriverUpdate) {
    requireAdministrator(actor);
    const current = await this.drivers.find(input.id);
    if (!current) throw new AppError(404, messages.chauffeurIntrouvable);
    const phone = await this.availablePhone(input.phone, current.userId);
    await this.releaseVehicle(input.vehicleId, current.id);
    const updated = await this.drivers.update({ ...input, userId: current.userId, phone });
    if (current.userId) await this.users.updateProfile(current.userId, updated.name, updated.phone);
    if (current.vehicleId !== updated.vehicleId && updated.vehicleId)
      await this.notifyVehicleAssignment(updated);
    return updated;
  }
  async profile(actor: User) {
    return this.requireProfile(actor);
  }
  async updateProfile(actor: User, input: Pick<Driver, 'name' | 'phone' | 'photo'>) {
    const current = await this.requireProfile(actor);
    const phone = await this.availablePhone(input.phone, actor.id);
    const updated = await this.drivers.update({ ...current, ...input, phone });
    await this.users.updateProfile(actor.id, updated.name, updated.phone);
    return updated;
  }
  async updateAvailability(actor: User, availability: NonNullable<Driver['availability']>) {
    const current = await this.requireProfile(actor);
    return this.drivers.update({ ...current, availability });
  }
  async bookings(actor: User) {
    const profile = await this.requireProfile(actor);
    if (!profile.vehicleId) return [];
    return this.bookingsRepository.list(undefined, profile.vehicleId);
  }
  private async requireProfile(actor: User) {
    requireActiveUser(actor);
    if (actor.role !== 'driver') throw new AppError(403, messages.actionReserveeAuxChauffeurs);
    const profile = await this.drivers.findByUserId(actor.id);
    if (!profile) throw new AppError(404, messages.profilChauffeurIntrouvable);
    return profile;
  }
  private async availablePhone(value: string, userId: string | null) {
    const phone = normalizePhone(value);
    const existing = await this.users.findByPhone(phone);
    if (existing && existing.id !== userId)
      throw new AppError(409, messages.unCompteUtiliseDejaCeNumero);
    return phone;
  }
  private async releaseVehicle(vehicleId: string | null, driverId: string | null) {
    if (!vehicleId) return;
    const assigned = (await this.drivers.list()).find(
      (driver) => driver.vehicleId === vehicleId && driver.id !== driverId,
    );
    if (assigned) await this.drivers.update({ ...assigned, vehicleId: null });
  }
  private async notifyVehicleAssignment(driver: Driver) {
    if (!driver.userId) return;
    await this.notifications?.publish(
      {
        id: this.ids.next(),
        title: 'Véhicule affecté',
        message:
          'Un véhicule vous a été affecté. Vos missions associées sont disponibles dans votre espace chauffeur.',
        createdAt: new Date().toISOString(),
      },
      { userIds: [driver.userId] },
    );
  }
}
