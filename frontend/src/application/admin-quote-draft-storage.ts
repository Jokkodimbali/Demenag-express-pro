import type { Draft } from './booking-draft';
import type { RentalKitItem } from '../domain/model';

export type AdminQuoteConfig = {
  trips: number;
  calcMode: 'auto' | 'manual';
  legMinutes: number;
  trafficOff: boolean;
  heatOff: boolean;
  heatRest: number;
  discount: number;
  discountType: 'fcfa' | 'pct';
  discountReason: string;
  customPrice: number | null;
  labourUnitPriceOverride: number | null;
  billingMode: 'complete' | 'standard' | 'driver-rental';
  menuIncluded: boolean;
  overtimeMinutes: number;
  rentalKit: RentalKitItem[] | null;
};

export type AdminQuoteDraft = {
  draft: Draft;
  quoteConfig: AdminQuoteConfig;
  tollLines: { id: string; label: string; quantity: number; unitPrice: number }[];
};

type AdminQuoteDraftApi = {
  adminQuoteDraft(): Promise<unknown | null>;
  saveAdminQuoteDraft(draft: unknown): Promise<void>;
  clearAdminQuoteDraft(): Promise<void>;
};
const persistenceQueues = new WeakMap<AdminQuoteDraftApi, Promise<void>>();

function enqueuePersistence(api: AdminQuoteDraftApi, operation: () => Promise<void>) {
  const next = (persistenceQueues.get(api) ?? Promise.resolve()).then(operation, operation);
  persistenceQueues.set(
    api,
    next.catch(() => undefined),
  );
  return next;
}

export async function readAdminQuoteDraft(
  api: AdminQuoteDraftApi,
): Promise<AdminQuoteDraft | null> {
  try {
    const parsed = await api.adminQuoteDraft();
    if (!parsed || !isAdminQuoteDraft(parsed)) return null;
    return {
      ...parsed,
      quoteConfig: {
        ...parsed.quoteConfig,
        calcMode: parsed.quoteConfig.calcMode === 'manual' ? 'manual' : 'auto',
        legMinutes: Math.max(0, Number(parsed.quoteConfig.legMinutes) || 0),
        trafficOff: parsed.quoteConfig.trafficOff === true,
        heatOff: parsed.quoteConfig.heatOff === true,
        heatRest: Math.max(0, Number(parsed.quoteConfig.heatRest) || 0),
        labourUnitPriceOverride: parsed.quoteConfig.labourUnitPriceOverride ?? null,
        discountType: parsed.quoteConfig.discountType ?? 'fcfa',
        discountReason: parsed.quoteConfig.discountReason ?? '',
        billingMode: ['complete', 'standard', 'driver-rental'].includes(
          parsed.quoteConfig.billingMode,
        )
          ? parsed.quoteConfig.billingMode
          : 'complete',
        menuIncluded: parsed.quoteConfig.menuIncluded === true,
        overtimeMinutes: Math.max(0, Number(parsed.quoteConfig.overtimeMinutes) || 0),
        rentalKit:
          parsed.quoteConfig.rentalKit === null || Array.isArray(parsed.quoteConfig.rentalKit)
            ? parsed.quoteConfig.rentalKit
            : null,
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

export function saveAdminQuoteDraft(
  api: AdminQuoteDraftApi,
  value: AdminQuoteDraft,
): Promise<void> {
  return enqueuePersistence(api, () => api.saveAdminQuoteDraft(value)).catch(() => {
    // Le formulaire reste utilisable si le serveur est momentanément indisponible.
  });
}

export function clearAdminQuoteDraft(api: AdminQuoteDraftApi): Promise<void> {
  return enqueuePersistence(api, () => api.clearAdminQuoteDraft()).catch(() => {
    // La création du devis enregistré reste prioritaire sur le nettoyage du brouillon.
  });
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
    (config.calcMode === undefined || ['auto', 'manual'].includes(config.calcMode)) &&
    (config.legMinutes === undefined ||
      (Number.isFinite(config.legMinutes) && config.legMinutes >= 0 && config.legMinutes <= 600)) &&
    (config.trafficOff === undefined || typeof config.trafficOff === 'boolean') &&
    (config.heatOff === undefined || typeof config.heatOff === 'boolean') &&
    (config.heatRest === undefined ||
      (Number.isFinite(config.heatRest) && config.heatRest >= 0 && config.heatRest <= 45)) &&
    Number.isInteger(config.discount) &&
    config.discount >= 0 &&
    (config.discountType === undefined || ['fcfa', 'pct'].includes(config.discountType)) &&
    (config.discountReason === undefined || typeof config.discountReason === 'string') &&
    (config.customPrice === null ||
      (Number.isInteger(config.customPrice) && config.customPrice > 0)) &&
    (config.labourUnitPriceOverride === undefined ||
      config.labourUnitPriceOverride === null ||
      (Number.isInteger(config.labourUnitPriceOverride) && config.labourUnitPriceOverride > 0)) &&
    (config.billingMode === undefined ||
      ['complete', 'standard', 'driver-rental'].includes(config.billingMode)) &&
    (config.menuIncluded === undefined || typeof config.menuIncluded === 'boolean') &&
    (config.overtimeMinutes === undefined ||
      (Number.isInteger(config.overtimeMinutes) && config.overtimeMinutes >= 0)) &&
    (config.rentalKit === undefined ||
      config.rentalKit === null ||
      (Array.isArray(config.rentalKit) &&
        config.rentalKit.every(
          (item) =>
            typeof item.id === 'string' &&
            typeof item.label === 'string' &&
            Number.isInteger(item.quantity) &&
            item.quantity >= 0,
        ))) &&
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
