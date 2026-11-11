import type { Price, Vehicle } from '../../../shared/domain/model';
import type { RentalKitItem } from '../../../shared/domain/model';

export type BookingQuoteConfig = {
  trips: number;
  discount: number;
  discountType: 'fcfa' | 'pct';
  discountReason: string;
  customPrice: number | null;
  labourUnitPriceOverride?: number | null;
  billingMode?: 'complete' | 'standard' | 'driver-rental';
  menuIncluded?: boolean;
  overtimeMinutes?: number;
  rentalKit?: RentalKitItem[] | null;
};

export function quoteTierForDistance(
  distance: number | undefined,
  bounds: readonly number[],
): number {
  if (distance == null) return 0;
  if (distance < bounds[0]) return 0;
  if (distance <= bounds[1]) return 1;
  if (distance <= bounds[2]) return 2;
  return 3;
}

export function createBookingQuotePreview(input: {
  price: Price | null;
  config?: BookingQuoteConfig;
  tier: number;
  tierLabel: string;
  trips: number;
  selected?: Vehicle;
  hasRoute: boolean;
}): Price | null {
  const { price, config, tier, tierLabel, trips, selected, hasRoute } = input;
  if (!price) return null;

  const transportUnit = tier === 3 ? (config?.customPrice ?? 0) : (selected?.prices[tier] ?? 0);
  const rawLines =
    config && selected && hasRoute
      ? [
          {
            label: `Transport ${selected.shortName || selected.name} · ${tierLabel.toLowerCase()} (aller-retour)`,
            quantity: trips,
            unitPrice: transportUnit,
            total: transportUnit * trips,
          },
          ...price.lines.filter((line) => !line.label.startsWith('Transport ')),
        ]
      : price.lines;
  const lines = rawLines.map((line) =>
    config?.labourUnitPriceOverride && /^Manœuvre/u.test(line.label)
      ? {
          ...line,
          unitPrice: config.labourUnitPriceOverride,
          total: line.quantity * config.labourUnitPriceOverride,
        }
      : line,
  );
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const totalIsPending = tier === 3 && config?.customPrice == null;
  const discount = totalIsPending
    ? 0
    : config?.discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, config.discount)) / 100)
      : Math.min(subtotal, config?.discount ?? 0);
  const discountValue = config?.discount ?? 0;
  const discountType = config?.discountType ?? 'fcfa';
  const discountReason = config?.discountReason?.trim() ?? '';
  const discountLabel = `Remise${discountType === 'pct' && discountValue ? ` (${Math.min(100, discountValue)} %)` : ''}${discountReason ? ` · ${discountReason}` : ''}`;

  return {
    ...price,
    tier,
    lines,
    total: totalIsPending ? null : subtotal - discount,
    discount,
    discountLabel,
    discountType,
    discountValue,
    discountReason,
    trips,
  };
}
