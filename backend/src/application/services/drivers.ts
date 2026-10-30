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
    if (input.password && (await this.users.findByPhone(phone)))
      throw new AppError(409, messages.unCompteUtiliseDejaCeNumero);
    const user = input.password
      ? await this.users.create({
          id: this.ids.next(),
          name: input.name,
          phone,
          passwordHash: await this.passwords.hash(input.password),
          role: 'driver',
          active: true,
        })
      : null;
    const driver = {
      id: this.ids.next(),
      userId: user?.id ?? null,
      name: input.name,
      phone,
      photo: input.photo,
      active: true,
      vehicleId: input.vehicleId,
      role: input.role ?? 'chauffeur',
      authorizedVehicleIds: input.authorizedVehicleIds ?? [],
      address: input.address ?? '',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      geocodedAddress: input.geocodedAddress ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? '',
      refusals: input.refusals ?? [],
      clearedRefusals: input.clearedRefusals ?? 0,
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
    const updated = await this.drivers.update({
      ...current,
      ...input,
      userId: current.userId,
      phone,
    });
    if (current.userId) await this.users.updateProfile(current.userId, updated.name, updated.phone);
    if (current.vehicleId !== updated.vehicleId && updated.vehicleId)
      await this.notifyVehicleAssignment(updated);
    return updated;
  }
  async remove(actor: User, id: string) {
    requireAdministrator(actor);
    const employee = await this.drivers.find(id);
    if (!employee) throw new AppError(404, messages.chauffeurIntrouvable);
    const bookings = await this.bookingsRepository.list(undefined, undefined, false);
    for (const booking of bookings) {
      const currentCrew = booking.crew ?? {
        chauffeur: booking.driverId ? [booking.driverId] : [],
        menuisier: [],
        manoeuvre: [],
        chef: '',
      };
      const hasMember = [
        ...currentCrew.chauffeur,
        ...currentCrew.menuisier,
        ...currentCrew.manoeuvre,
      ].includes(id);
      if (!hasMember) continue;
      const crew = {
        chauffeur: currentCrew.chauffeur.filter((memberId) => memberId !== id),
        menuisier: currentCrew.menuisier.filter((memberId) => memberId !== id),
        manoeuvre: currentCrew.manoeuvre.filter((memberId) => memberId !== id),
        chef: currentCrew.chef === id ? '' : currentCrew.chef,
      };
      const nextDriver = await Promise.all(
        crew.chauffeur.map((memberId) => this.drivers.find(memberId)),
      );
      const nextDriverId = nextDriver.find((member) => member?.userId)?.id ?? null;
      await this.bookingsRepository.update(
        {
          ...booking,
          driverId: booking.driverId === id ? nextDriverId : booking.driverId,
          crew,
        },
        booking.version,
      );
    }
    if (employee.userId) {
      const disabled = await this.drivers.update({ ...employee, active: false });
      return { removed: false, employee: disabled };
    }
    if (!this.drivers.delete)
      throw new AppError(501, 'La suppression des employés n’est pas disponible.');
    await this.drivers.delete(id);
    return { removed: true, employee };
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
    const bookings = await this.bookingsRepository.list(undefined, undefined, false);
    return bookings
      .filter(
        (booking) =>
          booking.status !== 'cancelled' &&
          (booking.driverId === profile.id ||
            Object.values(booking.crew ?? {})
              .flat()
              .includes(profile.id)),
      )
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }
  async addProofs(actor: User, bookingId: string, kind: 'retrait' | 'depot', photos: string[]) {
    const profile = await this.requireProfile(actor);
    if ((profile.role ?? 'chauffeur') !== 'chauffeur')
      throw new AppError(
        403,
        'Les photos de retrait et de dépôt sont réservées aux chauffeurs affectés.',
      );
    const booking = (await this.bookings(actor)).find((item) => item.id === bookingId);
    if (!booking) throw new AppError(404, 'Mission introuvable.');
    const createdAt = new Date().toISOString();
    return this.bookingsRepository.update(
      {
        ...booking,
        employeeProofs: [
          ...photos.map((image) => ({
            id: this.ids.next(),
            employeeId: profile.id,
            kind,
            image,
            createdAt,
            note: '',
          })),
          ...(booking.employeeProofs ?? []),
        ],
      },
      booking.version,
    );
  }
  async updateEmployeeProof(
    actor: User,
    bookingId: string,
    proofId: string,
    patch: { kind?: 'retrait' | 'depot'; image?: string; note?: string },
  ) {
    requireAdministrator(actor);
    const booking = await this.bookingsRepository.find(bookingId);
    if (!booking) throw new AppError(404, 'Mission introuvable.');
    const proofs = booking.employeeProofs ?? [];
    if (!proofs.some((proof) => proof.id === proofId))
      throw new AppError(404, 'Preuve de mission introuvable.');
    return this.bookingsRepository.update(
      {
        ...booking,
        employeeProofs: proofs.map((proof) =>
          proof.id === proofId ? { ...proof, ...patch } : proof,
        ),
      },
      booking.version,
    );
  }
  async deleteEmployeeProof(actor: User, bookingId: string, proofId: string) {
    requireAdministrator(actor);
    const booking = await this.bookingsRepository.find(bookingId);
    if (!booking) throw new AppError(404, 'Mission introuvable.');
    const proofs = booking.employeeProofs ?? [];
    if (!proofs.some((proof) => proof.id === proofId))
      throw new AppError(404, 'Preuve de mission introuvable.');
    return this.bookingsRepository.update(
      { ...booking, employeeProofs: proofs.filter((proof) => proof.id !== proofId) },
      booking.version,
    );
  }
  private async requireProfile(actor: User) {
    requireActiveUser(actor);
    if (actor.role !== 'driver') throw new AppError(403, messages.actionReserveeAuxChauffeurs);
    const profile = await this.drivers.findByUserId(actor.id);
    if (!profile) throw new AppError(404, messages.profilChauffeurIntrouvable);
    if (!profile.active) throw new AppError(403, 'Ce compte employé est désactivé.');
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
