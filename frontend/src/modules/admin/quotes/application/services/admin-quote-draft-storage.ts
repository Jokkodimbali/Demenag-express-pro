import type { Draft } from '../../../../booking/application/booking-draft';
import type { Quote, RentalKitItem } from '../../../../shared/domain/model';

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
  manoeuvreOvertimeEnabled: boolean | null;
  manoeuvreOvertimeHours: number | null;
  manoeuvreOvertimeCrewCount: number | null;
  manoeuvreOvertimePersonIds: string[] | null;
  manoeuvreOvertimeAdditionalPeople: number | null;
  manoeuvreOvertimeHourlyRateOverride: number | null;
  taxiFeeApplied: boolean;
  taxiFeeAmountOverride: number | null;
  taxiCompanyApproachAmountOverride: number | null;
  taxiCompanyApproachAmountBasis: 'once' | 'per-manoeuvre';
  rentalKit: RentalKitItem[] | null;
  customLines: { id: string; label: string; quantity: number; unitPrice: number }[];
};

export type AdminQuoteDraft = {
  draft: Draft;
  quoteConfig: AdminQuoteConfig;
  tollLines: { id: string; label: string; quantity: number; unitPrice: number }[];
  quoteKind?: Quote['kind'];
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
      quoteKind: parsed.quoteKind === 'final' ? 'final' : 'provisional',
      quoteConfig: {
        ...parsed.quoteConfig,
        calcMode: parsed.quoteConfig.calcMode === 'manual' ? 'manual' : 'auto',
        legMinutes: Math.max(0, Number(parsed.quoteConfig.legMinutes) || 0),
        trafficOff: parsed.quoteConfig.trafficOff === true,
        heatOff: parsed.quoteConfig.heatOff === true,
        heatRest: Math.max(0, Number(parsed.quoteConfig.heatRest) || 0),
        labourUnitPriceOverride: parsed.quoteConfig.labourUnitPriceOverride ?? null,
        discountType: parsed.quoteConfig.discountType ?? 'fcfa',
        discount: Math.min(
          parsed.quoteConfig.discountType === 'pct' ? 100 : 10_000_000,
          Math.max(0, parsed.quoteConfig.discount),
        ),
        discountReason: parsed.quoteConfig.discountReason ?? '',
        billingMode: ['complete', 'standard', 'driver-rental'].includes(
          parsed.quoteConfig.billingMode,
        )
          ? parsed.quoteConfig.billingMode
          : 'complete',
        menuIncluded: parsed.quoteConfig.menuIncluded === true,
        overtimeMinutes: Math.max(0, Number(parsed.quoteConfig.overtimeMinutes) || 0),
        manoeuvreOvertimeEnabled:
          typeof parsed.quoteConfig.manoeuvreOvertimeEnabled === 'boolean'
            ? parsed.quoteConfig.manoeuvreOvertimeEnabled
            : null,
        manoeuvreOvertimeHours:
          Number.isFinite(parsed.quoteConfig.manoeuvreOvertimeHours) &&
          Number(parsed.quoteConfig.manoeuvreOvertimeHours) >= 0
            ? Number(parsed.quoteConfig.manoeuvreOvertimeHours)
            : null,
        manoeuvreOvertimeCrewCount:
          Number.isInteger(parsed.quoteConfig.manoeuvreOvertimeCrewCount) &&
          Number(parsed.quoteConfig.manoeuvreOvertimeCrewCount) >= 1 &&
          Number(parsed.quoteConfig.manoeuvreOvertimeCrewCount) <= 100
            ? Number(parsed.quoteConfig.manoeuvreOvertimeCrewCount)
            : null,
        manoeuvreOvertimePersonIds: Array.isArray(parsed.quoteConfig.manoeuvreOvertimePersonIds)
          ? parsed.quoteConfig.manoeuvreOvertimePersonIds.filter(
              (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
            )
          : null,
        manoeuvreOvertimeAdditionalPeople:
          Number.isInteger(parsed.quoteConfig.manoeuvreOvertimeAdditionalPeople) &&
          Number(parsed.quoteConfig.manoeuvreOvertimeAdditionalPeople) >= 0 &&
          Number(parsed.quoteConfig.manoeuvreOvertimeAdditionalPeople) <= 100
            ? Number(parsed.quoteConfig.manoeuvreOvertimeAdditionalPeople)
            : null,
        manoeuvreOvertimeHourlyRateOverride:
          Number.isSafeInteger(parsed.quoteConfig.manoeuvreOvertimeHourlyRateOverride) &&
          Number(parsed.quoteConfig.manoeuvreOvertimeHourlyRateOverride) >= 0
            ? Number(parsed.quoteConfig.manoeuvreOvertimeHourlyRateOverride)
            : null,
        taxiFeeApplied: parsed.quoteConfig.taxiFeeApplied === true,
        taxiFeeAmountOverride:
          Number.isSafeInteger(parsed.quoteConfig.taxiFeeAmountOverride) &&
          Number(parsed.quoteConfig.taxiFeeAmountOverride) >= 0
            ? Number(parsed.quoteConfig.taxiFeeAmountOverride)
            : null,
        taxiCompanyApproachAmountOverride:
          Number.isSafeInteger(parsed.quoteConfig.taxiCompanyApproachAmountOverride) &&
          Number(parsed.quoteConfig.taxiCompanyApproachAmountOverride) >= 0
            ? parsed.quoteConfig.taxiCompanyApproachAmountBasis === 'per-manoeuvre'
              ? Number(parsed.quoteConfig.taxiCompanyApproachAmountOverride) *
                Math.max(1, parsed.draft.options.labour)
              : Number(parsed.quoteConfig.taxiCompanyApproachAmountOverride)
            : null,
        taxiCompanyApproachAmountBasis: 'once',
        rentalKit:
          parsed.quoteConfig.rentalKit === null || Array.isArray(parsed.quoteConfig.rentalKit)
            ? parsed.quoteConfig.rentalKit
            : null,
        customLines: Array.isArray(parsed.quoteConfig.customLines)
          ? parsed.quoteConfig.customLines
              .filter(
                (line) =>
                  line &&
                  typeof line.label === 'string' &&
                  Number.isInteger(line.quantity) &&
                  line.quantity > 0 &&
                  Number.isSafeInteger(line.unitPrice) &&
                  line.unitPrice >= 0,
              )
              .map((line) => ({
                id: typeof line.id === 'string' ? line.id : crypto.randomUUID(),
                label: line.label.slice(0, 100),
                quantity: Math.min(10000, line.quantity),
                unitPrice: Math.min(10000000, line.unitPrice),
              }))
          : [],
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

export function clearAdminQuoteDraft(api: AdminQuoteDraftApi): Promise<boolean> {
  return enqueuePersistence(api, () => api.clearAdminQuoteDraft()).then(
    () => true,
    () => false,
  );
}

function isAdminQuoteDraft(value: unknown): value is AdminQuoteDraft {
  if (typeof value !== 'object' || value === null) return false;
  const saved = value as Partial<AdminQuoteDraft>;
  const draft = saved.draft;
  const config = saved.quoteConfig;
  return (
    typeof draft === 'object' &&
    draft !== null &&
    (saved.quoteKind === undefined || ['provisional', 'final'].includes(saved.quoteKind)) &&
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
    (config.manoeuvreOvertimeEnabled === undefined ||
      config.manoeuvreOvertimeEnabled === null ||
      typeof config.manoeuvreOvertimeEnabled === 'boolean') &&
    (config.manoeuvreOvertimeHours === undefined ||
      config.manoeuvreOvertimeHours === null ||
      (Number.isFinite(config.manoeuvreOvertimeHours) &&
        config.manoeuvreOvertimeHours >= 0 &&
        config.manoeuvreOvertimeHours <= 24)) &&
    (config.manoeuvreOvertimeCrewCount === undefined ||
      config.manoeuvreOvertimeCrewCount === null ||
      (Number.isInteger(config.manoeuvreOvertimeCrewCount) &&
        config.manoeuvreOvertimeCrewCount >= 1 &&
        config.manoeuvreOvertimeCrewCount <= 100)) &&
    (config.manoeuvreOvertimePersonIds === undefined ||
      config.manoeuvreOvertimePersonIds === null ||
      (Array.isArray(config.manoeuvreOvertimePersonIds) &&
        config.manoeuvreOvertimePersonIds.length <= 100 &&
        config.manoeuvreOvertimePersonIds.every(
          (id) => typeof id === 'string' && id.length > 0 && id.length <= 100,
        ))) &&
    (config.manoeuvreOvertimeAdditionalPeople === undefined ||
      config.manoeuvreOvertimeAdditionalPeople === null ||
      (Number.isInteger(config.manoeuvreOvertimeAdditionalPeople) &&
        config.manoeuvreOvertimeAdditionalPeople >= 0 &&
        config.manoeuvreOvertimeAdditionalPeople <= 100)) &&
    (config.manoeuvreOvertimeHourlyRateOverride === undefined ||
      config.manoeuvreOvertimeHourlyRateOverride === null ||
      (Number.isSafeInteger(config.manoeuvreOvertimeHourlyRateOverride) &&
        config.manoeuvreOvertimeHourlyRateOverride >= 0)) &&
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
    (config.customLines === undefined ||
      (Array.isArray(config.customLines) &&
        config.customLines.length <= 20 &&
        config.customLines.every(
          (line) =>
            typeof line.id === 'string' &&
            typeof line.label === 'string' &&
            line.label.length <= 100 &&
            Number.isInteger(line.quantity) &&
            line.quantity > 0 &&
            Number.isSafeInteger(line.unitPrice) &&
            line.unitPrice >= 0,
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
