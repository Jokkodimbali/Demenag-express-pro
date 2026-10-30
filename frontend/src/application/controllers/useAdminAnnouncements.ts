import { useCallback } from 'react';
import { useApp } from '../context';

export function useAdminAnnouncements() {
  const { api } = useApp();
  const announceDrivers = useCallback(
    (title: string, message: string) => api.announceDrivers(title, message),
    [api],
  );
  return { announceDrivers };
}
