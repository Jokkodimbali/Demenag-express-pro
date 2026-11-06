import { uiText } from '../content/reference-ui-text';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { useApp } from '../application/context';
import type { Booking } from '../domain/model';
import type { AppNotification } from '../application/ports';

type SearchResult =
  | { kind: 'booking'; booking: Booking }
  | { kind: 'client'; phone: string; name: string; address: string };

const groups = [
  {
    label: 'COMMERCIAL',
    sections: [
      { to: routes.administration, label: 'Réservations' },
      { to: routes.administrationCreateQuote, label: 'Créer un devis' },
      { to: routes.administrationClients, label: 'Clients' },
    ],
  },
  {
    label: 'OPÉRATIONS',
    sections: [
      { to: routes.administrationPlanning, label: 'Calendrier' },
      { to: routes.administrationFleet, label: 'Équipes' },
      { to: routes.administrationPlanFollowUp, label: 'Suivi planning' },
      { to: routes.administrationVehicleReports, label: 'Contrôles' },
    ],
  },
  {
    label: 'FINANCE',
    sections: [
      { to: routes.administrationAccounting, label: 'Comptabilité' },
      { to: routes.administrationTollPoints, label: 'Péages' },
    ],
  },
  {
    label: 'RÉGLAGES',
    sections: [
      { to: routes.administrationSettings, label: 'Paramètres' },
      { to: routes.administrationData, label: 'Données' },
    ],
  },
];
export function AdminLayout() {
  const { api } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const requestId = useRef(0);
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  useEffect(() => {
    let active = true;
    void api
      .notifications()
      .then((inbox) => {
        if (active) setNotifications(inbox.items);
      })
      .catch(() => {});
    const onNotification = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const item = event.detail as AppNotification;
      if (!item?.id) return;
      setNotifications((current) => [item, ...current.filter((value) => value.id !== item.id)]);
    };
    window.addEventListener('demenag:notification', onNotification);
    return () => {
      active = false;
      window.removeEventListener('demenag:notification', onNotification);
    };
  }, [api]);
  const todo = notifications.filter((item) => !item.readAt).slice(0, 12);
  useEffect(() => {
    const current = ++requestId.current;
    if (normalizedQuery.length < 2) return;
    const timer = window.setTimeout(() => {
      void Promise.all([api.bookings(), api.clientProfiles()])
        .then(([bookings, clients]) => {
          if (requestId.current !== current) return;
          const digits = normalizedQuery.replace(/\D/g, '');
          const bookingResults: SearchResult[] = bookings
            .filter(
              (booking) =>
                [
                  booking.reference,
                  booking.customerName,
                  booking.fromAddress,
                  booking.toAddress,
                ].some((value) => value.toLocaleLowerCase('fr').includes(normalizedQuery)) ||
                (digits.length >= 3 && booking.phone.replace(/\D/g, '').includes(digits)),
            )
            .slice(0, 8)
            .map((booking) => ({ kind: 'booking', booking }));
          const clientResults: SearchResult[] = clients
            .filter(
              (client) =>
                client.name.toLocaleLowerCase('fr').includes(normalizedQuery) ||
                (digits.length >= 3 && client.phone.replace(/\D/g, '').includes(digits)),
            )
            .slice(0, 4)
            .map((client) => ({ kind: 'client', ...client }));
          setResults([...bookingResults, ...clientResults]);
          setSearching(false);
        })
        .catch(() => {
          if (requestId.current === current) setSearching(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [api, normalizedQuery]);
  function openResult(result: SearchResult) {
    setQuery('');
    setResults([]);
    if (result.kind === 'booking')
      navigate(
        `${routes.administrationCreateQuote}?modifier=${encodeURIComponent(result.booking.id)}`,
      );
    else navigate(`${routes.administrationClients}?q=${encodeURIComponent(result.phone)}`);
  }
  return (
    <section className="container workspace-page admin-workspace">
      <header className="admin-reference-heading">
        <div>
          <span>{uiText['administration']}</span>
          <h1>{uiText['tableauDEBORD']}</h1>
        </div>
        <div className="admin-reference-navigation">
          <nav className="admin-tab-groups" aria-label={messages.navigationAdministration}>
            {groups.map((group) => (
              <div className="admin-tab-group" key={group.label}>
                <span>{group.label}</span>
                <div className="admin-tabs">
                  {group.sections.map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      onClick={(event) => {
                        if (to !== routes.administrationCreateQuote) return;
                        event.preventDefault();
                        navigate(to, { state: { resetQuote: crypto.randomUUID() } });
                      }}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="admin-global-actions">
            <div className="admin-global-search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearching(event.target.value.trim().length >= 2);
                  setResults([]);
                }}
                placeholder="Rechercher : nom, téléphone, n° DEM, adresse"
                aria-label="Rechercher une réservation"
              />
              {normalizedQuery.length >= 2 && (
                <div className="admin-global-results" aria-label="Résultats de recherche">
                  {results.map((result) => (
                    <button
                      key={result.kind === 'booking' ? result.booking.id : `client-${result.phone}`}
                      type="button"
                      onClick={() => openResult(result)}
                    >
                      <strong>
                        {result.kind === 'booking'
                          ? `${result.booking.reference} · ${result.booking.customerName}`
                          : `Client · ${result.name || result.phone}`}
                      </strong>
                      <small>
                        {result.kind === 'booking'
                          ? `${result.booking.date || 'sans date'} · ${result.booking.fromAddress || '—'} → ${result.booking.toAddress || '—'}`
                          : `${result.phone}${result.address ? ` · ${result.address}` : ''}`}
                      </small>
                    </button>
                  ))}
                  {!searching && !results.length && <span>Aucun résultat.</span>}
                </div>
              )}
            </div>
            <button
              className="admin-new-quote"
              type="button"
              onClick={() =>
                navigate(routes.administrationCreateQuote, {
                  state: { resetQuote: crypto.randomUUID() },
                })
              }
            >
              + Nouveau devis
            </button>
            <div className="admin-todo">
              <button
                type="button"
                className="admin-todo-toggle"
                aria-expanded={todoOpen}
                onClick={() => setTodoOpen((value) => !value)}
              >
                À traiter · {todo.length}
              </button>
              {todoOpen && (
                <div className="admin-todo-panel">
                  {todo.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTodoOpen(false);
                        if (item.bookingId)
                          navigate(
                            `${routes.administrationCreateQuote}?modifier=${encodeURIComponent(item.bookingId)}`,
                          );
                        else navigate(routes.administrationVehicleReports);
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{new Date(item.createdAt).toLocaleString('fr-FR')}</small>
                    </button>
                  ))}
                  {!todo.length && <span>Rien de nouveau.</span>}
                  {todo.length > 0 && (
                    <button
                      type="button"
                      className="admin-todo-mark"
                      onClick={() => {
                        void api.markAllNotificationsRead().then(() =>
                          setNotifications((current) =>
                            current.map((item) => ({
                              ...item,
                              readAt: item.readAt ?? new Date().toISOString(),
                            })),
                          ),
                        );
                        setTodoOpen(false);
                      }}
                    >
                      Tout marquer comme vu
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <Outlet />
    </section>
  );
}
