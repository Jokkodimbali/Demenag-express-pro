import { useEffect, useState } from 'react';
import type { Booking } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
export function useAccount() {
  const { api, user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
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
  return { user, bookings, setBookings, loading, error, setRetry };
}
