import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Booking } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { subscribeToBookingNotifications } from './booking-notification-refresh';
const bookingCache = new Map<string, { bookings: Booking[]; updatedAt: number }>();
const bookingCacheLifetime = 15_000;
export function useAdministration() {
  const { api, user } = useApp();
  const userId = user?.id ?? '';
  const [bookings, setLocalBookings] = useState<Booking[]>(
      () => bookingCache.get(userId)?.bookings ?? [],
    ),
    [loading, setLoading] = useState(() => !bookingCache.has(userId)),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const setBookings = useCallback<Dispatch<SetStateAction<Booking[]>>>(
    (update) => {
      setLocalBookings((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        if (userId) bookingCache.set(userId, { bookings: next, updatedAt: Date.now() });
        return next;
      });
    },
    [userId],
  );
  useEffect(() => {
    return subscribeToBookingNotifications(api, setBookings);
  }, [api, setBookings]);
  useEffect(() => {
    const cached = bookingCache.get(userId);
    if (cached) {
      setLocalBookings(cached.bookings);
      setLoading(false);
      setError('');
      if (Date.now() - cached.updatedAt < bookingCacheLifetime) return;
    } else {
      setLoading(true);
    }
    let active = true;
    setError('');
    api
      .bookings()
      .then((data) => {
        if (active) setBookings(data);
      })
      .catch((e: unknown) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, retry, setBookings, userId]);
  const recordBookingReminder = useCallback(
    async (bookingId: string) => {
      const updated = await api.recordBookingReminder(bookingId);
      setBookings((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      return updated;
    },
    [api, setBookings],
  );
  const removeBooking = useCallback(
    async (bookingId: string) => {
      await api.deleteBooking(bookingId);
      setBookings((rows) => rows.filter((row) => row.id !== bookingId));
    },
    [api, setBookings],
  );
  return {
    bookings,
    setBookings,
    loading,
    error,
    setRetry,
    recordBookingReminder,
    removeBooking,
  };
}
