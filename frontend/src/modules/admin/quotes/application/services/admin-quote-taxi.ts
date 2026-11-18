export function taxiRotationCount(
  estimatedTrips: number | null | undefined,
  configuredTrips: number,
): number {
  return Math.max(1, estimatedTrips ?? configuredTrips) + 1;
}
