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
  reverse(point: Point) {
    return this.routing.reverse(point);
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
    if (input.date) validateDate(input.date, this.clock.now(), settings);
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
        throw new AppError(400, 'Prenez une photo du chargement pour démarrer une course.');
      }
      if (next === 'completed') {
        throw new AppError(403, 'Seule l’administration peut clôturer la réservation.');
      }
    } else if (!canReadBooking(user, booking.userId))
      throw new AppError(404, messages.reservationIntrouvable);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    const hasFinalQuote = booking.quotes.some((quote) => quote.kind === 'final');
    if (hasFinalQuote && next !== 'completed')
      throw new AppError(409, 'Le devis final est créé. Cette réservation est verrouillée.');
    if (next === 'completed') {
      requireAdministrator(user);
      requireValue(hasFinalQuote, 'Créez le devis final avant de clôturer la réservation.');
      requireValue(
        booking.driverFinishedAt,
        'Attendez que le chauffeur signale la fin de ses courses.',
      );
      requireValue(
        (booking.trips?.length ?? 0) > 0 &&
          booking.trips?.every((trip) => trip.finishedAt && trip.unloadingPhotos?.length),
        'Toutes les courses doivent être terminées et justifiées par leurs photos.',
      );
    }
    transition(booking.status, next, user.role);
    const { settings } = await this.catalogue.get();
    if (user.role !== 'admin' && next === 'cancelled') {
      requireValue(booking.date, messages.dateInvalide);
      requireValue(settings.clientCancellation, messages.contactezLAdministrationPourAnnuler);
    }
    if (next === 'confirmed') {
      requireValue(
        booking.date,
        'Ajoutez une date de rendez-vous avant de confirmer la réservation.',
      );
      validateDate(booking.date, this.clock.now(), {
        ...settings,
        maxAdvanceDays: 730,
      });
    }
    const updated = await this.bookings.update({ ...booking, status: next }, version);
    if (user.role === 'admin' && next === 'confirmed' && booking.driverId) {
      const driver = await this.drivers.find(booking.driverId);
      if (driver?.userId)
        await this.notifications?.publish(
          {
            id: this.ids.next(),
            title: 'Nouvelle mission confirmée',
            message: `${updated.reference} est confirmée pour le ${updated.date} (${updated.timeSlot}). Consultez les détails dans votre espace chauffeur.`,
            createdAt: this.clock.now().toISOString(),
            bookingId: updated.id,
          },
          { userIds: [driver.userId] },
        );
    }
    if (user.role === 'admin' && next === 'completed' && booking.driverId) {
      const driver = await this.drivers.find(booking.driverId);
      if (driver?.userId)
        await this.notifications?.publish(
          {
            id: this.ids.next(),
            title: 'Réservation clôturée par l’administration',
            message: `${updated.reference} : l’administration a vérifié les courses et clôturé la réservation.`,
            createdAt: this.clock.now().toISOString(),
            bookingId: updated.id,
          },
          { userIds: [driver.userId] },
        );
    }
    return updated;
  }
  async startTrip(user: User, id: string, photos: string[]) {
    requireActiveUser(user);
    requireValue(user.role === 'driver', 'Cette action est réservée au chauffeur.');
    requireValue(photos.length > 0 && photos.length <= 5, 'Ajoutez de 1 à 5 photos du chargement.');
    const booking = await this.bookings.find(id);
    const driver = await this.drivers.findByUserId(user.id);
    if (!booking || !driver || booking.vehicle.id !== driver.vehicleId)
      throw new AppError(404, messages.reservationIntrouvable);
    requireValue(
      !booking.driverFinishedAt,
      'Vous avez déjà signalé la fin de vos courses à l’administration.',
    );
    requireValue(
      !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le devis final est créé.',
    );
    requireValue(
      ['confirmed', 'in_progress'].includes(booking.status),
      'Cette réservation ne peut pas démarrer une course.',
    );
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.clock.now());
    const inspection = await this.vehicleReports?.findInspection(driver.id, date);
    requireValue(inspection, 'Effectuez le contrôle du véhicule avant de démarrer une course.');
    requireValue(
      Array.isArray(inspection.photos) &&
        inspection.photos.length >= 6 &&
        inspection.photos.length <= 10,
      'Le contrôle du jour doit inclure une photo de preuve pour chaque vérification.',
    );
    requireValue(
      inspection.condition !== 'unsafe',
      'Le véhicule a été déclaré dangereux. Contactez l’administration avant de démarrer une mission.',
    );
    if (booking.status === 'confirmed') {
      await this.bookings.update({ ...booking, status: 'in_progress' }, booking.version);
    }
    await this.bookings.startTrip(id, photos);
    const updated = await this.bookings.find(id);
    if (!updated) throw new AppError(404, messages.reservationIntrouvable);
    return updated;
  }
  async finishTrip(user: User, id: string, photos: string[]) {
    requireActiveUser(user);
    requireValue(user.role === 'driver', 'Cette action est réservée au chauffeur.');
    requireValue(
      photos.length > 0 && photos.length <= 5,
      'Ajoutez de 1 à 5 photos du déchargement.',
    );
    const booking = await this.bookings.find(id);
    const driver = await this.drivers.findByUserId(user.id);
    if (!booking || !driver || booking.vehicle.id !== driver.vehicleId)
      throw new AppError(404, messages.reservationIntrouvable);
    requireValue(
      !booking.driverFinishedAt,
      'Vous avez déjà signalé la fin de vos courses à l’administration.',
    );
    requireValue(
      booking.status === 'in_progress',
      'La mission doit être en cours pour terminer une course.',
    );
    await this.bookings.finishTrip(id, photos);
    const updated = await this.bookings.find(id);
    if (!updated) throw new AppError(404, messages.reservationIntrouvable);
    return updated;
  }
  async finishDriverWork(user: User, id: string) {
    requireActiveUser(user);
    requireValue(user.role === 'driver', 'Cette action est réservée au chauffeur.');
    const booking = await this.bookings.find(id);
    const driver = await this.drivers.findByUserId(user.id);
    if (!booking || !driver || booking.vehicle.id !== driver.vehicleId)
      throw new AppError(404, messages.reservationIntrouvable);
    requireValue(booking.status === 'in_progress', 'La mission doit être en cours.');
    requireValue(!booking.driverFinishedAt, 'La fin des courses a déjà été signalée.');
    requireValue(
      (booking.trips?.length ?? 0) > 0 &&
        booking.trips?.every((trip) => trip.finishedAt && trip.unloadingPhotos?.length),
      'Terminez chaque course avec ses photos de déchargement avant de signaler la fin.',
    );
    const updated = await this.bookings.update(
      { ...booking, driverFinishedAt: this.clock.now().toISOString() },
      booking.version,
    );
    await this.notifications?.publish(
      {
        id: this.ids.next(),
        title: 'Courses terminées par le chauffeur',
        message: `${updated.reference} : le chauffeur signale ${updated.trips?.length ?? 0} aller(s)-retour(s) terminé(s), avec preuves de chargement et de déchargement. Vérifiez les preuves, créez le devis final puis clôturez la réservation.`,
        createdAt: this.clock.now().toISOString(),
        bookingId: updated.id,
      },
      { roles: ['admin'] },
    );
    return updated;
  }
  async schedule(user: User, id: string, date: string | null, timeSlot: string, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !['completed', 'cancelled'].includes(booking.status) &&
        !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le rendez-vous ne peut plus être modifié après la clôture ou la création du devis final.',
    );
    const { settings } = await this.catalogue.get();
    if (date) validateDate(date, this.clock.now(), { ...settings, maxAdvanceDays: 730 });
    return this.bookings.update({ ...booking, date, timeSlot: date ? timeSlot : '' }, version);
  }
  async updateNotes(user: User, id: string, notes: string, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le devis final est créé. Cette réservation est verrouillée.',
    );
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      messages.cetteReservationEstCloturee,
    );
    return this.bookings.update({ ...booking, notes: notes.trim() }, version);
  }
  async updateRoute(user: User, id: string, from: Point, to: Point, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      booking.quotes.length === 0,
      'Le trajet est verrouillé après la création d’un devis. Les montants des devis existants doivent rester inchangés.',
    );
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      messages.cetteReservationEstCloturee,
    );
    if (!booking.pricingSettings) throw new AppError(409, messages.tarifsHistoriquesIndisponibles);
    const [route, fromAddress, toAddress] = await Promise.all([
      this.routing.route(from, to),
      this.routing.reverse(from),
      this.routing.reverse(to),
    ]);
    const estimate = calculatePrice(
      booking.vehicle,
      booking.pricingSettings,
      route.distanceKm,
      booking.options,
    );
    return this.bookings.update(
      {
        ...booking,
        from,
        to,
        fromAddress,
        toAddress,
        distanceKm: route.distanceKm,
        estimate,
      },
      version,
    );
  }
  async assignDriver(user: User, id: string, driverId: string | null, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le devis final est créé. Cette réservation est verrouillée.',
    );
    if (driverId) {
      const driver = await this.drivers.find(driverId);
      if (!driver || !driver.active) throw new AppError(400, messages.chauffeurIntrouvable);
    }
    const updated = await this.bookings.update({ ...booking, driverId }, version);
    if (driverId && booking.driverId !== driverId) {
      const driver = await this.drivers.find(driverId);
      if (driver?.userId)
        await this.notifications?.publish(
          {
            id: this.ids.next(),
            title: 'Mission attribuée',
            message: `Une réservation ${updated.reference} vous a été attribuée.`,
            createdAt: this.clock.now().toISOString(),
            bookingId: updated.id,
          },
          { userIds: [driver.userId] },
        );
    }
    return updated;
  }
  async quote(user: User, id: string, input: QuoteInput) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== input.version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !booking.quotes.some((quote) => quote.kind === 'final'),
      'Un devis final existe déjà pour cette réservation.',
    );
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      messages.cetteReservationEstCloturee,
    );
    if (input.kind === 'final') {
      requireValue(
        booking.status === 'in_progress',
        messages.demarrezLeDemenagementAvantDeFinaliserSonDevis,
      );
      requireValue(
        booking.driverFinishedAt,
        'Attendez que le chauffeur signale la fin de ses courses.',
      );
      const completedTrips =
        booking.trips?.filter((trip) => trip.finishedAt && trip.unloadingPhotos?.length).length ??
        0;
      requireValue(
        completedTrips > 0 && completedTrips === booking.trips?.length,
        'Toutes les courses doivent être terminées et justifiées par leurs photos.',
      );
      requireValue(
        input.trips === completedTrips,
        `Le devis final doit compter ${completedTrips} aller(s)-retour(s), selon les courses enregistrées.`,
      );
    }
    if (!booking.pricingSettings) throw new AppError(409, messages.tarifsHistoriquesIndisponibles);
    const options = input.options ?? booking.options;
    const pricingSettings = booking.pricingSettings;
    const quoteSettings =
      input.kind === 'final'
        ? { ...pricingSettings, maxTrips: Math.max(pricingSettings.maxTrips, input.trips) }
        : pricingSettings;
    // Les prix du transport sont ceux du véhicule au moment de la réservation.
    const price = calculatePrice(
      booking.vehicle,
      quoteSettings,
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
        status: booking.status,
      },
      input.version,
    );
  }
  async delete(user: User, id: string) {
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (booking.quotes.some((quote) => quote.kind === 'final'))
      throw new AppError(
        409,
        'Cette réservation possède un devis final et une écriture comptable : suppression impossible.',
      );
    if (!this.bookings.delete)
      throw new AppError(501, 'La suppression des réservations est indisponible.');
    await this.bookings.delete(id);
  }
}
