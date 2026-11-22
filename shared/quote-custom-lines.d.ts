export type CustomQuoteLine = { label: string; quantity: number; unitPrice: number };
export type SavedQuotePrice = {
  lines: Array<CustomQuoteLine & { total: number }>;
  total: number | null;
  discount: number;
  discountType?: 'fcfa' | 'pct';
  discountValue?: number;
};
export function replaceSavedCustomLines<T extends SavedQuotePrice>(
  price: T,
  previousCustomLines: readonly CustomQuoteLine[],
  nextCustomLines: readonly CustomQuoteLine[],
): T;
