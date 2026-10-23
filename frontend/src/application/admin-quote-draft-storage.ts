import type { Draft } from './booking-draft';

export type AdminQuoteConfig = {
  trips: number;
  discount: number;
  customPrice: number | null;
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
    return parsed;
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
    typeof config === 'object' &&
    config !== null &&
    Number.isInteger(config.trips) &&
    config.trips >= 1 &&
    Number.isInteger(config.discount) &&
    config.discount >= 0 &&
    (config.customPrice === null ||
      (Number.isInteger(config.customPrice) && config.customPrice > 0)) &&
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
