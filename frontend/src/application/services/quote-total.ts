import type { Booking, Options, Settings } from '../../domain/model';
import { labourUnitPrice } from '../../domain/labour-price';

export type QuoteExtraLine = { label: string; quantity: number; unitPrice: number };

export function quoteTotal(
  booking: Booking,
  settings: Settings,
  draft: {
    trips: number;
    customPrice: number | null;
    discount: number;
    options: Options;
    kind?: 'provisional' | 'final';
  },
  extras: QuoteExtraLine[],
) {
  const { tier } = booking.estimate;
  const transportUnit = draft.customPrice ?? (tier === 3 ? null : booking.vehicle.prices[tier]);
  const maxTrips = draft.kind === 'final' ? 10000 : settings.maxTrips;
  if (!Number.isInteger(draft.trips) || draft.trips < 1 || draft.trips > maxTrips) return null;
  if (!Number.isInteger(draft.discount) || draft.discount < 0) return null;
  const optionTotal =
    draft.options.labour * labourUnitPrice(settings, booking.workAccess) +
    (draft.options.desk + draft.options.wardrobe + draft.options.bed) * settings.assemblyPrice;
  const extrasTotal = extras.reduce((sum, line) => {
    if (!line.label.trim() || line.quantity < 1 || line.unitPrice < 1) return sum;
    return sum + line.quantity * line.unitPrice;
  }, 0);
  if (transportUnit === null) return null;
  const subtotal = transportUnit * draft.trips + optionTotal + extrasTotal;
  return draft.discount <= subtotal ? subtotal - draft.discount : null;
}
