import { useCallback } from 'react';
import { useApp } from '../context';

export function useAdminProfile() {
  const { api, setUser } = useApp();
  const updateProfile = useCallback(
    async (input: Parameters<typeof api.updateAdminProfile>[0]) =>
      setUser(await api.updateAdminProfile(input)),
    [api, setUser],
  );
  return { updateProfile };
}
