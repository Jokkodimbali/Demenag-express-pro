import { useCallback } from 'react';
import { useApp } from '../context';

export function useNotificationSession() {
  const { api, setUser } = useApp();
  return useCallback(
    async (isActive: () => boolean, close: () => void) => {
      try {
        const user = await api.me();
        if (isActive() && (!user || user.active === false)) {
          close();
          setUser(null);
        }
      } catch {
        // Preserve EventSource reconnection during temporary network failures.
      }
    },
    [api, setUser],
  );
}
