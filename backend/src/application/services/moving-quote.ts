import { AppError, requireValue } from '../../domain/errors.js';
import { messages } from '../../domain/messages/fr.js';
import type { Booking, QuoteInput, User } from '../../domain/model.js';
import { requireAdministrator } from '../../domain/policies/access.js';
import { calculatePrice } from '../../domain/pricing.js';
import { captureAccountingCosts } from '../../domain/accounting-costs.js';
import {
  inventoryAssemblyLines,
  subtractInventoryAssemblyOptions,
} from '../../domain/inventory-assembly.js';
import type {
  AccountingRepository,
  BookingRepository,
  CatalogueRepository,
  Clock,
  IdGenerator,
} from '../ports/index.js';

export async function createQuote(
  dependencies: {
    bookings: BookingRepository;
    catalogue: CatalogueRepository;
    accounting?: AccountingRepository;
    ids: IdGenerator;
    clock: Clock;
    getBooking: (user: User, id: string) => Promise<Booking>;
  },
  user: User,
  id: string,
  input: QuoteInput,
) {
  const {
    bookings,
    catalogue: catalogueRepository,
    accounting,
    ids,
    clock,
    getBooking,
  } = dependencies;
  requireAdministrator(user);
  const booking = await getBooking(user, id);
  if (booking.version !== input.version)
    throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
  requireValue(
    !booking.quotes.some((quote) => quote.kind === 'final'),
    'Un devis final existe déjà pour cette réservation.',
  );
  requireValue(booking.status !== 'cancelled', messages.cetteReservationEstCloturee);
  const sourceInventory = booking.inventorySnapshot?.sourceInventory;
  if (input.kind === 'final') {
    requireValue(
      Boolean(booking.date),
      'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
    );
    requireValue(
      sourceInventory?.stairs !== 'balcon' || Number(sourceInventory.balcPx) > 0,
      'Passage par le balcon : fixez le supplément avant le devis final.',
    );
  }
  const catalogue = await catalogueRepository.get();
  const vehicle =
    catalogue.vehicles.find((item) => item.id === booking.vehicle.id) ?? booking.vehicle;
  const requestedOptions = input.options ?? booking.options;
  const billingMode = input.billingMode ?? 'complete';
  const options = subtractInventoryAssemblyOptions(requestedOptions, sourceInventory);
  const menuIncluded = input.menuIncluded ?? false;
  const inventoryLines =
    billingMode === 'complete' || (billingMode === 'driver-rental' && menuIncluded)
      ? inventoryAssemblyLines(sourceInventory, catalogue.settings)
      : [];
  const pricingOptions =
    billingMode === 'driver-rental'
      ? { ...options, labour: 0, ...(menuIncluded ? {} : { desk: 0, wardrobe: 0, bed: 0 }) }
      : billingMode === 'standard'
        ? { ...options, desk: 0, wardrobe: 0, bed: 0 }
        : options;
  const quoteSettings =
    input.kind === 'final'
      ? { ...catalogue.settings, maxTrips: Math.max(catalogue.settings.maxTrips, input.trips) }
      : catalogue.settings;
  const tollPoints = await catalogueRepository.listTollPoints();
  const tolls = (input.tolls ?? []).map((line) => {
    const point = tollPoints.find((item) => item.id === line.tollPointId);
    requireValue(point, 'Un péage sélectionné n’existe plus dans le catalogue.');
    requireValue(
      line.direction !== 'round-trip' || line.quantity % 2 === 0,
      'Un aller-retour doit compter deux passages par trajet.',
    );
    const prefix = /^péage\b/i.test(point.name) ? point.name : `Péage ${point.name}`;
    const unitPrice = point.vehiclePrices[vehicle.id] ?? point.heavyPrice;
    requireValue(Number.isSafeInteger(unitPrice) && unitPrice > 0, 'Tarif de péage invalide.');
    return {
      tollPointId: point.id,
      label: `${prefix} · ${line.direction === 'round-trip' ? 'Aller-retour' : 'Aller simple'}`,
      quantity: line.quantity,
      unitPrice,
    };
  });
  // Les prix du transport sont ceux du véhicule au moment de la réservation.
  const overtimeMinutes =
    billingMode === 'driver-rental' ? Math.max(0, Math.round(input.overtimeMinutes ?? 0)) : 0;
  const overtimeCharge = Math.round(
    (overtimeMinutes * (catalogue.settings.rentalOvertimeHourlyRate ?? 10000)) / 60,
  );
  const rentalOvertimeHourlyRate = catalogue.settings.rentalOvertimeHourlyRate ?? 10000;
  const additionalLines = [
    ...inventoryLines,
    ...input.extraLines,
    ...(sourceInventory?.stairs === 'balcon'
      ? [
          {
            label: `Supplément passage par le balcon${Number(sourceInventory.balcPx) > 0 ? '' : ' (à fixer)'}`,
            quantity: 1,
            unitPrice: Math.max(0, Math.round(Number(sourceInventory.balcPx) || 0)),
          },
        ]
      : []),
    ...(overtimeCharge > 0
      ? [
          {
            label: `Dépassement du planning prévisionnel (${overtimeMinutes} min, ${rentalOvertimeHourlyRate} FCFA par heure)`,
            quantity: 1,
            unitPrice: overtimeCharge,
          },
        ]
      : []),
  ];
  const price = calculatePrice(
    vehicle,
    quoteSettings,
    booking.distanceKm,
    pricingOptions,
    input.trips,
    input.customPrice,
    input.discount,
    additionalLines,
    booking.workAccess,
    input.labourUnitPriceOverride,
    input.discountType,
    input.discountReason,
    booking.date,
  );
  requireValue(
    input.kind !== 'final' || price.total !== null,
    messages.renseignezLeTarifDuTransportAvantDeFinaliser,
  );
  requireValue(
    input.kind !== 'final' || price.tier !== 3 || Number(input.customPrice) > 0,
    `Distance au-delà de ${catalogue.settings.distanceBounds[2]} km : fixez le prix par aller-retour avant le devis final.`,
  );
  const quoteId = ids.next();
  const accountingConfiguration =
    input.kind === 'final' ? ((await accounting?.configuration()) ?? null) : null;
  const quote = {
    id: quoteId,
    reference: `DV-${clock.now().getUTCFullYear()}-${quoteId.slice(0, 8).toUpperCase()}`,
    kind: input.kind,
    createdAt: clock.now().toISOString(),
    price,
    notes: input.notes,
    options: pricingOptions,
    tolls,
    billingMode,
    menuIncluded,
    rentalKit: input.rentalKit ?? [],
    overtimeMinutes,
    providedCrew: Math.max(0, Math.round(input.providedCrew ?? options.labour)),
    pricingInput: {
      settings: {
        distanceBounds: quoteSettings.distanceBounds,
        maxTrips: quoteSettings.maxTrips,
        maxOptions: quoteSettings.maxOptions,
        labourPrice: quoteSettings.labourPrice,
        labourFloorPrice: quoteSettings.labourFloorPrice,
        labourLiftPrice: quoteSettings.labourLiftPrice,
        assemblyPrice: quoteSettings.assemblyPrice,
        montageP: quoteSettings.montageP,
        movingLaborPlanning: quoteSettings.movingLaborPlanning,
      },
      trips: input.trips,
      customPrice: input.customPrice,
      discount: input.discount,
      discountType: input.discountType ?? 'fcfa',
      discountReason: input.discountReason ?? '',
      options: pricingOptions,
      labourUnitPriceOverride: input.labourUnitPriceOverride ?? null,
      extraLines: additionalLines,
      billingMode,
      menuIncluded,
      overtimeMinutes,
      rentalOvertimeHourlyRate,
    },
    ...(input.kind === 'final'
      ? { accountingCosts: captureAccountingCosts(booking, price, accountingConfiguration) }
      : {}),
  };
  return bookings.update(
    {
      ...booking,
      quotes: [...booking.quotes, quote],
      status: input.kind === 'final' ? 'completed' : booking.status,
    },
    input.version,
  );
}
