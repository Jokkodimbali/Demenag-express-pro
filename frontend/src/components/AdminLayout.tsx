import { visibleUiText } from '../content/visible-ui-text';
import { uiText } from '../content/reference-ui-text';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { useAdminLayoutModel } from '../application/controllers/useAdminLayoutModel';

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
  const navigate = useNavigate();
  const {
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
    notificationCount,
    notificationBookings,
    todoRef,
    todo,
    openResult,
    toggleTodo,
    markAllNotificationsRead,
  } = useAdminLayoutModel();
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
                placeholder={visibleUiText.text116}
                aria-label={visibleUiText.text117}
              />
              {normalizedQuery.length >= 2 && (
                <div className="admin-global-results" aria-label={visibleUiText.text118}>
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
                  {!searching && !results.length && <span>{visibleUiText.text119}</span>}
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
              {visibleUiText.text120}
            </button>
            <div className="admin-todo" ref={todoRef}>
              <button
                type="button"
                className={`admin-todo-toggle ${notificationCount > 0 ? 'has-items' : ''}`}
                id="admin-todo-toggle"
                style={
                  {
                    '--admin-todo-bg': notificationCount > 0 ? '#f6d73c' : 'transparent',
                    color: notificationCount > 0 ? '#1e2023' : '#d5d9de',
                  } as React.CSSProperties
                }
                aria-expanded={todoOpen}
                aria-controls="admin-todo-panel"
                onClick={toggleTodo}
              >
                {visibleUiText.text121}
                {notificationCount}
              </button>
              {todoOpen && (
                <div
                  className="admin-todo-panel"
                  id="admin-todo-panel"
                  role="region"
                  aria-labelledby="admin-todo-toggle"
                >
                  {todo.map((item) => {
                    const booking = notificationBookings?.find(
                      (value) => value.id === item.bookingId,
                    );
                    const isNewBooking = item.title === 'Nouvelle réservation à confirmer';
                    const dateLabel = booking?.date
                      ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('fr-FR')
                      : isNewBooking
                        ? 'sans date'
                        : new Date(item.createdAt).toLocaleString('fr-FR');
                    return (
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
                        <small className="admin-todo-kind">
                          {isNewBooking ? 'NOUVELLE RÉSERVATION' : item.title}
                        </small>
                        <strong>
                          {isNewBooking && booking
                            ? `${booking.reference} · ${booking.customerName}`
                            : item.message}
                        </strong>
                        <span>
                          {isNewBooking
                            ? dateLabel
                            : new Date(item.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </button>
                    );
                  })}
                  {!todo.length && (
                    <span>
                      {notificationCount > 0
                        ? 'Aucune notification non lue parmi les 50 plus récentes.'
                        : 'Rien de nouveau.'}
                    </span>
                  )}
                  {todoError && (
                    <p className="admin-todo-error" role="alert">
                      {todoError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="admin-todo-mark"
                    onClick={() => void markAllNotificationsRead()}
                  >
                    {visibleUiText.text122}
                  </button>
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
