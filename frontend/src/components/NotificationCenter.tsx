import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationSession } from '../application/controllers/useNotificationSession';
import { messages } from '../content/fr';
import type { User } from '../domain/model';
import { routes } from '../routing/routes';

type Notification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  bookingId?: string;
};

export function NotificationCenter({ user }: { user: User | null }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const verifySession = useNotificationSession();

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    const base = import.meta.env.VITE_API_URL || '/api';
    const source = new EventSource(`${base}/notifications/stream`, { withCredentials: true });
    source.addEventListener('notification', (event) => {
      if (!(event instanceof MessageEvent)) return;
      if (typeof event.data !== 'string') return;
      try {
        const notification: unknown = JSON.parse(event.data);
        if (
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
        )
          setItems((current) => [notification as Notification, ...current].slice(0, 20));
      } catch {
        return;
      }
    });
    let active = true;
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
    <div className="notification-center">
      <button
        className="icon-button"
        aria-label={messages.notifications}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {items.length > 0 && <span className="notification-count">{items.length}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label={messages.notifications}>
          <div>
            <h2>{messages.notifications}</h2>
            <button
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label={messages.fermer}
            >
              <X size={17} />
            </button>
          </div>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className="notification-item"
                    onClick={() => {
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
