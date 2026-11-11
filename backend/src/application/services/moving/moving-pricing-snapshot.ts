import { requireAdministrator } from '../../../domain/security/access-policy.js';
import { calculatePrice } from '../../../domain/pricing/pricing.js';
import { AppError, requireValue } from '../../../domain/shared/errors.js';
import { messages } from '../../../domain/shared/messages/fr.js';
import type { Booking, User } from '../../../domain/shared/model.js';
import type {
  AccountingRepository,
  BookingRepository,
  CatalogueRepository,
  Clock,
} from '../../ports/index.js';

type PricingSnapshotDependencies = {
  bookings: BookingRepository;
  catalogue: CatalogueRepository;
  accounting?: AccountingRepository;
  clock: Clock;
  getBooking: (actor: User, bookingId: string) => Promise<Booking>;
};
type PricingSnapshotCaptureDependencies = Pick<
  PricingSnapshotDependencies,
  'catalogue' | 'accounting' | 'clock'
>;

export async function applyCurrentPricingSnapshot(
  dependencies: PricingSnapshotDependencies,
  user: User,
  id: string,
  version: number,
) {
  requireAdministrator(user);
  const booking = await dependencies.getBooking(user, id);
  if (booking.version !== version)
    throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
  requireValue(
    !['completed', 'cancelled'].includes(booking.status) &&
      !booking.quotes.some((quote) => quote.kind === 'final'),
    messages.cetteReservationEstCloturee,
  );

  const catalogue = await dependencies.catalogue.get();
  const pricingSnapshot = await capturePricingSnapshot(dependencies, {
    vehiclePrices: Object.fromEntries(
      catalogue.vehicles.map((item) => [item.id, [...item.prices] as [number, number, number]]),
    ),
  });
  const vehicle = catalogue.vehicles.find((item) => item.id === booking.vehicle.id);
  if (!vehicle) throw new AppError(400, messages.vehiculeInconnu);
  const estimate = calculatePrice(
    vehicle,
    catalogue.settings,
    booking.distanceKm,
    booking.options,
    booking.estimate.trips,
    null,
    0,
    [],
    booking.workAccess,
    undefined,
    'fcfa',
    '',
    booking.date,
  );
  return dependencies.bookings.update(
    { ...booking, vehicle, pricingSettings: catalogue.settings, pricingSnapshot, estimate },
    version,
  );
}

export async function capturePricingSnapshot(
  { catalogue, accounting, clock }: PricingSnapshotCaptureDependencies,
  { vehiclePrices }: { vehiclePrices: Record<string, [number, number, number]> },
) {
  const [points, accountingConfiguration] = await Promise.all([
    catalogue.listTollPoints(),
    accounting?.configuration() ?? Promise.resolve(null),
  ]);
  return {
    capturedAt: clock.now().toISOString(),
    vehiclePrices,
    tollPoints: points.map((point) => ({ ...point, vehiclePrices: { ...point.vehiclePrices } })),
    accounting: accountingConfiguration
      ? {
          moverCostPerMove: accountingConfiguration.moverCostPerMove,
          menuPrices: accountingConfiguration.menuPrices,
        }
      : null,
  };
}
