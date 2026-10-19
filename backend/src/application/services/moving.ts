import { transition, validateDate } from '../../domain/booking.js';
import { AppError, requireValue } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type {
  BookingInput,
  BookingStatus,
  Options,
  Point,
  QuoteInput,
  User,
} from '../../domain/model.js';
import {
  canReadBooking,
  requireActiveUser,
  requireAdministrator,
} from '../../domain/policies/access.js';
import { calculatePrice } from '../../domain/pricing.js';
import type {
  BookingRepository,
  CatalogueRepository,
  Clock,
  DriverRepository,
  IdGenerator,
  NotificationPublisher,
  RouteRepository,
  RoutingProvider,
  VehicleReportRepository,
} from '../ports/index.js';
import type { MovingUseCases } from '../ports/use-cases.js';
export class MovingService implements MovingUseCases {
  constructor(
    private bookings: BookingRepository,
    private catalogue: CatalogueRepository,
    private routes: RouteRepository,
    private routing: RoutingProvider,
    private drivers: DriverRepository,
    private clock: Clock,
    private ids: IdGenerator,
    private vehicleReports?: VehicleReportRepository,
    private notifications?: NotificationPublisher,
  ) {}
  async route(from: Point, to: Point) {
    const route = await this.routing.route(from, to);
    const ticket = {
      ...route,
      id: this.ids.next(),
      expiresAt: new Date(+this.clock.now() + 30 * 60000).toISOString(),
    };
    await this.routes.save(ticket);
    return ticket;
  }
  search(query: string) {
    return this.routing.search(query);
  }
  private async priceInput(vehicleId: string, routeId: string, options: Options) {
    const [catalogue, route] = await Promise.all([this.catalogue.get(), this.routes.find(routeId)]);
    if (!route || +new Date(route.expiresAt) <= +this.clock.now())
      throw new AppError(400, messages.recalculezLeTrajetSonEstimationAExpire);
    const vehicle = catalogue.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || vehicle.active === false) throw new AppError(400, messages.vehiculeInconnu);
    return {
      route,
      settings: catalogue.settings,
      vehicle,
      estimate: calculatePrice(vehicle, catalogue.settings, route.distanceKm, options),
    };
  }
  async estimate(vehicleId: string, routeId: string, options: Options) {
    return (await this.priceInput(vehicleId, routeId, options)).estimate;
  }
  async create(user: User, input: BookingInput) {
    requireActiveUser(user);
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
    );
    if (user.role !== 'admin')
      requireValue(
        settings.bookingsEnabled !== false,
        messages.lesReservationsSontTemporairementFermees,
      );
    if (input.date) validateDate(input.date, input.timeSlot, this.clock.now(), settings);
    const id = this.ids.next();
    return this.bookings.create(
      {
        id,
        reference: `DEM-${this.clock.now().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        userId: user.id,
        customerName: input.customerName,
        phone: input.customerPhone,
        vehicle,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        from: route.from,
        to: route.to,
        distanceKm: route.distanceKm,
        date: input.date,
        timeSlot: input.timeSlot,
        options: input.options,
        notes: input.notes,
        pricingSettings: settings,
        estimate,
        quotes: [],
        status: 'pending',
        createdAt: this.clock.now().toISOString(),
        version: 1,
      },
      input.requestId,
    );
  }
  list(user: User) {
    requireActiveUser(user);
    return this.bookings.list(user.role === 'admin' ? undefined : user.id);
  }
  async get(user: User, id: string) {
    const booking = await this.bookings.find(id);
    if (!booking || !canReadBooking(user, booking.userId))
      throw new AppError(404, messages.reservationIntrouvable);
    return booking;
  }
  async status(user: User, id: string, next: BookingStatus, version: number) {
    requireActiveUser(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (user.role === 'driver') {
      const driver = await this.drivers.findByUserId(user.id);
      if (!driver || booking.vehicle.id !== driver.vehicleId)
        throw new AppError(404, messages.reservationIntrouvable);
      if (next === 'in_progress') {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(this.clock.now());
        const inspection = await this.vehicleReports?.findInspection(driver.id, date);
        requireValue(inspection, 'Effectuez le contrôle du véhicule avant de démarrer une mission.');
        requireValue(inspection.condition !== 'unsafe', 'Le véhicule a été déclaré dangereux. Contactez l’administration avant de démarrer une mission.');
      }
    } else if (!canReadBooking(user, booking.userId))
      throw new AppError(404, messages.reservationIntrouvable);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    transition(booking.status, next, user.role);
    const { settings } = await this.catalogue.get();
    if (user.role !== 'admin' && next === 'cancelled') {
      requireValue(booking.date, messages.dateInvalide);
      requireValue(settings.clientCancellation, messages.contactezLAdministrationPourAnnuler);
      const configuredSlot = settings.enabledSlots.find((slot) => slot.label === booking.timeSlot);
      requireValue(configuredSlot, messages.creneauInvalide);
      const start = +new Date(booking.date + 'T00:00:00Z') + configuredSlot.startHour * 3600000;
      requireValue(
        start - +this.clock.now() >= settings.cancellationNoticeHours * 3600000,
        messages.leDelaiDAnnulationEstDepasseContactezL,
      );
    }
    if (next === 'confirmed') {
      requireValue(booking.date, 'Ajoutez une date de rendez-vous avant de confirmer la réservation.');
      validateDate(booking.date, booking.timeSlot, this.clock.now(), {
        ...settings,
        maxAdvanceDays: 730,
      });
    }
    return this.bookings.update({ ...booking, status: next }, version);
  }
  async schedule(user: User, id: string, date: string | null, timeSlot: string, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version) throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(booking.status === 'pending', 'Le rendez-vous peut être modifié jusqu’à la confirmation finale de la réservation.');
    const { settings } = await this.catalogue.get();
    if (date) validateDate(date, timeSlot, this.clock.now(), { ...settings, maxAdvanceDays: 730 });
    return this.bookings.update({ ...booking, date, timeSlot: date ? timeSlot : '' }, version);
  }
  async updateNotes(user: User, id: string, notes: string, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version) throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(!['completed', 'cancelled'].includes(booking.status), messages.cetteReservationEstCloturee);
    return this.bookings.update({ ...booking, notes: notes.trim() }, version);
  }
  async assignDriver(user: User, id: string, driverId: string | null, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    if (driverId) {
      const driver = await this.drivers.find(driverId);
      if (!driver || !driver.active) throw new AppError(400, messages.chauffeurIntrouvable);
    }
    const updated = await this.bookings.update({ ...booking, driverId }, version);
    if (driverId) {
      const driver = await this.drivers.find(driverId);
      if (driver?.userId) this.notifications?.publish({ id: this.ids.next(), title: 'Mission attribuée', message: `Une réservation ${updated.reference} vous a été attribuée.`, createdAt: this.clock.now().toISOString(), bookingId: updated.id }, { userIds: [driver.userId] });
    }
    return updated;
  }
  async quote(user: User, id: string, input: QuoteInput) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== input.version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      messages.cetteReservationEstCloturee,
    );
    if (input.kind === 'final')
      requireValue(
        booking.status === 'in_progress',
        messages.demarrezLeDemenagementAvantDeFinaliserSonDevis,
      );
    const { settings } = await this.catalogue.get();
    const options = input.options ?? booking.options;
    // Les prix du transport sont ceux du véhicule au moment de la réservation.
    const price = calculatePrice(
      booking.vehicle,
      booking.pricingSettings ?? settings,
      booking.distanceKm,
      options,
      input.trips,
      input.customPrice,
      input.discount,
      input.extraLines,
    );
    requireValue(
      input.kind !== 'final' || price.total !== null,
      messages.renseignezLeTarifDuTransportAvantDeFinaliser,
    );
    const quoteId = this.ids.next();
    const quote = {
      id: quoteId,
      reference: `DV-${this.clock.now().getUTCFullYear()}-${quoteId.slice(0, 8).toUpperCase()}`,
      kind: input.kind,
      createdAt: this.clock.now().toISOString(),
      price,
      notes: input.notes,
      options,
    };
    return this.bookings.update(
      {
        ...booking,
        quotes: [...booking.quotes, quote],
        status: input.kind === 'final' ? 'completed' : booking.status,
      },
      input.version,
    );
  }
  async delete(user: User, id: string) {
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (!this.bookings.delete) throw new AppError(501, 'La suppression des réservations est indisponible.');
    await this.bookings.delete(id);
  }
}
