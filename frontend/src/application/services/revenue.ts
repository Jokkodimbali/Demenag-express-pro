import { liveBookingPrice } from './live-booking-price';
import type { Booking, Catalogue, Quote } from '../../domain/model';

export type Revenue = { provisional: number; definitive: number; total: number };

const lastQuote = (booking: Booking, kind: Quote['kind']) =>
  booking.quotes.filter((quote) => quote.kind === kind).at(-1);

/** Montant courant d'une réservation : définitif, puis provisoire, puis estimation initiale. */
export function bookingRevenueAmount(booking: Booking, catalogue?: Catalogue | null) {
  if (catalogue) return liveBookingPrice(booking, catalogue).total ?? 0;
  const finalAmount = lastQuote(booking, 'final')?.price.total;
  if (finalAmount !== null && finalAmount !== undefined) return finalAmount;
  const provisionalAmount = lastQuote(booking, 'provisional')?.price.total;
  if (provisionalAmount !== null && provisionalAmount !== undefined) return provisionalAmount;
  return booking.estimate.total ?? 0;
}

export function revenueFor(bookings: Booking[], catalogue?: Catalogue | null): Revenue {
  const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled');
  const provisional = activeBookings
    .filter((booking) => booking.status === 'pending')
    .reduce((sum, booking) => sum + bookingRevenueAmount(booking, catalogue), 0);
  const definitive = activeBookings
    .filter((booking) => booking.status !== 'pending')
    .reduce((sum, booking) => sum + bookingRevenueAmount(booking, catalogue), 0);
  const total = provisional + definitive;
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
