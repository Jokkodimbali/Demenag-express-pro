import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { usePagination } from '../application/usePagination';
import { BookingCard } from '../components/BookingCard';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';
import { statuses } from '../domain/format';
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
    query,
    setQuery,
    visible,
    stats,
  } = useAdministration();
  const [params] = useSearchParams();
  const pagination = usePagination(visible, pageSizes.bookings, `${filter}:${query}`);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{messages.reservations}</h2>
          <p>{messages.suivezEtTraitezLesDemandes}</p>
        </div>
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
        ) : visible.length === 0 ? (
          <div className="empty-state panel">
            <ClipboardList size={36} />
            <h3>{messages.aucuneReservationAAfficher}</h3>
            <p>{messages.lesNouvellesDemandesApparaitrontIci}</p>
          </div>
        ) : (
          <div className="booking-list">
            {pagination.rows.map((b) => (
              <BookingCard
                key={b.id}
                admin
                editInitially={params.get('detail') === b.id && params.get('edit') === 'quote'}
                booking={b}
                onChange={(next) =>
                  setBookings((rows) => rows.map((r) => (r.id === next.id ? next : r)))
                }
                onDeleted={() => setBookings((rows) => rows.filter((row) => row.id !== b.id))}
              />
            ))}
          </div>
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
