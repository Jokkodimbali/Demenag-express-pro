import { useEffect, useState } from 'react';
import type { Booking } from '../../../shared/domain/model';
import { useApp } from '../../../shared/application/context';
import { errorMessage } from '../../../shared/application/error-message';
import { subscribeToBookingNotifications } from '../../../booking/application/services/booking-notification-refresh';
export function useAccount() {
  const { api, user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
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
  return { user, bookings, loading, error, setRetry };
}
