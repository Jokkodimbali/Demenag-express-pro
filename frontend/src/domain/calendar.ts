import type { Booking } from './model';

type UndatedBooking = Pick<Booking, 'date' | 'month' | 'createdAt' | 'status'>;

export function isUndatedBookingForMonth(booking: UndatedBooking, month: string): boolean {
  return (
    !booking.date &&
    booking.status !== 'cancelled' &&
    (booking.month ?? booking.createdAt.slice(0, 7)) === month
  );
}
