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
  return taxiBaseTripCount(estimatedTrips, configuredTrips, calcMode);
}

export function taxiPaidLegCount(rotationCount: number): number {
  return Math.max(1, Math.max(0, Math.round(rotationCount)) * 2 - 1);
}
