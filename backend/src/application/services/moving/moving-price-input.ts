import { AppError, requireValue } from '../../../domain/shared/errors.js';
import { messages } from '../../../domain/shared/messages/fr.js';
import { calculatePrice } from '../../../domain/pricing/pricing.js';
import type { Options, WorkAccess } from '../../../domain/shared/model.js';
import type { CatalogueRepository, Clock, RouteRepository } from '../../ports/index.js';

export async function movingPriceInput(
  catalogueRepository: CatalogueRepository,
  routes: RouteRepository,
  clock: Clock,
  vehicleId: string,
  routeId: string,
  options: Options,
  workAccess?: WorkAccess,
  trips = 1,
  distanceKmOverride?: number | null,
  workDate?: string | null,
) {
  const [catalogue, route] = await Promise.all([catalogueRepository.get(), routes.find(routeId)]);
  if (!route || +new Date(route.expiresAt) <= +clock.now())
    throw new AppError(400, messages.recalculezLeTrajetSonEstimationAExpire);
  const vehicle = catalogue.vehicles.find((item) => item.id === vehicleId);
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
    vehiclePrices: Object.fromEntries(
      catalogue.vehicles.map((item) => [item.id, [...item.prices] as [number, number, number]]),
    ),
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
      undefined,
      'fcfa',
      '',
      workDate,
    ),
  };
}
