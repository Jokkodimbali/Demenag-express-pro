import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationSession } from '../application/controllers/useNotificationSession';
import { messages } from '../content/fr';
import type { User } from '../domain/model';
import { routes } from '../routing/routes';
import type { AppNotification } from '../application/ports';

export function NotificationCenter({ user }: { user: User | null }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const base = import.meta.env.VITE_API_URL || '/api';
  const centerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const verifySession = useNotificationSession();

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !centerRef.current?.contains(event.target))
        setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    let active = true;
    void fetch(`${base}/notifications`, { credentials: 'include', headers: { 'X-Requested-With': 'DemenagExpress' } })
      .then((response) => response.ok ? response.json() : null)
      .then((data: unknown) => {
        if (!active || typeof data !== 'object' || data === null || !('items' in data) || !Array.isArray(data.items) || !('unreadCount' in data) || typeof data.unreadCount !== 'number') return;
        setItems(data.items as AppNotification[]);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined);
    const source = new EventSource(`${base}/notifications/stream`, { withCredentials: true });
    source.addEventListener('notification', (event) => {
      if (!(event instanceof MessageEvent)) return;
      if (typeof event.data !== 'string') return;
      try {
        const notification: unknown = JSON.parse(event.data);
        const valid = (
          typeof notification === 'object' &&
          notification !== null &&
          'id' in notification &&
          typeof notification.id === 'string' &&
          'title' in notification &&
          typeof notification.title === 'string' &&
          'message' in notification &&
          typeof notification.message === 'string' &&
          'createdAt' in notification &&
          typeof notification.createdAt === 'string' &&
          (!('bookingId' in notification) || typeof notification.bookingId === 'string')
        );
        if (valid) {
          const incoming = notification as AppNotification;
          setItems((current) => {
            if (current.some((item) => item.id === incoming.id)) return current;
            setUnreadCount((count) => count + 1);
            return [incoming, ...current].slice(0, 50);
          });
        }
      } catch {
        return;
      }
    });
    source.onerror = () => {
      // EventSource does not expose the HTTP status; verify the session separately.
      void verifySession(
        () => active,
        () => source.close(),
      );
    };
    return () => {
      active = false;
      source.close();
    };
  }, [user, verifySession]);

  if (!user) return null;
  const destination = (bookingId?: string) => {
    if (user.role === 'admin')
      return bookingId
        ? `${routes.administrationBookings}?detail=${bookingId}`
        : routes.administrationBookings;
    return user.role === 'driver' ? routes.driverWorkspace : routes.account;
  };
  return (
    <div className="notification-center" ref={centerRef}>
      <button
        className="icon-button"
        aria-label={messages.notifications}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label={messages.notifications}>
          <div>
            <h2>{messages.notifications}</h2>
            <div className="notification-panel-actions">
            {unreadCount > 0 && <button className="notification-read-all" onClick={() => {
              void fetch(`${base}/notifications/read-all`, { method: 'PATCH', credentials: 'include', headers: { 'X-Requested-With': 'DemenagExpress' } }).then((response) => {
                if (response.ok) { setUnreadCount(0); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); }
              });
            }}>Tout marquer comme lu</button>}
            <button
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label={messages.fermer}
            >
              <X size={17} />
            </button>
            </div>
          </div>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`notification-item${item.readAt ? '' : ' notification-unread'}`}
                    onClick={() => {
                      if (!item.readAt) {
                        void fetch(`${base}/notifications/${item.id}/read`, { method: 'PATCH', credentials: 'include', headers: { 'X-Requested-With': 'DemenagExpress' } });
                        setUnreadCount((count) => Math.max(0, count - 1));
                        setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, readAt: new Date().toISOString() } : currentItem));
                      }
                      setOpen(false);
                      navigate(destination(item.bookingId));
                    }}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>{messages.aucuneNotification}</p>
          )}
        </section>
      )}
    </div>
  );
}
