type TaxiPriceLine = { label: string; quantity: number; unitPrice: number; total: number };
type TaxiPrice = { lines: TaxiPriceLine[]; total: number | null };

export function manoeuvreCount(lines: readonly TaxiPriceLine[]): number;
export function applyTaxiToManoeuvrePrice<T extends TaxiPrice>(price: T, taxiAmount: number): T;
export function removeTaxiFromManoeuvrePrice<T extends TaxiPrice>(price: T, taxiAmount: number): T;
