import type { TaxiDistanceTariff } from './contracts.js';

export const defaultTaxiDistanceTariffs: TaxiDistanceTariff[];
export function taxiDistanceTariffFor(
  distanceKm: number | null | undefined,
  tariffs: readonly TaxiDistanceTariff[],
): TaxiDistanceTariff | null;
export function taxiFareForDistance(
  distanceKm: number | null | undefined,
  tariffs: readonly TaxiDistanceTariff[],
): number | null;
export function taxiPaidLegCount(rotationCount: number): number;
