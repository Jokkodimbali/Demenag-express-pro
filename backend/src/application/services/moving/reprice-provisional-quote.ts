import { messages } from '../../../domain/shared/messages/fr.js';
import type { Booking, Quote, QuotePricingInput, Settings } from '../../../domain/shared/model.js';
import { calculatePrice, labourUnitPrice } from '../../../domain/pricing/pricing.js';

export function repriceProvisionalQuote(
  booking: Booking,
  quote: Quote,
  settings: Settings,
  distanceKm: number,
) {
  const pricingSettings = {
    distanceBounds: settings.distanceBounds,
    maxTrips: settings.maxTrips,
    maxOptions: settings.maxOptions,
    labourPrice: settings.labourPrice,
    labourFloorPrice: settings.labourFloorPrice,
    labourLiftPrice: settings.labourLiftPrice,
    assemblyPrice: settings.assemblyPrice,
    montageP: settings.montageP,
    movingLaborPlanning: settings.movingLaborPlanning,
  };
  const legacyPricingInput = () => {
    const transport = quote.price.lines.find((line) => /^Transport\b/u.test(line.label));
    const labour = quote.price.lines.find((line) => /^Man[œo]uvre\b/iu.test(line.label));
    const standardLines = new Set<string>([
      messages.menuisierBureau,
      messages.menuisierArmoire,
      messages.menuisierLit,
    ]);
    const lines = quote.price.lines.filter(
      (line) =>
        !/^Transport\b/u.test(line.label) &&
        !/^Man[œo]uvre\b/iu.test(line.label) &&
        !standardLines.has(line.label),
    );
    return {
      settings: pricingSettings,
      trips: quote.price.trips,
      customPrice: quote.price.tier === 3 ? (transport?.unitPrice ?? null) : null,
      discount: quote.price.discountValue ?? quote.price.discount,
      discountType: quote.price.discountType ?? 'fcfa',
      discountReason: quote.price.discountReason ?? '',
      billingMode: quote.billingMode ?? 'complete',
      menuIncluded: quote.menuIncluded ?? false,
      options: quote.options ?? booking.options,
      labourUnitPriceOverride:
        labour && labour.unitPrice !== labourUnitPrice(pricingSettings, booking.workAccess)
          ? labour.unitPrice
          : null,
      extraLines: lines.map(({ label, quantity, unitPrice }) => ({ label, quantity, unitPrice })),
    } as const;
  };
  const pricingInput: QuotePricingInput = quote.pricingInput ?? legacyPricingInput();
  const rentalOvertimeHourlyRate =
    pricingInput.rentalOvertimeHourlyRate ?? settings.rentalOvertimeHourlyRate ?? 10000;
  const extraLines = pricingInput.extraLines.filter(
    (line) =>
      !line.label.startsWith('Dépassement du planning prévisionnel') &&
      (pricingInput.billingMode === 'complete' ||
        pricingInput.menuIncluded ||
        !line.label.startsWith('Menuisier ·')),
  );
  if (pricingInput.billingMode === 'driver-rental' && (pricingInput.overtimeMinutes ?? 0) > 0) {
    const minutes = pricingInput.overtimeMinutes ?? 0;
    extraLines.push({
      label: `Dépassement du planning prévisionnel (${minutes} min, ${rentalOvertimeHourlyRate} FCFA par heure)`,
      quantity: 1,
      unitPrice: Math.round((minutes * rentalOvertimeHourlyRate) / 60),
    });
  }
  const effectiveSettings = {
    ...pricingInput.settings,
    maxTrips: Math.max(pricingInput.settings.maxTrips, pricingInput.trips),
  };
  const pricingOptions =
    pricingInput.billingMode === 'driver-rental'
      ? {
          ...pricingInput.options,
          labour: 0,
          ...(pricingInput.menuIncluded ? {} : { desk: 0, wardrobe: 0, bed: 0 }),
        }
      : pricingInput.billingMode === 'standard'
        ? { ...pricingInput.options, desk: 0, wardrobe: 0, bed: 0 }
        : pricingInput.options;
  const price = calculatePrice(
    booking.vehicle,
    effectiveSettings,
    distanceKm,
    pricingOptions,
    pricingInput.trips,
    pricingInput.customPrice,
    pricingInput.discount,
    extraLines,
    booking.workAccess,
    pricingInput.labourUnitPriceOverride,
    pricingInput.discountType,
    pricingInput.discountReason,
    booking.date,
  );
  return { price, pricingInput: { ...pricingInput, extraLines, rentalOvertimeHourlyRate } };
}
