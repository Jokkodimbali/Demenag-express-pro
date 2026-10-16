import { CalendarDays, CheckCircle2, ClipboardList, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { messages } from '../../content/fr';
import type { Booking, BookingStatus } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
export function useAdministration() {
  const { api } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [tab, setTab] = useState<'bookings' | 'settings' | 'users' | 'fleet'>('bookings'),
    [filter, setFilter] = useState<BookingStatus | 'all'>('all'),
    [query, setQuery] = useState('');
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
  const visible = bookings.filter(
    (b) =>
      (filter === 'all' || filter === b.status) &&
      `${b.reference} ${b.customerName} ${b.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
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
    tab,
    setTab,
    filter,
    setFilter,
    query,
    setQuery,
    visible,
    stats,
  };
}
