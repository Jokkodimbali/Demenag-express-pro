import type { Draft } from '../../../../booking/application/booking-draft';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type { TollExtraLine } from '../../../../moving/domain/tolls/toll-selection';
import type { RouteTicket, Settings, Vehicle } from '../../../../shared/domain/model';
import { estimateMovingWork } from '../../../../moving/domain/estimate/moving-estimate';
import { labourUnitPrice } from '../../../../moving/domain/pricing/labour-price';
import { referencePlannedTrips } from '../../../../moving/application/services/loading-simulation-model';

export function routeForQuotePricing(
  route: RouteTicket | null,
  distanceOverride: number | null,
): RouteTicket | null {
  return route && distanceOverride != null ? { ...route, distanceKm: distanceOverride } : route;
}

export function labourPriceForQuote(settings: Settings | undefined, draft: Draft) {
  return settings
    ? labourUnitPrice(settings, {
        fromFloor: draft.inventory.fromFloor,
        toFloor: draft.inventory.toFloor,
        fromLift: draft.inventory.fromLift,
        toLift: draft.inventory.toLift,
      })
    : 0;
}

export function quoteHasPaidTolls(lines: readonly TollExtraLine[]) {
  return lines.some((line) => line.quantity * line.unitPrice > 0);
}

export function estimateAdminQuoteWork(input: {
  inventory: Inventory;
  vehicle?: Vehicle;
  route: RouteTicket | null;
  draft: Draft;
  config: AdminQuoteConfig;
  settings?: Settings;
  tollLines: readonly TollExtraLine[];
}) {
  if (!input.vehicle) return null;
  const recommendedTrips = referencePlannedTrips(
    input.inventory,
    input.vehicle,
    input.settings?.movingLaborPlanning,
  );
  return estimateMovingWork(input.inventory, input.vehicle, input.route, {
    recommendedTrips: recommendedTrips ?? undefined,
    // In automatic mode the reference calculates the crew using the trip
    // count it has just estimated from the loading simulation. Manual mode
    // keeps the operator's explicit trip and crew values.
    trips:
      input.config.calcMode === 'manual' ? input.config.trips : (recommendedTrips ?? undefined),
    crew: input.config.calcMode === 'manual' ? input.draft.inventory.crew : 0,
    startTime: input.draft.timeSlot,
    laborPlanning: input.settings?.movingLaborPlanning,
    ignoreTraffic: input.config.trafficOff,
    manualLegMinutes: input.config.calcMode === 'manual' ? input.config.legMinutes : 0,
    date: input.draft.date,
    month: input.draft.month,
    fromAddress: input.draft.fromAddress,
    toAddress: input.draft.toAddress,
    hasToll: quoteHasPaidTolls(input.tollLines),
    heatOff: input.config.heatOff,
    heatRest: input.config.heatRest,
  });
}
