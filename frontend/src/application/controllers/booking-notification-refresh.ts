import type { Dispatch, SetStateAction } from 'react';
import type { Booking } from '../../domain/model';
import type { BookingRepository } from '../ports';

export function subscribeToBookingNotifications(
  api: Pick<BookingRepository, 'booking'>,
  setBookings: Dispatch<SetStateAction<Booking[]>>,
) {
  const pending = new Set<string>();

  function refreshChangedBooking(event: Event) {
    const bookingId = (event as CustomEvent<{ bookingId?: unknown }>).detail?.bookingId;
    if (typeof bookingId !== 'string' || pending.has(bookingId)) return;

    pending.add(bookingId);
    void api
      .booking(bookingId)
      .then((booking) => {
        setBookings((current) => {
          const exists = current.some((item) => item.id === booking.id);
          return exists
            ? current.map((item) => (item.id === booking.id ? booking : item))
            : [booking, ...current];
        });
      })
      .catch(() => undefined)
      .finally(() => pending.delete(bookingId));
  }

  window.addEventListener('demenag:notification', refreshChangedBooking);
  return () => window.removeEventListener('demenag:notification', refreshChangedBooking);
}
