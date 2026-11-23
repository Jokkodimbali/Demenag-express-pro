import { messages } from '../../../domain/shared/messages/fr.js';
import { requireValue } from '../../../domain/shared/errors.js';
import type { Booking, Quote, QuotePricingInput, Settings } from '../../../domain/shared/model.js';
import { calculatePrice, labourUnitPrice } from '../../../domain/pricing/pricing.js';
import { applyTaxiToManoeuvrePrice } from '../../../../../shared/quote-taxi-allocation.js';
import { normalizePendingQuotePrice } from '../../../../../shared/quote-price-status.js';
import {
  taxiFareForDistance,
  taxiPaidLegCount,
} from '../../../../../shared/taxi-distance-tariffs.js';

export function repriceProvisionalQuote(
  booking: Booking,
  quote: Quote,
  settings: Settings,
  distanceKm: number,
  taxiSettings: Settings = settings,
  taxiCompanyApproachDistanceKm?: number | null,
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
  const storedTaxiFeeAmount =
    pricingInput.taxiFeeAmount ??
    pricingInput.extraLines
      .filter((line) => line.label.startsWith('Frais taxi'))
      .reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);
  const taxiApplied = pricingInput.taxiFeeApplied ?? storedTaxiFeeAmount > 0;
  const companyApproachDistanceKm =
    taxiCompanyApproachDistanceKm ?? pricingInput.taxiCompanyApproachDistanceKm ?? null;
  let taxiFeeAmount = storedTaxiFeeAmount;
  if (pricingInput.taxiFeeApplied != null) {
    if (!taxiApplied || pricingInput.billingMode === 'driver-rental') {
      taxiFeeAmount = 0;
    } else {
      const tariffs = taxiSettings.taxiDistanceTariffs ?? [];
      const fareForDistance = (distance: number) => {
        if (tariffs.length) {
          const fare = taxiFareForDistance(distance, tariffs);
          requireValue(fare != null, 'Aucun tarif taxi ne couvre la distance du devis.');
          return fare;
        }
        return Math.round(distance * Math.max(0, taxiSettings.taxiFeePerKm ?? 0));
      };
      const perLegOverride =
        pricingInput.taxiPerLegAmountOverride ?? pricingInput.taxiRoundTripAmountOverride ?? null;
      const approachOverride = pricingInput.taxiCompanyApproachAmountOverride ?? null;
      const perLegAmount =
        perLegOverride ?? fareForDistance(pricingInput.distanceKmOverride ?? distanceKm);
      const approachAmount =
        approachOverride ??
        (companyApproachDistanceKm == null ? 0 : fareForDistance(companyApproachDistanceKm));
      requireValue(
        approachOverride != null || companyApproachDistanceKm != null,
        'La distance entreprise → client est nécessaire pour recalculer les frais taxi.',
      );
      taxiFeeAmount = perLegAmount * taxiPaidLegCount(pricingInput.trips) + approachAmount;
    }
  }
  const extraLines = pricingInput.extraLines.filter(
    (line) =>
      !line.label.startsWith('Frais taxi') &&
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
  const basePrice = calculatePrice(
    booking.vehicle,
    effectiveSettings,
    pricingInput.distanceKmOverride ?? distanceKm,
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
  const price = normalizePendingQuotePrice(applyTaxiToManoeuvrePrice(basePrice, taxiFeeAmount));
  return {
    price,
    pricingInput: {
      ...pricingInput,
      extraLines,
      taxiFeeAmount,
      taxiCompanyApproachDistanceKm: companyApproachDistanceKm,
      rentalOvertimeHourlyRate,
    },
  };
}
