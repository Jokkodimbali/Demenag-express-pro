import { useMemo } from 'react';
import { useApp } from '../context';

export function useAdminFleet() {
  const { api } = useApp();
  return useMemo(
    () => ({
      updateDriver: (...args: Parameters<typeof api.updateDriver>) => api.updateDriver(...args),
      updateCrew: (...args: Parameters<typeof api.updateCrew>) => api.updateCrew(...args),
      searchAddress: (query: string) => api.search(query),
      reverseAddress: (...args: Parameters<typeof api.reverse>) => api.reverse(...args),
      loadDrivers: () => api.drivers(),
      route: (...args: Parameters<typeof api.route>) => api.route(...args),
      createDriver: (...args: Parameters<typeof api.createDriver>) => api.createDriver(...args),
      resetDriverPassword: (id: string) => api.resetDriverPassword(id),
      deleteDriver: (id: string) => api.deleteDriver(id),
      loadBookings: () => api.bookings(),
    }),
    [api],
  );
}
