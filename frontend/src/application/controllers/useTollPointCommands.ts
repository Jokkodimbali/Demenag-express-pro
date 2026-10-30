import { useMemo } from 'react';
import { useApp } from '../context';

export function useTollPointCommands() {
  const { api } = useApp();
  return useMemo(
    () => ({
      searchAddress: (query: string) => api.search(query),
      createTollPoint: (...args: Parameters<typeof api.createTollPoint>) =>
        api.createTollPoint(...args),
      updateTollPoint: (...args: Parameters<typeof api.updateTollPoint>) =>
        api.updateTollPoint(...args),
      deleteTollPoint: (id: string) => api.deleteTollPoint(id),
    }),
    [api],
  );
}
