import type { Booking, Quote, TollPoint, Vehicle } from '../../../../shared/domain/model';

export function latestQuoteOfKind(quotes: Quote[], kind: Quote['kind']): Quote | undefined {
  return quotes.filter((quote) => quote.kind === kind).at(-1);
}

export function latestBookingQuote(booking: Booking | null): Quote | undefined {
  return booking?.quotes.at(-1);
}

export function adminQuoteIsLocked(booking: Booking | null): boolean {
  return Boolean(
    booking &&
    (booking.status === 'completed' ||
      booking.status === 'cancelled' ||
      booking.quotes.some((quote) => quote.kind === 'final')),
  );
}

export function quoteVehicleWithSavedPrices(
  selected: Vehicle | null,
  booking: Booking | null,
): Vehicle | null {
  if (!selected || !booking) return selected;
  const savedPrices = booking.pricingSnapshot?.vehiclePrices[selected.id];
  if (savedPrices) return { ...selected, prices: savedPrices };
  if (booking.vehicle.id === selected.id) return { ...selected, prices: booking.vehicle.prices };
  return selected;
}

export function quoteTollPointsWithSavedPrices(
  points: TollPoint[],
  booking: Booking | null,
): TollPoint[] {
  const savedPrices = new Map(
    booking?.pricingSnapshot?.tollPoints.map((point) => [point.id, point]) ?? [],
  );
  return points.map((point) => {
    const saved = savedPrices.get(point.id);
    return saved
      ? { ...point, heavyPrice: saved.heavyPrice, vehiclePrices: saved.vehiclePrices }
      : point;
  });
}

export function quotePdfFilename(quote: Quote, bookingReference: string) {
  const kind = quote.kind === 'final' ? 'final' : 'provisoire';
  return `Devis-${kind}-${quote.reference || bookingReference}.pdf`;
}
