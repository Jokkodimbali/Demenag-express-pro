export function distanceKmForEstimateRequest(
  distanceKmOverride: number | null | undefined,
  routeDistanceKm: number | undefined,
  administrativeQuote: boolean,
): number | undefined {
  if (distanceKmOverride != null) return distanceKmOverride;
  return administrativeQuote ? routeDistanceKm : undefined;
}
