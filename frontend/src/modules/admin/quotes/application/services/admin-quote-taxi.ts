export function taxiBaseTripCount(
  estimatedTrips: number | null | undefined,
  configuredTrips: number,
  calcMode: 'auto' | 'manual' = 'auto',
): number {
  const selectedTrips =
    calcMode === 'manual' ? configuredTrips : (estimatedTrips ?? configuredTrips);
  return Number.isFinite(selectedTrips) ? Math.max(1, Math.round(selectedTrips)) : 1;
}

export function taxiRotationCount(
  estimatedTrips: number | null | undefined,
  configuredTrips: number,
  calcMode: 'auto' | 'manual' = 'auto',
): number {
  return taxiBaseTripCount(estimatedTrips, configuredTrips, calcMode) + 1;
}
