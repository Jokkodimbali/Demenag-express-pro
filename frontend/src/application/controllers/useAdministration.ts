import { CalendarDays, CheckCircle2, ClipboardList, Truck } from 'lucide-react';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messages } from '../../content/fr';
import type { Booking, BookingStatus } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { subscribeToBookingNotifications } from './booking-notification-refresh';
const bookingCache = new Map<string, { bookings: Booking[]; updatedAt: number }>();
const bookingCacheLifetime = 15_000;
export function useAdministration() {
  const { api, user } = useApp();
  const userId = user?.id ?? '';
  const [params] = useSearchParams();
  const [bookings, setLocalBookings] = useState<Booking[]>(
    () => bookingCache.get(userId)?.bookings ?? [],
  ),
    [loading, setLoading] = useState(() => !bookingCache.has(userId)),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [filter, setFilter] = useState<BookingStatus | 'all'>('all'),
    [dateFilter, setDateFilter] = useState(''),
    [weekdayFilter, setWeekdayFilter] = useState('all'),
    [query, setQuery] = useState(() => params.get('q') ?? '');
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
  useEffect(() => setQuery(params.get('q') ?? ''), [params]);
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
  const visible = bookings.filter((b) => {
    const weekday = b.date ? String(new Date(b.date + 'T00:00:00Z').getUTCDay() || 7) : '';
    return (
      (filter === 'all' || filter === b.status) &&
      (!dateFilter || b.date === dateFilter) &&
      (weekdayFilter === 'all' || weekday === weekdayFilter) &&
      `${b.reference} ${b.customerName} ${b.phone}`.toLowerCase().includes(query.toLowerCase())
    );
  });
  const stats = [
    { label: messages.demandesRecues, status: 'pending', Icon: ClipboardList },
    { label: messages.aPreparer, status: 'confirmed', Icon: CalendarDays },
    { label: messages.enCours, status: 'in_progress', Icon: Truck },
    { label: messages.terminees, status: 'completed', Icon: CheckCircle2 },
  ];
  return {
    bookings,
    setBookings,
    loading,
    error,
    setRetry,
    filter,
    setFilter,
    dateFilter,
    setDateFilter,
    weekdayFilter,
    setWeekdayFilter,
    query,
    setQuery,
    visible,
    stats,
  };
}
