import { useMemo } from 'react';
import { useApp } from '../../../application/context';

export function useRouteMapCommands() {
  const { api } = useApp();
  return useMemo(
    () => ({
      searchAddresses: (query: string) => api.search(query),
      reverseGeocode: (...args: Parameters<typeof api.reverse>) => api.reverse(...args),
      calculateRoute: (...args: Parameters<typeof api.route>) => api.route(...args),
    }),
    [api],
  );
}
