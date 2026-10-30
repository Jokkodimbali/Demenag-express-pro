import type { Draft } from './booking-draft';

export type AdminQuoteConfig = {
  trips: number;
  discount: number;
  discountType: 'fcfa' | 'pct';
  discountReason: string;
  customPrice: number | null;
  labourUnitPriceOverride: number | null;
};

export type AdminQuoteDraft = {
  draft: Draft;
  quoteConfig: AdminQuoteConfig;
  tollLines: { id: string; label: string; quantity: number; unitPrice: number }[];
};

const STORAGE_KEY = 'demenag-admin-quote-draft-v1';

export function readAdminQuoteDraft(): AdminQuoteDraft | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!isAdminQuoteDraft(parsed)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      ...parsed,
      quoteConfig: {
        ...parsed.quoteConfig,
        labourUnitPriceOverride: parsed.quoteConfig.labourUnitPriceOverride ?? null,
        discountType: parsed.quoteConfig.discountType ?? 'fcfa',
        discountReason: parsed.quoteConfig.discountReason ?? '',
      },
      draft: {
        ...parsed.draft,
        distanceKmOverride: parsed.draft.distanceKmOverride ?? null,
        noDate: parsed.draft.noDate ?? false,
        fromNote: parsed.draft.fromNote ?? '',
        toNote: parsed.draft.toNote ?? '',
        source: parsed.draft.source ?? '',
        estimatedTrips:
          Number.isInteger(parsed.draft.estimatedTrips) && parsed.draft.estimatedTrips > 0
            ? parsed.draft.estimatedTrips
            : 1,
        inventory: {
          ...parsed.draft.inventory,
          fromFloor: Number.isInteger(parsed.draft.inventory.fromFloor)
            ? Math.min(20, Math.max(0, parsed.draft.inventory.fromFloor))
            : 0,
          toFloor: Number.isInteger(parsed.draft.inventory.toFloor)
            ? Math.min(20, Math.max(0, parsed.draft.inventory.toFloor))
            : 0,
          dwellingType: parsed.draft.inventory.dwellingType ?? '',
        },
        questionnaireAnswers: parsed.draft.questionnaireAnswers ?? {},
      },
    };
  } catch {
    return null;
  }
}

export function saveAdminQuoteDraft(value: AdminQuoteDraft): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Un stockage indisponible ne doit pas empêcher la création du devis.
  }
}

export function clearAdminQuoteDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Le formulaire reste utilisable si le stockage de session est bloqué.
  }
}

function isAdminQuoteDraft(value: unknown): value is AdminQuoteDraft {
  if (typeof value !== 'object' || value === null) return false;
  const saved = value as Partial<AdminQuoteDraft>;
  const draft = saved.draft;
  const config = saved.quoteConfig;
  return (
    typeof draft === 'object' &&
    draft !== null &&
    typeof draft.vehicleId === 'string' &&
    typeof draft.customerName === 'string' &&
    typeof draft.customerPhone === 'string' &&
    typeof draft.fromAddress === 'string' &&
    typeof draft.toAddress === 'string' &&
    (draft.fromNote === undefined || typeof draft.fromNote === 'string') &&
    (draft.toNote === undefined || typeof draft.toNote === 'string') &&
    typeof draft.date === 'string' &&
    typeof draft.timeSlot === 'string' &&
    typeof draft.notes === 'string' &&
    typeof draft.requestId === 'string' &&
    typeof draft.options === 'object' &&
    draft.options !== null &&
    ['labour', 'desk', 'wardrobe', 'bed'].every((key) =>
      Number.isInteger(draft.options[key as keyof Draft['options']]),
    ) &&
    typeof draft.inventory === 'object' &&
    draft.inventory !== null &&
    (draft.inventory.dwellingType === undefined ||
      typeof draft.inventory.dwellingType === 'string') &&
    (draft.questionnaireAnswers === undefined ||
      (typeof draft.questionnaireAnswers === 'object' &&
        draft.questionnaireAnswers !== null &&
        Object.values(draft.questionnaireAnswers).every((answer) => typeof answer === 'string'))) &&
    typeof config === 'object' &&
    config !== null &&
    Number.isInteger(config.trips) &&
    config.trips >= 1 &&
    Number.isInteger(config.discount) &&
    config.discount >= 0 &&
    (config.discountType === undefined || ['fcfa', 'pct'].includes(config.discountType)) &&
    (config.discountReason === undefined || typeof config.discountReason === 'string') &&
    (config.customPrice === null ||
      (Number.isInteger(config.customPrice) && config.customPrice > 0)) &&
    (config.labourUnitPriceOverride === undefined ||
      config.labourUnitPriceOverride === null ||
      (Number.isInteger(config.labourUnitPriceOverride) && config.labourUnitPriceOverride > 0)) &&
    Array.isArray(saved.tollLines) &&
    saved.tollLines.every(
      (line) =>
        typeof line.id === 'string' &&
        typeof line.label === 'string' &&
        Number.isInteger(line.quantity) &&
        Number.isInteger(line.unitPrice),
    )
  );
}
