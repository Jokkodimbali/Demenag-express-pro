import { CalendarDays, CheckCircle2, ClipboardList, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messages } from '../../content/fr';
import type { Booking, BookingStatus } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { subscribeToBookingNotifications } from './booking-notification-refresh';
export function useAdministration() {
  const { api } = useApp();
  const [params] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [filter, setFilter] = useState<BookingStatus | 'all'>('all'),
    [dateFilter, setDateFilter] = useState(''),
    [weekdayFilter, setWeekdayFilter] = useState('all'),
    [query, setQuery] = useState(() => params.get('q') ?? '');
  useEffect(() => setQuery(params.get('q') ?? ''), [params]);
  useEffect(() => {
    return subscribeToBookingNotifications(api, setBookings);
  }, [api]);
  useEffect(() => {
    let active = true;
    setLoading(true);
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
  }, [api, retry]);
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
