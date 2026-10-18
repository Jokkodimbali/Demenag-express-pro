import type { Booking, Quote } from '../../domain/model';

export type Revenue = { provisional: number; definitive: number; total: number };

const amount = (quote: Quote | undefined) => quote?.price.total ?? 0;
const lastQuote = (booking: Booking, kind: Quote['kind']) =>
  booking.quotes.filter((quote) => quote.kind === kind).at(-1);

export function revenueFor(bookings: Booking[]): Revenue {
  const provisional = bookings.reduce(
    (sum, booking) => sum + amount(lastQuote(booking, 'provisional')),
    0,
  );
  const definitive = bookings.reduce(
    (sum, booking) => sum + amount(lastQuote(booking, 'final')),
    0,
  );
  const total = bookings.reduce(
    (sum, booking) =>
      sum + amount(lastQuote(booking, 'final') ?? lastQuote(booking, 'provisional')),
    0,
  );
  return { provisional, definitive, total };
}

export function filterByVehicle(bookings: Booking[], vehicleId: string) {
  return vehicleId ? bookings.filter((booking) => booking.vehicle.id === vehicleId) : bookings;
}

export function sameWeek(date: string | null, reference: string) {
  if (!date) return false;
  const start = new Date(reference + 'T12:00:00Z');
  const day = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const target = new Date(date + 'T12:00:00Z');
  return target >= start && target < end;
}
