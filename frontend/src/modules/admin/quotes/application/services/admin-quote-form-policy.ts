import type { Booking, ClientQuestion, Settings } from '../../../../shared/domain/model';
import type { Draft } from '../../../../booking/application/booking-draft';
import type { TollExtraLine } from '../../../../moving/domain/tolls/toll-selection';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';
import { labourUnitPriceOverrideFromQuote } from '../../../../moving/domain/pricing/labour-price';
import { removeTaxiFromManoeuvrePrice } from '../../../../../../../shared/quote-taxi-allocation.js';

export function inventoryItemCount(inventory: Inventory) {
  return (
    Object.values(inventory.entries).reduce((sum, entry) => sum + entry.quantity, 0) +
    inventory.variants.reduce((sum, entry) => sum + entry.quantity, 0) +
    inventory.custom.reduce((sum, entry) => sum + entry.quantity, 0)
  );
}

export function quoteQuestionnaireSummary(
  questions: readonly ClientQuestion[],
  answers: Record<string, string>,
) {
  const configured = questions
    .filter((question) => {
      const answer = answers[question.id]?.trim();
      return question.active && answer && !['Question posée', 'À poser'].includes(answer);
    })
    .map((question) => `${question.label} : ${answers[question.id].trim()}`);
  const keyQuestions: Array<[string, string]> = [
    ['key-ready', 'Le matériel sera-t-il prêt à être chargé ?'],
    ['key-stairs', 'Tout le matériel passe-t-il dans les escaliers ?'],
  ];
  const keyAnswers = keyQuestions
    .filter(([id]) => answers[id]?.trim())
    .map(([id, label]) => `${label} : ${answers[id].trim()}`);
  return [...configured, ...keyAnswers].join('\n');
}

export function quoteEstimateInventory(
  inventory: Inventory,
  answers: Record<string, string>,
): Inventory {
  const readyAnswer = answers['key-ready'];
  const stairsAnswer = answers['key-stairs'];
  return {
    ...inventory,
    ready: readyAnswer?.startsWith('Non')
      ? 'non'
      : readyAnswer?.startsWith('Oui')
        ? 'oui'
        : (inventory.ready ?? ''),
    stairs: stairsAnswer?.startsWith('Non, par le balcon')
      ? 'balcon'
      : stairsAnswer?.startsWith('Non')
        ? 'non'
        : stairsAnswer?.startsWith('Oui')
          ? 'oui'
          : stairsAnswer?.startsWith('À vérifier')
            ? 'verif'
            : (inventory.stairs ?? ''),
  };
}

export function canCreateFinalQuote(booking: Booking | null, date: string, noDate: boolean) {
  return Boolean(booking?.status !== 'cancelled' && date && !noDate);
}

export function quoteSettingsForEditing(
  bookingSettings: Settings | undefined,
  currentSettings: Settings | undefined,
): Settings | undefined {
  if (!bookingSettings) return currentSettings;
  if (!currentSettings) return bookingSettings;
  return {
    ...bookingSettings,
    taxiFeeEnabled: currentSettings.taxiFeeEnabled ?? bookingSettings.taxiFeeEnabled ?? false,
    taxiFeePerKm: currentSettings.taxiFeePerKm ?? bookingSettings.taxiFeePerKm ?? 0,
    businessLatitude: currentSettings.businessLatitude ?? bookingSettings.businessLatitude ?? null,
    businessLongitude:
      currentSettings.businessLongitude ?? bookingSettings.businessLongitude ?? null,
  };
}

export function quoteConfigWithManualTaxiFee(config: AdminQuoteConfig, value: string) {
  if (value === '') return config;
  return {
    ...config,
    taxiFeeApplied: true,
    taxiFeeAmountOverride: Math.min(10_000_000, Math.max(0, Math.round(Number(value) || 0))),
  };
}

export function quoteConfigurationFromBooking(booking: Booking) {
  const quote = booking.quotes.at(-1);
  const pricingInput = quote?.pricingInput;
  const taxiTrips = Math.max(1, quote?.price.trips ?? booking.estimate.trips);
  // Historic totals used one taxi fare for each base rotation plus a final return.
  const legacyTaxiRotationCount = taxiTrips + 1;
  const savedTaxiFeeAmount =
    quote?.pricingInput?.taxiFeeAmount ??
    quote?.price.lines.find((line) => line.label === 'Frais taxi · montant modifié')?.total ??
    null;
  const savedPerManoeuvreApproachLine = quote?.pricingInput?.extraLines?.find(
    (line) => line.label === 'Frais taxi · approche entreprise par manœuvre',
  );
  const hasSavedApproachOverride =
    pricingInput != null && 'taxiCompanyApproachAmountOverride' in pricingInput;
  const savedTaxiCompanyApproachOverride = hasSavedApproachOverride
    ? (pricingInput.taxiCompanyApproachAmountOverride ?? null)
    : savedPerManoeuvreApproachLine
      ? Math.round(savedPerManoeuvreApproachLine.quantity * savedPerManoeuvreApproachLine.unitPrice)
      : pricingInput?.extraLines?.find((line) => line.label === 'Frais taxi · approche entreprise')
          ?.unitPrice;
  const savedRoundTripLine = quote?.pricingInput?.extraLines?.find(
    (line) =>
      line.label === 'Frais taxi · montant modifié' || line.label === 'Frais taxi · déménagement',
  );
  const hasSavedPerLegOverride = pricingInput != null && 'taxiPerLegAmountOverride' in pricingInput;
  const hasSavedRoundTripOverride =
    pricingInput != null && 'taxiRoundTripAmountOverride' in pricingInput;
  const savedTaxiPerLegOverride =
    pricingInput?.taxiPerLegAmountOverride != null
      ? pricingInput.taxiPerLegAmountOverride
      : pricingInput?.taxiRoundTripAmountOverride != null
        ? pricingInput.taxiRoundTripAmountOverride
        : hasSavedPerLegOverride || hasSavedRoundTripOverride
          ? null
          : savedRoundTripLine
            ? savedRoundTripLine.unitPrice
            : savedTaxiFeeAmount != null
              ? Math.round(
                  Math.max(0, savedTaxiFeeAmount - (savedTaxiCompanyApproachOverride ?? 0)) /
                    legacyTaxiRotationCount,
                )
              : null;
  const priceWithoutTaxi =
    quote?.price && savedTaxiFeeAmount
      ? removeTaxiFromManoeuvrePrice(quote.price, savedTaxiFeeAmount)
      : quote?.price;
  const sourcePrice = quote?.price ?? booking.estimate;
  const customPrice =
    sourcePrice.tier === 3
      ? (sourcePrice.lines.find((line) => line.label.startsWith('Transport'))?.unitPrice ?? null)
      : null;
  const config: AdminQuoteConfig = {
    trips: quote?.price.trips ?? booking.estimate.trips,
    calcMode: 'auto',
    legMinutes: 0,
    trafficOff: false,
    heatOff: false,
    heatRest: 0,
    discount: quote?.price.discountValue ?? quote?.price.discount ?? booking.estimate.discount,
    discountType: quote?.price.discountType ?? 'fcfa',
    discountReason: quote?.price.discountReason ?? '',
    customPrice,
    labourUnitPriceOverride: labourUnitPriceOverrideFromQuote(
      priceWithoutTaxi,
      booking.pricingSettings,
      booking.workAccess,
    ),
    billingMode: quote?.billingMode ?? 'complete',
    menuIncluded: quote?.menuIncluded ?? false,
    overtimeMinutes: quote?.overtimeMinutes ?? 0,
    taxiFeeApplied:
      Boolean(savedTaxiFeeAmount) ||
      (quote?.price.lines.some((line) => line.label.startsWith('Frais taxi')) ?? false),
    taxiFeeAmountOverride: savedTaxiPerLegOverride ?? null,
    taxiCompanyApproachAmountOverride: savedTaxiCompanyApproachOverride ?? null,
    taxiCompanyApproachAmountBasis: 'once',
    rentalKit: quote?.rentalKit ?? null,
    customLines: (quote?.pricingInput?.customLines ?? []).map((line, index) => ({
      id: `saved-custom-${index + 1}`,
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
  };
  const tollLines = (quote?.tolls ?? []).map((line) => ({
    id: line.tollPointId,
    label: line.label,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));
  return { config, tollLines };
}

export function totalTollCost(lines: readonly TollExtraLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function toggleQuoteToll(
  current: readonly TollExtraLine[],
  line: TollExtraLine,
  checked: boolean,
) {
  return checked
    ? [...current.filter((existing) => existing.id !== line.id), line]
    : current.filter((existing) => existing.id !== line.id);
}

export function changedQuoteLaborDraft(
  draft: Draft,
  delta: number,
  maxOptions: number,
  hasVolume: boolean,
): Draft {
  const labour = Math.max(0, Math.min(maxOptions, draft.options.labour + delta));
  const constrainedLabour = hasVolume ? Math.max(1, labour) : labour;
  return {
    ...draft,
    options: { ...draft.options, labour: constrainedLabour },
    inventory: { ...draft.inventory, crew: constrainedLabour },
  };
}

export function quoteDateLabel(date: string, month: string) {
  if (date) return date.split('-').reverse().join('/');
  if (month)
    return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Dakar',
    });
  return '—';
}

export function businessPhonePresentation(value: string) {
  const digits = value.replace(/\D/g, '');
  const display = /^221\d{9}$/u.test(digits)
    ? `+221 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
    : value;
  return { digits, display };
}
