import type { Booking, Options, Settings } from '../../domain/model';
import { assemblyUnitPrice, labourUnitPrice } from '../../domain/labour-price';
import {
  inventoryAssemblyLines,
  subtractInventoryAssemblyOptions,
} from '../../domain/inventory-assembly';
import {
  referenceLowDemandDiscount,
  referenceTransportLines,
} from '../../domain/reference-pricing';

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
    billingMode?: 'complete' | 'standard' | 'driver-rental';
    menuIncluded?: boolean;
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
  const mode = draft.billingMode ?? 'complete';
  const billableOptions =
    mode === 'driver-rental'
      ? {
          ...options,
          labour: 0,
          ...(draft.menuIncluded ? {} : { desk: 0, wardrobe: 0, bed: 0 }),
        }
      : mode === 'standard'
        ? { ...options, desk: 0, wardrobe: 0, bed: 0 }
        : options;
  const optionTotal =
    billableOptions.labour * labourUnitPrice(settings, booking.workAccess) +
    billableOptions.desk * assemblyUnitPrice(settings, 'bureau') +
    billableOptions.wardrobe * assemblyUnitPrice(settings, 'armoire') +
    billableOptions.bed * assemblyUnitPrice(settings, 'lit');
  const inventoryLines =
    mode === 'complete' || (mode === 'driver-rental' && draft.menuIncluded)
      ? inventoryAssemblyLines(booking.inventorySnapshot?.sourceInventory, settings)
      : [];
  const extrasTotal = extras.reduce((sum, line) => {
    const halfHourCharge = line.label.startsWith('Manœuvres · heures au-delà');
    if (!line.label.trim() || line.quantity < (halfHourCharge ? 0.5 : 1) || line.unitPrice < 1)
      return sum;
    return sum + line.quantity * line.unitPrice;
  }, 0);
  const inventoryTotal = inventoryLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const transportLines = referenceTransportLines(
    'Transport',
    transportUnit,
    draft.trips,
    settings.movingLaborPlanning?.followingTripDiscountPercent ?? 100,
  );
  const transportTotal = transportLines.reduce((sum, line) => sum + line.total, 0);
  const lowDemandDiscount = referenceLowDemandDiscount(
    transportTotal,
    booking.date,
    settings.movingLaborPlanning?.lowDemandDiscountPercent ?? 0,
  );
  const subtotal = transportTotal - lowDemandDiscount + optionTotal + inventoryTotal + extrasTotal;
  const discount =
    draft.discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, draft.discount)) / 100)
      : Math.min(subtotal, draft.discount);
  return subtotal - discount;
}
