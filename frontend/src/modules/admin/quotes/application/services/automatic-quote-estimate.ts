import type { Draft } from '../../../../booking/application/booking-draft';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';

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
