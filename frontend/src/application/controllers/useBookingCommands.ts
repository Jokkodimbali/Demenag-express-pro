import { useMemo } from 'react';
import { getCachedRoute } from '../services/route-cache';
import { useApp } from '../context';

export function useBookingCommands() {
  const { api } = useApp();
  return useMemo(
    () => ({
      bookings: () => api.bookings(),
      drivers: () => api.drivers(),
      recordReminder: (id: string) => api.recordBookingReminder(id),
      booking: (id: string) => api.booking(id),
      driverBookings: () => api.driverBookings(),
      reverseAddress: (point: Parameters<typeof api.reverse>[0]) => api.reverse(point),
      routeTicket: (from: Parameters<typeof api.route>[0], to: Parameters<typeof api.route>[1]) =>
        getCachedRoute(api, from, to),
      updateRoute: (
        id: string,
        from: Parameters<typeof api.updateBookingRoute>[1],
        to: Parameters<typeof api.updateBookingRoute>[2],
        version: number,
      ) => api.updateBookingRoute(id, from, to, version),
      reviewWorkPlan: (...args: Parameters<typeof api.reviewWorkPlan>) =>
        api.reviewWorkPlan(...args),
      startTrip: (...args: Parameters<typeof api.startBookingTrip>) =>
        api.startBookingTrip(...args),
      finishTrip: (...args: Parameters<typeof api.finishBookingTrip>) =>
        api.finishBookingTrip(...args),
      finishDriverWork: (id: string) => api.finishDriverWork(id),
    }),
    [api],
  );
}
