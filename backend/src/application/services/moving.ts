import { transition, validateDate } from '../../domain/booking.js';
import { AppError, requireValue } from '../../domain/errors.js';
import type {
  BookingInput,
  BookingStatus,
  Options,
  Point,
  QuoteInput,
  User,
} from '../../domain/model.js';
import { calculatePrice } from '../../domain/pricing.js';
import type {
  BookingRepository,
  CatalogueRepository,
  Clock,
  IdGenerator,
  RouteRepository,
  RoutingProvider,
} from '../ports/index.js';
export class MovingService {
  constructor(
    private bookings: BookingRepository,
    private catalogue: CatalogueRepository,
    private routes: RouteRepository,
    private routing: RoutingProvider,
    private clock: Clock,
    private ids: IdGenerator,
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
      throw new AppError(400, 'Recalculez le trajet : son estimation a expiré.');
    const vehicle = catalogue.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || vehicle.active === false) throw new AppError(400, 'Véhicule inconnu.');
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
    const { route, vehicle, estimate, settings } = await this.priceInput(
      input.vehicleId,
      input.routeId,
      input.options,
    );
    requireValue(
      settings.bookingsEnabled !== false,
      'Les réservations sont temporairement fermées.',
    );
    validateDate(input.date, input.timeSlot, this.clock.now(), settings);
    const id = this.ids.next();
    return this.bookings.create(
      {
        id,
        reference: `DEM-${this.clock.now().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        userId: user.id,
        customerName: user.name,
        phone: user.phone,
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
    return this.bookings.list(user.role === 'admin' ? undefined : user.id);
  }
  async get(user: User, id: string) {
    const booking = await this.bookings.find(id);
    if (!booking || (user.role !== 'admin' && booking.userId !== user.id))
      throw new AppError(404, 'Réservation introuvable.');
    return booking;
  }
  async status(user: User, id: string, next: BookingStatus, version: number) {
    const booking = await this.get(user, id);
    if (booking.version !== version)
      throw new AppError(409, 'Cette réservation a changé. Actualisez la page.');
    transition(booking.status, next, user.role === 'admin');
    const { settings } = await this.catalogue.get();
    if (user.role !== 'admin' && next === 'cancelled') {
      requireValue(
        settings.clientCancellation !== false,
        'Contactez l’administration pour annuler.',
      );
      const hour = booking.timeSlot.startsWith('Matin')
        ? 8
        : booking.timeSlot.startsWith('Après')
          ? 13
          : 17;
      const start = +new Date(booking.date + 'T00:00:00Z') + hour * 3600000;
      requireValue(
        start - +this.clock.now() >= (settings.cancellationNoticeHours ?? 0) * 3600000,
        'Le délai d’annulation est dépassé. Contactez l’administration.',
      );
    }
    if (next === 'confirmed')
      validateDate(booking.date, booking.timeSlot, this.clock.now(), { maxAdvanceDays: 730 });
    return this.bookings.update({ ...booking, status: next }, version);
  }
  async quote(user: User, id: string, input: QuoteInput) {
    if (user.role !== 'admin') throw new AppError(403, 'Action réservée à l’administration.');
    const booking = await this.get(user, id);
    if (booking.version !== input.version)
      throw new AppError(409, 'Cette réservation a changé. Actualisez la page.');
    requireValue(
      !['completed', 'cancelled'].includes(booking.status),
      'Cette réservation est clôturée.',
    );
    if (input.kind === 'final')
      requireValue(
        booking.status === 'in_progress',
        'Démarrez le déménagement avant de finaliser son devis.',
      );
    const { settings } = await this.catalogue.get();
    // Les prix du transport sont ceux du véhicule au moment de la réservation.
    const price = calculatePrice(
      booking.vehicle,
      booking.pricingSettings ?? settings,
      booking.distanceKm,
      booking.options,
      input.trips,
      input.customPrice,
      input.discount,
    );
    requireValue(
      input.kind !== 'final' || price.total !== null,
      'Renseignez le tarif du transport avant de finaliser.',
    );
    const quoteId = this.ids.next();
    const quote = {
      id: quoteId,
      reference: `DV-${this.clock.now().getUTCFullYear()}-${quoteId.slice(0, 8).toUpperCase()}`,
      kind: input.kind,
      createdAt: this.clock.now().toISOString(),
      price,
      notes: input.notes,
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
}
