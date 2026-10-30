import type { Booking, Options, Settings } from '../../domain/model';
import { assemblyUnitPrice, labourUnitPrice } from '../../domain/labour-price';
import {
  inventoryAssemblyLines,
  subtractInventoryAssemblyOptions,
} from '../../domain/inventory-assembly';

export type QuoteExtraLine = { label: string; quantity: number; unitPrice: number };

export function savedCustomTransportPrice(booking: Booking, quote?: Booking['quotes'][number]) {
  const price = quote?.price ?? booking.estimate;
  if (price.tier !== 3) return null;
  return price.lines.find((line) => line.label.startsWith('Transport'))?.unitPrice ?? null;
}

export function quoteTotal(
  booking: Booking,
  settings: Settings,
  draft: {
    trips: number;
    customPrice: number | null;
    discount: number;
    discountType?: 'fcfa' | 'pct';
    options: Options;
    kind?: 'provisional' | 'final';
  },
  extras: QuoteExtraLine[],
) {
  const { tier } = booking.estimate;
  const transportUnit = tier === 3 ? (draft.customPrice ?? 0) : booking.vehicle.prices[tier];
  const maxTrips = draft.kind === 'final' ? 10000 : settings.maxTrips;
  if (!Number.isInteger(draft.trips) || draft.trips < 1 || draft.trips > maxTrips) return null;
  if (!Number.isInteger(draft.discount) || draft.discount < 0) return null;
  const options = subtractInventoryAssemblyOptions(
    draft.options,
    booking.inventorySnapshot?.sourceInventory,
  );
  const optionTotal =
    options.labour * labourUnitPrice(settings, booking.workAccess) +
    options.desk * assemblyUnitPrice(settings, 'bureau') +
    options.wardrobe * assemblyUnitPrice(settings, 'armoire') +
    options.bed * assemblyUnitPrice(settings, 'lit');
  const inventoryLines = inventoryAssemblyLines(
    booking.inventorySnapshot?.sourceInventory,
    settings,
  );
  const extrasTotal = extras.reduce((sum, line) => {
    if (!line.label.trim() || line.quantity < 1 || line.unitPrice < 1) return sum;
    return sum + line.quantity * line.unitPrice;
  }, 0);
  const inventoryTotal = inventoryLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const subtotal = transportUnit * draft.trips + optionTotal + inventoryTotal + extrasTotal;
  const discount =
    draft.discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, draft.discount)) / 100)
      : Math.min(subtotal, draft.discount);
  return subtotal - discount;
}
