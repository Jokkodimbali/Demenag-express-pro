import { isAvailableBookingSlot, transition, validateDate } from '../../domain/booking.js';
import { AppError, requireValue } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type {
  Booking,
  BookingInput,
  BookingStatus,
  Options,
  Point,
  QuoteInput,
  QuotePricingInput,
  User,
  WorkAccess,
  WorkPlanReview,
  WorkPlanCompliance,
} from '../../domain/model.js';
import {
  canReadBooking,
  requireActiveUser,
  requireAdministrator,
} from '../../domain/policies/access.js';
import { calculatePrice, labourUnitPrice } from '../../domain/pricing.js';
import { fallbackWorkPlan } from './fallback-work-plan.js';
import type {
  BookingRepository,
  AccountingRepository,
  CatalogueRepository,
  Clock,
  DriverRepository,
  IdGenerator,
  NotificationPublisher,
  RouteRepository,
  RoutingProvider,
} from '../ports/index.js';
import type { MovingUseCases } from '../ports/use-cases.js';
import { createQuote } from './moving-quote.js';
import { addressChangeForUpdate } from './moving-address-change.js';
import { createRouteTicket } from './moving-routing.js';
import { normalizePhone } from './auth.js';
import {
  deleteBooking,
  listTrashedBookings,
  purgeTrashedBooking,
  restoreTrashedBooking,
} from './moving-trash.js';

export class MovingService implements MovingUseCases {
  constructor(
    private bookings: BookingRepository,
    private catalogue: CatalogueRepository,
    private routes: RouteRepository,
    private routing: RoutingProvider,
    private drivers: DriverRepository,
    private clock: Clock,
    private ids: IdGenerator,
    private notifications?: NotificationPublisher,
    private accounting?: AccountingRepository,
  ) {}
  async route(from: Point, to: Point) {
    return createRouteTicket(this.routing, this.routes, this.clock, this.ids, from, to);
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
    distanceKmOverride?: number | null,
  ) {
    const [catalogue, route] = await Promise.all([this.catalogue.get(), this.routes.find(routeId)]);
    if (!route || +new Date(route.expiresAt) <= +this.clock.now())
      throw new AppError(400, messages.recalculezLeTrajetSonEstimationAExpire);
    const vehicle = catalogue.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || vehicle.active === false) throw new AppError(400, messages.vehiculeInconnu);
    if (distanceKmOverride != null)
      requireValue(
        Number.isFinite(distanceKmOverride) &&
          distanceKmOverride >= 0 &&
          distanceKmOverride <= 100000,
        'La distance personnalisée doit être comprise entre 0 et 100 000 km.',
      );
    const effectiveRoute =
      distanceKmOverride == null ? route : { ...route, distanceKm: distanceKmOverride };
    return {
      route: effectiveRoute,
      settings: catalogue.settings,
      vehicle,
      estimate: calculatePrice(
        vehicle,
        catalogue.settings,
        effectiveRoute.distanceKm,
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
    distanceKmOverride?: number,
  ) {
    return (
      await this.priceInput(vehicleId, routeId, options, workAccess, trips, distanceKmOverride)
    ).estimate;
  }
  async create(user: User, input: BookingInput) {
    requireActiveUser(user);
    requireValue(
      user.role === 'client' || user.role === 'admin',
      'La création d’une réservation est réservée au client et à l’administration.',
    );
    requireValue(
      user.role === 'admin' || input.distanceKmOverride == null,
      'La distance personnalisée est réservée à l’administration.',
    );
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
      input.workAccess,
      input.trips ?? 1,
      user.role === 'admin' ? input.distanceKmOverride : undefined,
    );
    if (user.role !== 'admin')
      requireValue(
        settings.bookingsEnabled !== false,
        messages.lesReservationsSontTemporairementFermees,
      );
    if (user.role === 'client') requireValue(Boolean(input.date), 'Choisissez une date.');
    if (input.date) {
      validateDate(input.date, this.clock.now(), settings, input.timeSlot);
      if (user.role === 'client')
        requireValue(
          isAvailableBookingSlot(input.timeSlot, settings),
          'Ce créneau n’est plus disponible. Choisissez un autre horaire.',
        );
    }
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
        phone: normalizePhone(input.customerPhone),
        source: user.role === 'admin' ? (input.source ?? '') : '',
        vehicle,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        from: route.from,
        to: route.to,
        distanceKm: route.distanceKm,
        date: input.date,
        month: input.date
          ? input.date.slice(0, 7)
          : ((user.role === 'admin' ? input.month : undefined) ??
            this.clock.now().toISOString().slice(0, 7)),
        timeSlot: input.timeSlot,
        options: input.options,
        workAccess: input.workAccess,
        notes: input.notes,
        questionnaireAnswers: user.role === 'admin' ? (input.questionnaireAnswers ?? []) : [],
        inventorySnapshot: input.inventorySnapshot ?? undefined,
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
    requireValue(
      input.distanceKmOverride == null,
      'La distance personnalisée est réservée à l’administration.',
    );
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
    requireValue(Boolean(input.date), 'Choisissez une date.');
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
      input.workAccess,
      input.trips ?? 1,
    );
    if (input.date) validateDate(input.date, this.clock.now(), settings, input.timeSlot);
    if (input.timeSlot !== booking.timeSlot) {
      requireValue(
        isAvailableBookingSlot(input.timeSlot, settings),
        'Ce créneau n’est plus disponible. Choisissez un autre horaire.',
      );
    }
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
        phone: normalizePhone(input.customerPhone),
        source: booking.source ?? '',
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
  async updateAdminRequest(user: User, id: string, input: BookingInput, version: number) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    requireValue(
      !['completed', 'cancelled'].includes(booking.status) &&
        !booking.quotes.some((quote) => quote.kind === 'final'),
      messages.cetteReservationEstCloturee,
    );
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
      input.workAccess,
      input.trips ?? 1,
      input.distanceKmOverride,
    );
    if (input.date && input.date !== booking.date)
      validateDate(
        input.date,
        this.clock.now(),
        { ...settings, maxAdvanceDays: 730 },
        input.timeSlot,
      );
    const crewAddressChange = addressChangeForUpdate(
      booking,
      input.fromAddress,
      input.toAddress,
      route.from,
      route.to,
      this.clock.now().toISOString(),
    );
    return this.bookings.update(
      {
        ...booking,
        customerName: input.customerName,
        phone: normalizePhone(input.customerPhone),
        source: input.source ?? booking.source ?? '',
        vehicle,
        from: route.from,
        to: route.to,
        distanceKm: route.distanceKm,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        date: input.date || null,
        month: input.date
          ? input.date.slice(0, 7)
          : (input.month ?? booking.month ?? booking.createdAt.slice(0, 7)),
        timeSlot: input.date ? input.timeSlot : '',
        options: input.options,
        workAccess: input.workAccess ?? booking.workAccess,
        notes: input.notes,
        pricingSettings: settings,
        questionnaireAnswers: input.questionnaireAnswers ?? booking.questionnaireAnswers,
        workPlan:
          input.workPlan !== undefined
            ? input.workPlan.map((step) => ({
                ...step,
                review: (() => {
                  const previous = booking.workPlan?.find((item) => item.id === step.id);
                  if (
                    previous &&
                    previous.time === step.time &&
                    previous.title === step.title &&
                    previous.detail === step.detail &&
                    previous.minutes === step.minutes
                  )
                    return previous.review;
                  return {
                    status: 'pending' as const,
                    reason: '',
                    checkedAt: null,
                    checkedBy: null,
                  };
                })(),
              }))
            : booking.workPlan,
        inventorySnapshot:
          input.inventorySnapshot === null
            ? undefined
            : (input.inventorySnapshot ?? booking.inventorySnapshot),
        estimate,
        crewAddressChange,
      },
      version,
    );
  }
  async list(user: User) {
    requireActiveUser(user);
    if (user.role === 'admin') return this.bookings.list();
    if (user.role === 'client') return this.bookings.list(user.id, undefined, false);
    const driver = await this.drivers.findByUserId(user.id);
    if (!driver?.active) throw new AppError(404, messages.profilChauffeurIntrouvable);
    const bookings = await this.bookings.list(undefined, undefined, false);
    return bookings.filter((booking) => this.isAssignedToDriver(booking, driver.id));
  }
  async get(user: User, id: string) {
    requireActiveUser(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (user.role === 'driver') {
      if (!(await this.assignedDriver(user, booking)))
        throw new AppError(404, messages.reservationIntrouvable);
    } else if (!canReadBooking(user, booking.userId)) {
      throw new AppError(404, messages.reservationIntrouvable);
    }
    return booking;
  }
  async recordBookingReminder(user: User, id: string) {
    requireActiveUser(user);
    requireAdministrator(user);
    const booking = await this.get(user, id);
    requireValue(
      Boolean(booking.date) && !['completed', 'cancelled'].includes(booking.status),
      'Aucun rappel WhatsApp n’est disponible pour cette réservation.',
    );
    let whatsappPhone = booking.phone.replace(/\D/g, '');
    if (whatsappPhone.startsWith('00')) whatsappPhone = whatsappPhone.slice(2);
    if (whatsappPhone.length <= 9) whatsappPhone = `221${whatsappPhone.replace(/^0+/, '')}`;
    requireValue(
      whatsappPhone.length >= 10,
      'Le numéro du client ne permet pas de préparer un rappel WhatsApp.',
    );
    const now = this.clock.now();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(now);
    const daysBefore = Math.round(
      (+new Date(`${booking.date}T12:00:00Z`) - +new Date(`${today}T12:00:00Z`)) / 86400000,
    );
    requireValue(daysBefore >= 0, 'La date de cette réservation est déjà passée.');
    return this.bookings.update(
      {
        ...booking,
        reminders: [...(booking.reminders ?? []), { at: now.toISOString(), daysBefore }],
      },
      booking.version,
    );
  }
  async status(user: User, id: string, next: BookingStatus, version: number) {
    requireActiveUser(user);
    requireValue(user.role !== 'driver', 'Le chauffeur ne peut pas modifier la réservation.');
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (!canReadBooking(user, booking.userId))
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
      validateDate(
        booking.date,
        this.clock.now(),
        {
          ...settings,
          maxAdvanceDays: 730,
        },
        booking.timeSlot,
      );
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
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
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
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
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
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    requireValue(booking.status === 'in_progress', 'La mission doit être en cours.');
    requireValue(!booking.driverFinishedAt, 'La fin des courses a déjà été signalée.');
    requireValue(
      (booking.trips?.length ?? 0) > 0 && booking.trips?.every((trip) => trip.finishedAt),
      'Terminez chaque course avant de signaler la fin.',
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
  private async assignedDriver(user: User, booking: Booking) {
    const driver = await this.drivers.findByUserId(user.id);
    if (!driver?.active) return null;
    return this.isAssignedToDriver(booking, driver.id) ? driver : null;
  }
  private isAssignedToDriver(booking: Booking, driverId: string) {
    const crew = booking.crew;
    return (
      booking.driverId === driverId ||
      Boolean(crew?.chauffeur.includes(driverId)) ||
      Boolean(crew?.menuisier.includes(driverId)) ||
      Boolean(crew?.manoeuvre.includes(driverId))
    );
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
    if (date) {
      validateDate(date, this.clock.now(), { ...settings, maxAdvanceDays: 730 }, timeSlot);
      if (user.role === 'client')
        requireValue(
          isAvailableBookingSlot(timeSlot, settings),
          'Ce créneau n’est plus disponible. Choisissez un autre horaire.',
        );
    }
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
    status: WorkPlanCompliance,
    reason: string,
    version: number,
    actualTime?: string,
    photo?: string,
    details?: Pick<WorkPlanReview, 'cause' | 'severity' | 'correctiveAction'>,
  ) {
    requireAdministrator(user);
    const booking = await this.bookings.find(id);
    if (!booking) throw new AppError(404, messages.reservationIntrouvable);
    if (booking.version !== version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    const plan = booking.workPlan?.length ? booking.workPlan : fallbackWorkPlan(booking);
    const step = plan.find((entry) => entry.id === stepId);
    if (!step) throw new AppError(404, 'Étape de planning introuvable.');
    const cleanReason = reason.trim();
    const review: WorkPlanReview = {
      status,
      reason: cleanReason,
      actualTime: actualTime ?? step.review.actualTime ?? '',
      photo: photo ?? step.review.photo ?? '',
      cause: details?.cause ?? step.review.cause ?? '',
      severity: details?.severity ?? step.review.severity ?? '',
      correctiveAction: details?.correctiveAction ?? step.review.correctiveAction ?? '',
      checkedAt: this.clock.now().toISOString(),
      checkedBy: user.name,
    };
    return this.bookings.update(
      {
        ...booking,
        workPlan: plan.map((entry) => (entry.id === stepId ? { ...entry, review } : entry)),
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
      !booking.quotes.some((quote) => quote.kind === 'final'),
      'Le trajet est verrouillé après la création du devis final.',
    );
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      messages.cetteReservationEstCloturee,
    );
    const [catalogue, route, fromAddress, toAddress] = await Promise.all([
      this.catalogue.get(),
      this.routing.route(from, to),
      this.routing.reverse(from),
      this.routing.reverse(to),
    ]);
    const vehicle =
      catalogue.vehicles.find((item) => item.id === booking.vehicle.id) ?? booking.vehicle;
    const estimate = calculatePrice(
      vehicle,
      catalogue.settings,
      route.distanceKm,
      booking.options,
      1,
      null,
      0,
      [],
      booking.workAccess,
    );
    const crewAddressChange = addressChangeForUpdate(
      booking,
      fromAddress,
      toAddress,
      from,
      to,
      this.clock.now().toISOString(),
    );
    let quotes = booking.quotes;
    const latestQuote = quotes.at(-1);
    if (latestQuote?.kind === 'provisional') {
      const currentSettings = catalogue.settings;
      const pricingSettings = {
        distanceBounds: currentSettings.distanceBounds,
        maxTrips: currentSettings.maxTrips,
        maxOptions: currentSettings.maxOptions,
        labourPrice: currentSettings.labourPrice,
        labourFloorPrice: currentSettings.labourFloorPrice,
        labourLiftPrice: currentSettings.labourLiftPrice,
        assemblyPrice: currentSettings.assemblyPrice,
        montageP: currentSettings.montageP,
      };
      const legacyPricingInput = () => {
        const transport = latestQuote.price.lines.find((line) => /^Transport\b/u.test(line.label));
        const labour = latestQuote.price.lines.find((line) => /^Man[œo]uvre\b/iu.test(line.label));
        const standardLines = new Set<string>([
          messages.menuisierBureau,
          messages.menuisierArmoire,
          messages.menuisierLit,
        ]);
        const lines = latestQuote.price.lines.filter(
          (line) =>
            !/^Transport\b/u.test(line.label) &&
            !/^Man[œo]uvre\b/iu.test(line.label) &&
            !standardLines.has(line.label),
        );
        return {
          settings: pricingSettings,
          trips: latestQuote.price.trips,
          customPrice: latestQuote.price.tier === 3 ? (transport?.unitPrice ?? null) : null,
          discount: latestQuote.price.discountValue ?? latestQuote.price.discount,
          discountType: latestQuote.price.discountType ?? 'fcfa',
          discountReason: latestQuote.price.discountReason ?? '',
          options: latestQuote.options ?? booking.options,
          labourUnitPriceOverride:
            labour && labour.unitPrice !== labourUnitPrice(pricingSettings, booking.workAccess)
              ? labour.unitPrice
              : null,
          extraLines: lines.map(({ label, quantity, unitPrice }) => ({
            label,
            quantity,
            unitPrice,
          })),
        } as const;
      };
      const pricingInput: QuotePricingInput = latestQuote.pricingInput ?? legacyPricingInput();
      const rentalOvertimeHourlyRate =
        pricingInput.rentalOvertimeHourlyRate ??
        catalogue.settings.rentalOvertimeHourlyRate ??
        10000;
      const extraLines = pricingInput.extraLines.filter(
        (line) => !line.label.startsWith('Dépassement du planning prévisionnel'),
      );
      if (pricingInput.billingMode === 'driver-rental' && (pricingInput.overtimeMinutes ?? 0) > 0) {
        const minutes = pricingInput.overtimeMinutes ?? 0;
        extraLines.push({
          label: `Dépassement du planning prévisionnel (${minutes} min, ${rentalOvertimeHourlyRate} FCFA par heure)`,
          quantity: 1,
          unitPrice: Math.round((minutes * rentalOvertimeHourlyRate) / 60),
        });
      }
      const settings = {
        ...pricingInput.settings,
        maxTrips: Math.max(pricingInput.settings.maxTrips, pricingInput.trips),
      };
      const price = calculatePrice(
        booking.vehicle,
        settings,
        route.distanceKm,
        pricingInput.options,
        pricingInput.trips,
        pricingInput.customPrice,
        pricingInput.discount,
        extraLines,
        booking.workAccess,
        pricingInput.labourUnitPriceOverride,
        pricingInput.discountType,
        pricingInput.discountReason,
      );
      quotes = quotes.map((quote) =>
        quote.id === latestQuote.id
          ? {
              ...quote,
              price,
              pricingInput: { ...pricingInput, extraLines, rentalOvertimeHourlyRate },
            }
          : quote,
      );
    }
    return this.bookings.update(
      {
        ...booking,
        from,
        to,
        fromAddress,
        toAddress,
        distanceKm: route.distanceKm,
        estimate,
        quotes,
        crewAddressChange,
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
  async updateCrew(
    user: User,
    id: string,
    input: {
      crew: NonNullable<Booking['crew']>;
      crewBriefs: NonNullable<Booking['crewBriefs']>;
      crewRefusedBy: NonNullable<Booking['crewRefusedBy']>;
      crewReplies: NonNullable<Booking['crewReplies']>;
      crewMessages: NonNullable<Booking['crewMessages']>;
      version: number;
    },
  ) {
    requireAdministrator(user);
    const booking = await this.get(user, id);
    if (booking.version !== input.version)
      throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
    const roleIds = [...input.crew.chauffeur, ...input.crew.menuisier, ...input.crew.manoeuvre];
    if (new Set(roleIds).size !== roleIds.length)
      throw new AppError(
        400,
        'Un employé ne peut pas occuper plusieurs rôles sur la même mission.',
      );
    if (input.crew.chef && !roleIds.includes(input.crew.chef))
      throw new AppError(400, 'Le chef doit faire partie de l’équipe affectée.');
    const members = await Promise.all(roleIds.map((memberId) => this.drivers.find(memberId)));
    const expected = [
      ...input.crew.chauffeur.map((memberId) => [memberId, 'chauffeur'] as const),
      ...input.crew.menuisier.map((memberId) => [memberId, 'menuisier'] as const),
      ...input.crew.manoeuvre.map((memberId) => [memberId, 'manoeuvre'] as const),
    ];
    for (const [index, [, role]] of expected.entries()) {
      const member = members[index];
      if (!member || !member.active || (member.role ?? 'chauffeur') !== role)
        throw new AppError(
          400,
          'Un membre sélectionné est introuvable, inactif ou dans un autre rôle.',
        );
    }
    const lead = input.crew.chauffeur
      .map((memberId) => members[roleIds.indexOf(memberId)])
      .find((member) => member?.userId);
    return this.bookings.update(
      {
        ...booking,
        driverId: lead?.id ?? null,
        crew: input.crew,
        crewBriefs: input.crewBriefs,
        crewRefusedBy: input.crewRefusedBy,
        crewReplies: input.crewReplies,
        crewMessages: input.crewMessages,
      },
      input.version,
    );
  }
  quote(user: User, id: string, input: QuoteInput) {
    return createQuote(
      {
        bookings: this.bookings,
        catalogue: this.catalogue,
        accounting: this.accounting,
        ids: this.ids,
        clock: this.clock,
        getBooking: (actor, bookingId) => this.get(actor, bookingId),
      },
      user,
      id,
      input,
    );
  }
  async delete(user: User, id: string) {
    return deleteBooking(this.bookings, user, id);
  }
  async trashed(user: User) {
    return listTrashedBookings(this.bookings, user);
  }
  async restore(user: User, id: string) {
    return restoreTrashedBooking(this.bookings, user, id);
  }
  async purge(user: User, id: string) {
    return purgeTrashedBooking(this.bookings, user, id);
  }
}
