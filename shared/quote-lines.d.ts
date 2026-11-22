export type ConsolidatedQuoteLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function isAssemblyServiceLine(label: string): boolean;

export function consolidateDuplicateQuoteLines<T extends ConsolidatedQuoteLine>(
  lines: readonly T[],
): T[];
