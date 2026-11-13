import type {
  Booking,
  BookingInput,
  BookingPricingSnapshot,
} from '../../../domain/shared/model.js';
import type { Clock, CatalogueRepository, RouteRepository } from '../../ports/index.js';
import { calculatePrice } from '../../../domain/pricing/pricing.js';
import { validateDate } from '../../../domain/moving/booking.js';
import { addressChangeForUpdate } from './moving-address-change.js';
import { normalizePhone } from '../identity/auth.js';
import { movingPriceInput } from './moving-price-input.js';

export async function buildAdminRequestUpdate(
  dependencies: {
    catalogue: CatalogueRepository;
    routes: RouteRepository;
    clock: Clock;
    capturePricingSnapshot: (
      vehiclePrices: Record<string, [number, number, number]>,
    ) => Promise<BookingPricingSnapshot>;
  },
  booking: Booking,
  input: BookingInput,
): Promise<Booking> {
  const { catalogue, routes, clock, capturePricingSnapshot } = dependencies;
  const {
    route,
    vehicle: currentVehicle,
    settings,
    vehiclePrices,
  } = await movingPriceInput(
    catalogue,
    routes,
    clock,
    input.vehicleId,
    input.routeId,
    input.options,
    input.workAccess,
    input.trips ?? 1,
    input.distanceKmOverride,
    input.date,
  );
  const pricingSettings = booking.pricingSettings ?? settings;
  const pricingSnapshot = booking.pricingSnapshot ?? (await capturePricingSnapshot(vehiclePrices));
  const vehicle = {
    ...currentVehicle,
    prices: pricingSnapshot.vehiclePrices[input.vehicleId] ?? currentVehicle.prices,
  };
  const estimate = calculatePrice(
    vehicle,
    pricingSettings,
    route.distanceKm,
    input.options,
    input.trips ?? 1,
    null,
    0,
    [],
    input.workAccess ?? booking.workAccess,
    undefined,
    'fcfa',
    '',
    input.date,
  );
  if (input.date && input.date !== booking.date)
    validateDate(input.date, clock.now(), { ...settings, maxAdvanceDays: 730 }, input.timeSlot);
  const crewAddressChange = addressChangeForUpdate(
    booking,
    input.fromAddress,
    input.toAddress,
    route.from,
    route.to,
    clock.now().toISOString(),
  );
  const scheduleChanged =
    booking.date !== (input.date || null) ||
    booking.timeSlot !== (input.date ? input.timeSlot : '');
  return {
    ...booking,
    status: 'pending',
    ...(scheduleChanged
      ? {
          driverId: null,
          crew: { chauffeur: [], menuisier: [], manoeuvre: [], chef: '' },
          crewBriefs: {},
          crewRefusedBy: [],
          crewReplies: {},
          crewMessages: {},
        }
      : {}),
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
    pricingSettings,
    pricingSnapshot,
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
    crewAddressChange: scheduleChanged ? undefined : crewAddressChange,
  } satisfies Booking;
}
