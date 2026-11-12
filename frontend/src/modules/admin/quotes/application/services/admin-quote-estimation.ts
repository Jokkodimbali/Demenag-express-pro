import type { Draft } from '../../../../booking/application/booking-draft';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type { TollExtraLine } from '../../../../moving/domain/tolls/toll-selection';
import type { RouteTicket, Settings, Vehicle } from '../../../../shared/domain/model';
import { estimateMovingWork } from '../../../../moving/domain/estimate/moving-estimate';
import { labourUnitPrice } from '../../../../moving/domain/pricing/labour-price';

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
  return estimateMovingWork(input.inventory, input.vehicle, input.route, {
    trips: input.config.trips,
    crew: input.draft.inventory.crew,
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
