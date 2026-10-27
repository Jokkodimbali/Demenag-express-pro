import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../routing/routes';
import { useAdministration } from '../application/controllers/useAdministration';
import { usePagination } from '../application/usePagination';
import { BookingCard } from '../components/BookingCard';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';
import { dateLabel, money, statuses } from '../domain/format';
import type { BookingStatus } from '../domain/model';
export function Admin() {
  const {
    bookings,
    setBookings,
    loading,
    error,
    setRetry,
    filter,
    setFilter,
    dateFilter,
    setDateFilter,
    weekdayFilter,
    setWeekdayFilter,
    query,
    setQuery,
    visible,
    stats,
  } = useAdministration();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const quoteHandoff = location.state as {
    initialTollLines?: { id: string; label: string; quantity: number; unitPrice: number }[];
    quoteError?: string;
  } | null;
  const pagination = usePagination(
    visible,
    pageSizes.bookings,
    `${filter}:${query}:${dateFilter}:${weekdayFilter}`,
  );
  const selectedBookingId = params.get('detail');
  const selectedBooking = selectedBookingId
    ? (bookings.find((booking) => booking.id === selectedBookingId) ?? null)
    : null;
  return (
    <>
      {quoteHandoff?.quoteError && (
        <p className="alert error" role="alert">
          {quoteHandoff.quoteError}
        </p>
      )}
      <div className="admin-heading-actions">
          <Link className="button primary small" to={routes.administrationCreateQuote}>
            Créer un devis
          </Link>
          <button
            className="button secondary small"
            disabled={loading}
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw size={16} />
            {messages.actualiser2}
          </button>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, status, Icon }) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status as BookingStatus);
            }}
          >
            <span>
              <Icon size={19} />
              {label}
            </span>
            <strong>{loading ? '—' : bookings.filter((b) => b.status === status).length}</strong>
          </button>
        ))}
      </div>
      <>
        <div className="admin-toolbar">
          <div className="filter-buttons">
            {(
              ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const
            ).map((status) => (
              <button
                key={status}
                className={filter === status ? 'active' : ''}
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'Toutes' : statuses[status]}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label={messages.rechercherUneReservation}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={messages.nomReferenceTelephone}
            />
          </div>
          <div className="booking-date-filters">
            <div>
              <label htmlFor="booking-date-filter">{messages.filtrerParDate}</label>
              <input
                id="booking-date-filter"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="booking-weekday-filter">{messages.filtrerParJour}</label>
              <select
                id="booking-weekday-filter"
                value={weekdayFilter}
                onChange={(event) => setWeekdayFilter(event.target.value)}
              >
                <option value="all">{messages.tousLesJours}</option>
                {messages.joursSemaine.map((day, index) => (
                  <option key={day} value={String(index + 1)}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {loading ? (
          <p className="panel loading" role="status">
            {messages.chargementDesReservations}
          </p>
        ) : selectedBooking ? (
          <div className="admin-booking-detail">
            <button
              className="button secondary small"
              onClick={() => navigate(routes.administration)}
            >
              Retour aux réservations
            </button>
            <BookingCard
              admin
              editInitially={params.get('edit') === 'quote'}
              initialTollLines={quoteHandoff?.initialTollLines}
              booking={selectedBooking}
              onChange={(next) =>
                setBookings((rows) => rows.map((row) => (row.id === next.id ? next : row)))
              }
              onDeleted={() => {
                setBookings((rows) => rows.filter((row) => row.id !== selectedBooking.id));
                navigate(routes.administration, { replace: true });
              }}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state panel">
            <ClipboardList size={36} />
            <h3>{messages.aucuneReservationAAfficher}</h3>
            <p>{messages.lesNouvellesDemandesApparaitrontIci}</p>
          </div>
        ) : (
          <>
            <div className="admin-reservations-desktop" role="table" aria-label="Réservations">
              <div className="admin-reservations-row admin-reservations-header" role="row">
                <span role="columnheader">RÉF.</span>
                <span role="columnheader">CLIENT</span>
                <span role="columnheader">TRAJET</span>
                <span role="columnheader">DATE</span>
                <span role="columnheader">VÉHICULE</span>
                <span role="columnheader">MONTANT</span>
                <span role="columnheader">STATUT</span>
              </div>
              {pagination.rows.map((booking) => {
                const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
                const total = finalQuote?.price.total ?? booking.estimate.total;
                const href = `${routes.administration}?q=${encodeURIComponent(booking.reference)}&detail=${encodeURIComponent(booking.id)}`;
                return (
                  <Link className="admin-reservations-row" key={booking.id} to={href} role="row">
                    <strong role="cell">{booking.reference}</strong>
                    <span className="admin-reservations-client" role="cell">
                      <strong>{booking.customerName}</strong>
                      <small>{booking.phone}</small>
                    </span>
                    <span role="cell">
                      {booking.fromAddress} → {booking.toAddress}
                    </span>
                    <span className="admin-reservations-date" role="cell">
                      {dateLabel(booking.date)}
                      <small>{booking.timeSlot || '—'}</small>
                    </span>
                    <span role="cell">{booking.vehicle.name}</span>
                    <span role="cell">
                      {booking.status === 'completed' ? '' : '≈ '}
                      {money(total)}
                    </span>
                    <span className={`admin-reservations-status ${booking.status}`} role="cell">
                      {statuses[booking.status]}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="admin-reservations-mobile">
              {pagination.rows.map((booking) => {
                const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
                const total = finalQuote?.price.total ?? booking.estimate.total;
                const href = `${routes.administration}?q=${encodeURIComponent(booking.reference)}&detail=${encodeURIComponent(booking.id)}`;
                return (
                  <Link className="admin-reservations-mobile-card" key={booking.id} to={href}>
                    <div>
                      <strong>{booking.reference}</strong>
                      <strong>
                        {booking.status === 'completed' ? '' : '≈ '}
                        {money(total)}
                      </strong>
                    </div>
                    <span>
                      {booking.customerName} · {booking.phone}
                    </span>
                    <span>
                      {booking.fromAddress} → {booking.toAddress}
                    </span>
                    <small>
                      {dateLabel(booking.date)} · {booking.timeSlot || '—'} · {booking.vehicle.name}
                    </small>
                    <span className={`admin-reservations-status ${booking.status}`}>
                      {statuses[booking.status]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={pagination.setPage}
        />
      </>
    </>
  );
}
