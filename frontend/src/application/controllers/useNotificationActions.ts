import { useMemo } from 'react';
import { useApp } from '../context';
import type { NotificationInbox } from '../ports';

function validInbox(value: unknown): value is NotificationInbox {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items) &&
    'unreadCount' in value &&
    typeof value.unreadCount === 'number'
  );
}

export function useNotificationActions() {
  const { api } = useApp();
  return useMemo(
    () => ({
      async loadNotifications() {
        const inbox: unknown = await api.notifications();
        return validInbox(inbox) ? inbox : null;
      },
      markAllNotificationsRead: () => api.markAllNotificationsRead(),
      markNotificationRead: (id: string) => api.markNotificationRead(id),
    }),
    [api],
  );
}
