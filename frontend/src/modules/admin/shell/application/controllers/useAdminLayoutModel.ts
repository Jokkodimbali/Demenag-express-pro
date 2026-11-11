import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Booking } from '../../../../shared/domain/model';
import type { AppNotification } from '../../../../shared/application/ports';
import { useApp } from '../../../../shared/application/context';
import { routes } from '../../../../shared/navigation/config/routes';
import {
  findAdminSearchResults,
  normalizeAdminSearchQuery,
  unreadNotificationPreview,
  type AdminSearchResult,
} from '../services/admin-search';

export type { AdminSearchResult } from '../services/admin-search';

export function useAdminLayoutModel() {
  const { api } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [todoError, setTodoError] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationBookings, setNotificationBookings] = useState<Booking[] | null>(null);
  const requestId = useRef(0);
  const todoRef = useRef<HTMLDivElement>(null);
  const knownNotificationIds = useRef(new Set<string>());
  const normalizedQuery = normalizeAdminSearchQuery(query);
  const todo = unreadNotificationPreview(notifications);

  useEffect(() => {
    let active = true;
    void api
      .notifications()
      .then((inbox) => {
        if (!active) return;
        setNotifications(inbox.items);
        setNotificationCount(inbox.unreadCount);
        knownNotificationIds.current = new Set(inbox.items.map((item) => item.id));
      })
      .catch(() => {});
    const onNotification = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const item = event.detail as AppNotification;
      if (!item?.id) return;
      if (!knownNotificationIds.current.has(item.id)) {
        knownNotificationIds.current.add(item.id);
        if (!item.readAt) setNotificationCount((count) => count + 1);
      }
      setNotifications((current) => [item, ...current.filter((value) => value.id !== item.id)]);
    };
    window.addEventListener('demenag:notification', onNotification);
    return () => {
      active = false;
      window.removeEventListener('demenag:notification', onNotification);
    };
  }, [api]);

  useEffect(() => {
    if (!todoOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!todoRef.current?.contains(event.target as Node)) setTodoOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTodoOpen(false);
      todoRef.current?.querySelector<HTMLButtonElement>('.admin-todo-toggle')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [todoOpen]);

  useEffect(() => {
    const current = ++requestId.current;
    if (normalizedQuery.length < 2) return;
    const timer = window.setTimeout(() => {
      void Promise.all([api.bookings(), api.clientProfiles()])
        .then(([bookings, clients]) => {
          if (requestId.current !== current) return;
          setResults(findAdminSearchResults(bookings, clients, normalizedQuery));
          setSearching(false);
        })
        .catch(() => {
          if (requestId.current === current) setSearching(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [api, normalizedQuery]);

  function openResult(result: AdminSearchResult) {
    setQuery('');
    setResults([]);
    if (result.kind === 'booking')
      navigate(
        `${routes.administrationCreateQuote}?modifier=${encodeURIComponent(result.booking.id)}`,
      );
    else navigate(`${routes.administrationClients}?q=${encodeURIComponent(result.phone)}`);
  }

  function toggleTodo() {
    setTodoError('');
    setTodoOpen((current) => {
      const opening = !current;
      if (opening && notificationBookings === null)
        void api
          .bookings()
          .then(setNotificationBookings)
          .catch(() => {});
      return opening;
    });
  }

  async function markAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      );
      setNotificationCount(0);
      setTodoOpen(false);
    } catch {
      setTodoError('Les notifications n’ont pas pu être marquées comme vues.');
    }
  }

  return {
    query,
    setQuery,
    results,
    setResults,
    searching,
    setSearching,
    normalizedQuery,
    todoOpen,
    setTodoOpen,
    todoError,
    setTodoError,
    notifications,
    setNotifications,
    notificationCount,
    notificationBookings,
    todoRef,
    todo,
    openResult,
    toggleTodo,
    markAllNotificationsRead,
  };
}
