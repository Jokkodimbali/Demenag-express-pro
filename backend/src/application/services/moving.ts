import { transition, validateDate } from '../../domain/booking.js';
import { AppError, requireValue } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type {
  Booking,
  BookingInput,
  BookingStatus,
  Options,
  Point,
  QuoteInput,
  User,
  WorkAccess,
  WorkPlanReview,
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
  private async priceInput(
    vehicleId: string,
    routeId: string,
    options: Options,
    workAccess?: WorkAccess,
    trips = 1,
  ) {
    const [catalogue, route] = await Promise.all([this.catalogue.get(), this.routes.find(routeId)]);
    if (!route || +new Date(route.expiresAt) <= +this.clock.now())
      throw new AppError(400, messages.recalculezLeTrajetSonEstimationAExpire);
    const vehicle = catalogue.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || vehicle.active === false) throw new AppError(400, messages.vehiculeInconnu);
    return {
      route,
      settings: catalogue.settings,
      vehicle,
      estimate: calculatePrice(
        vehicle,
        catalogue.settings,
        route.distanceKm,
        options,
        trips,
        null,
        0,
        [],
        workAccess,
      ),
    };
  }
  async estimate(
    vehicleId: string,
    routeId: string,
    options: Options,
    workAccess?: WorkAccess,
    trips = 1,
  ) {
    return (await this.priceInput(vehicleId, routeId, options, workAccess, trips)).estimate;
  }
  async create(user: User, input: BookingInput) {
    requireActiveUser(user);
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
      input.workAccess,
      input.trips ?? 1,
    );
    if (user.role !== 'admin')
      requireValue(
        settings.bookingsEnabled !== false,
        messages.lesReservationsSontTemporairementFermees,
      );
    if (input.date) validateDate(input.date, this.clock.now(), settings);
    const id = this.ids.next();
    const provisionalQuote =
      user.role === 'client'
        ? (() => {
            const quoteId = this.ids.next();
            return {
              id: quoteId,
              reference: `DV-${this.clock.now().getUTCFullYear()}-${quoteId.slice(0, 8).toUpperCase()}`,
              kind: 'provisional' as const,
              createdAt: this.clock.now().toISOString(),
              price: estimate,
              notes: input.notes,
              options: input.options,
            };
          })()
        : null;
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
        workAccess: input.workAccess,
        notes: input.notes,
        questionnaireAnswers: user.role === 'admin' ? (input.questionnaireAnswers ?? []) : [],
        inventorySnapshot: input.inventorySnapshot,
        workPlan:
          user.role === 'admin'
            ? (input.workPlan ?? []).map((step) => {
                const emptyReview: WorkPlanReview = {
                  status: 'pending',
                  reason: '',
                  checkedAt: null,
                  checkedBy: null,
                };
                return { ...step, review: emptyReview };
              })
            : [],
        pricingSettings: settings,
        estimate,
        quotes: provisionalQuote ? [provisionalQuote] : [],
        status: 'pending',
        createdAt: this.clock.now().toISOString(),
        version: 1,
      },
      input.requestId,
    );
  }
  async updateClientRequest(user: User, id: string, input: BookingInput, version: number) {
    requireActiveUser(user);
    requireValue(user.role === 'client', 'Action réservée au client de la réservation.');
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      ['pending', 'confirmed', 'cancelled'].includes(booking.status) &&
        !booking.quotes.some((quote) => quote.kind === 'final'),
      'Cette réservation ne peut plus être modifiée.',
    );
    requireValue(
      !booking.driverId || input.vehicleId === booking.vehicle.id,
      'Le véhicule ne peut plus être changé après l’affectation d’un chauffeur.',
    );
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
      input.workAccess,
      input.trips ?? 1,
    );
    if (input.date && input.date !== booking.date)
      validateDate(input.date, this.clock.now(), settings);
    const provisional = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
    const nextQuote = {
      id: provisional?.id ?? this.ids.next(),
      reference:
        provisional?.reference ??
        `DV-${this.clock.now().getUTCFullYear()}-${this.ids.next().slice(0, 8).toUpperCase()}`,
      kind: 'provisional' as const,
      createdAt: provisional?.createdAt ?? this.clock.now().toISOString(),
      price: estimate,
      notes: input.notes,
      options: input.options,
    };
    return this.bookings.update(
      {
        ...booking,
        status: booking.status === 'cancelled' ? 'pending' : booking.status,
        customerName: input.customerName,
        phone: input.customerPhone,
        vehicle,
        from: route.from,
        to: route.to,
        distanceKm: route.distanceKm,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        date: input.date || null,
        timeSlot: input.date ? input.timeSlot : '',
        options: input.options,
        workAccess: input.workAccess ?? booking.workAccess,
        notes: input.notes,
        estimate,
        quotes: [...booking.quotes.filter((quote) => quote.kind !== 'provisional'), nextQuote],
      },
      version,
    );
  }
  list(user: User) {
    requireActiveUser(user);
    return this.bookings.list(user.role === 'admin' ? undefined : user.id);
  }
  async get(user: User, id: string) {
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (user.role === 'driver') {
      const driver = await this.drivers.findByUserId(user.id);
      if (!driver || booking.vehicle.id !== driver.vehicleId)
        throw new AppError(404, messages.reservationIntrouvable);
    } else if (!canReadBooking(user, booking.userId)) {
      throw new AppError(404, messages.reservationIntrouvable);
    }
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
    requireValue(
      next !== 'in_progress',
      'Démarrez une course depuis les actions de la mission pour enregistrer son état.',
    );
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
        (booking.trips?.length ?? 0) > 0 && booking.trips?.every((trip) => trip.finishedAt),
        'Toutes les courses doivent être terminées avant de clôturer la réservation.',
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
    requireValue(['driver', 'admin'].includes(user.role), 'Action réservée à l’administration.');
    if (user.role === 'driver')
      requireValue(photos.length > 0, 'Ajoutez au moins une photo du chargement.');
    const booking = await this.bookings.find(id);
    const driver = user.role === 'driver' ? await this.drivers.findByUserId(user.id) : null;
    if (
      !booking ||
      (user.role === 'driver' && (!driver || booking.vehicle.id !== driver.vehicleId))
    )
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
    const openTrip = booking.trips?.find((trip) => !trip.finishedAt);
    if (openTrip) {
      requireValue(
        !openTrip.loadingPhotos.length,
        'Une course est déjà en cours et ses preuves de chargement sont enregistrées.',
      );
      requireValue(photos.length > 0, 'Ajoutez au moins une photo du chargement.');
      await this.bookings.addTripLoadingPhotos(id, photos);
      const updated = await this.bookings.find(id);
      if (!updated) throw new AppError(404, messages.reservationIntrouvable);
      return updated;
    }
    if (driver) {
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
    }
    if (booking.status === 'confirmed') {
      await this.bookings.update({ ...booking, status: 'in_progress' }, booking.version);
    }
    await this.bookings.startTrip(id, photos);
    const updated = await this.bookings.find(id);
    if (!updated) throw new AppError(404, messages.reservationIntrouvable);
    if (user.role === 'admin')
      await this.notifyAssignedDriver(
        updated,
        'Course démarrée par l’administration',
        `${updated.reference} : la course ${updated.trips?.at(-1)?.sequence ?? 1} est ouverte. Ajoutez les preuves de chargement depuis votre espace chauffeur.`,
      );
    return updated;
  }
  async finishTrip(user: User, id: string, photos: string[]) {
    requireActiveUser(user);
    requireValue(['driver', 'admin'].includes(user.role), 'Action réservée à l’administration.');
    if (user.role === 'driver')
      requireValue(photos.length > 0, 'Ajoutez au moins une photo du déchargement.');
    const booking = await this.bookings.find(id);
    const driver = user.role === 'driver' ? await this.drivers.findByUserId(user.id) : null;
    if (
      !booking ||
      (user.role === 'driver' && (!driver || booking.vehicle.id !== driver.vehicleId))
    )
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
    if (user.role === 'admin')
      await this.notifyAssignedDriver(
        updated,
        'Course terminée par l’administration',
        `${updated.reference} : la course ${updated.trips?.at(-1)?.sequence ?? 1} est terminée. Consultez la suite de la mission dans votre espace chauffeur.`,
      );
    return updated;
  }
  async finishDriverWork(user: User, id: string) {
    requireActiveUser(user);
    requireValue(['driver', 'admin'].includes(user.role), 'Action réservée à l’administration.');
    const booking = await this.bookings.find(id);
    const driver = user.role === 'driver' ? await this.drivers.findByUserId(user.id) : null;
    if (
      !booking ||
      (user.role === 'driver' && (!driver || booking.vehicle.id !== driver.vehicleId))
    )
      throw new AppError(404, messages.reservationIntrouvable);
    requireValue(booking.status === 'in_progress', 'La mission doit être en cours.');
    requireValue(!booking.driverFinishedAt, 'La fin des courses a déjà été signalée.');
    requireValue(
      (booking.trips?.length ?? 0) > 0 && booking.trips?.every((trip) => trip.finishedAt),
      'Terminez chaque course avant de signaler la fin.',
    );
    if (user.role === 'driver')
      requireValue(
        booking.trips?.every((trip) => trip.unloadingPhotos?.length),
        'Le chauffeur doit joindre les preuves de déchargement de chaque course.',
      );
    const updated = await this.bookings.update(
      { ...booking, driverFinishedAt: this.clock.now().toISOString() },
      booking.version,
    );
    await this.notifications?.publish(
      {
        id: this.ids.next(),
        title:
          user.role === 'admin'
            ? 'Courses terminées par l’administration'
            : 'Courses terminées par le chauffeur',
        message: `${updated.reference} : ${user.role === 'admin' ? 'l’administration' : 'le chauffeur'} signale ${updated.trips?.length ?? 0} aller(s)-retour(s) terminé(s). Vérifiez le dossier, créez le devis final puis clôturez la réservation.`,
        createdAt: this.clock.now().toISOString(),
        bookingId: updated.id,
      },
      { roles: ['admin'] },
    );
    if (user.role === 'admin')
      await this.notifyAssignedDriver(
        updated,
        'Fin de mission signalée par l’administration',
        `${updated.reference} : l’administration a signalé la fin des courses.`,
      );
    return updated;
  }
  private async notifyAssignedDriver(booking: Booking, title: string, message: string) {
    if (!booking.driverId) return;
    const driver = await this.drivers.find(booking.driverId);
    if (!driver?.userId) return;
    try {
      await this.notifications?.publish(
        {
          id: this.ids.next(),
          title,
          message,
          createdAt: this.clock.now().toISOString(),
          bookingId: booking.id,
        },
        { userIds: [driver.userId] },
      );
    } catch (error) {
      console.error('Notification chauffeur non envoyée après une action de réservation :', error);
    }
  }
  async schedule(user: User, id: string, date: string | null, timeSlot: string, version: number) {
    requireActiveUser(user);
    const booking = await this.get(user, id);
    requireValue(
      user.role === 'admin' ||
        (user.role === 'client' && ['pending', 'confirmed'].includes(booking.status)),
      'Cette réservation ne peut plus être modifiée.',
    );
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !['completed', 'cancelled'].includes(booking.status) &&
        !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le rendez-vous ne peut plus être modifié après la clôture ou la création du devis final.',
    );
    const { settings } = await this.catalogue.get();
    if (date) validateDate(date, this.clock.now(), { ...settings, maxAdvanceDays: 730 });
    const workPlan = booking.workPlan ?? [];
    const firstTime = workPlan[0]?.time;
    const startMinutes = (value: string) => {
      const [hour, minute] = value.split(':').map(Number);
      return (hour ?? 0) * 60 + (minute ?? 0);
    };
    const timeFor = (minutes: number) => {
      const normalized = ((minutes % 1440) + 1440) % 1440;
      return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
    };
    const delta = date && firstTime ? startMinutes(timeSlot) - startMinutes(firstTime) : 0;
    return this.bookings.update(
      {
        ...booking,
        date,
        timeSlot: date ? timeSlot : '',
        workPlan: delta
          ? workPlan.map((step) => ({
              ...step,
              time: timeFor(startMinutes(step.time) + delta),
            }))
          : workPlan,
      },
      version,
    );
  }
  async updateNotes(user: User, id: string, notes: string, version: number) {
    requireActiveUser(user);
    const booking = await this.get(user, id);
    requireValue(
      user.role === 'admin' ||
        (user.role === 'client' && ['pending', 'confirmed'].includes(booking.status)),
      'Cette réservation ne peut plus être modifiée.',
    );
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
  async reviewWorkPlan(
    user: User,
    id: string,
    stepId: string,
    status: 'respected' | 'not_respected',
    reason: string,
    version: number,
  ) {
    requireActiveUser(user);
    requireValue(
      ['admin', 'driver'].includes(user.role),
      'Action réservée à l’administration et au chauffeur.',
    );
    const booking = await this.bookings.find(id);
    const driver = user.role === 'driver' ? await this.drivers.findByUserId(user.id) : null;
    if (
      !booking ||
      (user.role === 'driver' && (!driver || booking.vehicle.id !== driver.vehicleId))
    )
      throw new AppError(404, messages.reservationIntrouvable);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    const step = booking.workPlan?.find((entry) => entry.id === stepId);
    if (!step) throw new AppError(404, 'Étape de planning introuvable.');
    const cleanReason = reason.trim();
    requireValue(
      status !== 'not_respected' || cleanReason.length >= 3,
      'Justifiez en quelques mots pourquoi cet horaire n’a pas été respecté.',
    );
    const review: WorkPlanReview = {
      status,
      reason: status === 'not_respected' ? cleanReason : '',
      checkedAt: this.clock.now().toISOString(),
      checkedBy: user.name,
    };
    return this.bookings.update(
      {
        ...booking,
        workPlan: booking.workPlan?.map((entry) =>
          entry.id === stepId ? { ...entry, review } : entry,
        ),
      },
      version,
    );
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
      1,
      null,
      0,
      [],
      booking.workAccess,
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
      const completedTrips = booking.trips?.filter((trip) => trip.finishedAt).length ?? 0;
      requireValue(
        completedTrips > 0 && completedTrips === booking.trips?.length,
        'Toutes les courses doivent être terminées avant de créer le devis final.',
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
      booking.workAccess,
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
