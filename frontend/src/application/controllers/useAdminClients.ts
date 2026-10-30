import { useCallback } from 'react';
import { useApp } from '../context';

export function useAdminClients() {
  const { api } = useApp();
  const loadDirectory = useCallback(
    () => Promise.all([api.clientProfiles(), api.hiddenClients(), api.users()]),
    [api],
  );
  const updateClient = useCallback(
    (...args: Parameters<typeof api.updateClient>) => api.updateClient(...args),
    [api],
  );
  const hideClientProfile = useCallback((phone: string) => api.hideClient(phone), [api]);
  const resetClientPassword = useCallback(
    (...args: Parameters<typeof api.resetClientPassword>) => api.resetClientPassword(...args),
    [api],
  );
  return { loadDirectory, updateClient, hideClientProfile, resetClientPassword };
}
