import type { Draft } from '../../../../booking/application/booking-draft';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';

export type AppliedVehicleEstimate = {
  vehicleId: string;
  inventoryKey: string;
  trips: number;
};

export function persistedVehicleEstimate(
  vehicleId: string,
  inventoryKey: string,
  config: AdminQuoteConfig,
): AppliedVehicleEstimate | null {
  if (
    config.calcMode !== 'auto' ||
    !vehicleId ||
    !Number.isInteger(config.trips) ||
    config.trips < 1
  )
    return null;
  return { vehicleId, inventoryKey, trips: config.trips };
}

export function shouldPreserveAppliedVehicleEstimate(input: {
  applied: AppliedVehicleEstimate | null;
  selectedVehicleId: string;
  inventoryKey: string;
  configuredTrips: number;
}) {
  return Boolean(
    input.applied &&
    input.applied.vehicleId === input.selectedVehicleId &&
    input.applied.inventoryKey === input.inventoryKey &&
    input.applied.trips === input.configuredTrips,
  );
}

export function automaticQuoteEstimateUpdates(input: {
  config: AdminQuoteConfig;
  draft: Draft;
  selectedVehicleId: string;
  estimatedVolume: number;
  estimatedCrew: number;
  estimatedTrips: number;
}) {
  if (input.config.calcMode === 'manual' || !input.selectedVehicleId || input.estimatedVolume <= 0)
    return { labour: null, trips: null };

  return {
    labour: input.draft.options.labour === input.estimatedCrew ? null : input.estimatedCrew,
    trips:
      input.estimatedTrips > 0 && input.config.trips !== input.estimatedTrips
        ? input.estimatedTrips
        : null,
  };
}
