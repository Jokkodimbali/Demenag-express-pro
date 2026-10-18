import { ArrowRight, RefreshCw, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from '../application/controllers/useAccount';
import { usePagination } from '../application/usePagination';
import { BookingCard } from '../components/BookingCard';
import { AdminProfileForm } from '../components/AdminProfileForm';
import { Pagination } from '../components/Pagination';
import { PasswordForm } from '../components/PasswordForm';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Account() {
  const { user, bookings, setBookings, loading, error, setRetry } = useAccount();
  const pagination = usePagination(bookings, pageSizes.bookings);

  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {user?.role === 'admin' ? messages.profilAdministrateur : messages.monEspace2}
          </p>
          <h1>
            {user?.role === 'admin'
              ? messages.monProfil
              : `${messages.bonjour}${user?.name.split(' ')[0].toUpperCase()}.`}
          </h1>
          <p>
            {user?.role === 'admin'
              ? messages.informationsDuCompteAdministrateur
              : messages.vosDemenagementsDuPremierClicAuDernierCarton}
          </p>
        </div>
        {user?.role !== 'admin' && (
          <Link className="button primary" to={routes.booking}>
            {messages.nouvelleReservation}
            <ArrowRight size={18} />
          </Link>
        )}
      </div>
      {user?.role === 'admin' ? (
        <AdminProfileForm />
      ) : (
        <>
          <section className="panel profile-settings-panel account-personal-panel">
            <h2>{messages.mesInformations}</h2>
            <dl className="account-profile-details">
              <div>
                <dt>{messages.nom}</dt>
                <dd>{user?.name}</dd>
              </div>
              <div>
                <dt>{messages.telephone}</dt>
                <dd>{user?.phone}</dd>
              </div>
            </dl>
            <PasswordForm embedded />
          </section>
          <div className="list-heading">
            <h2>
              {messages.mesReservations}
              <span>{bookings.length}</span>
            </h2>
            <button
              className="button secondary small"
              disabled={loading}
              onClick={() => setRetry((n) => n + 1)}
            >
              <RefreshCw size={15} />
              {messages.actualiser2}
            </button>
          </div>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status" className="panel loading">
              {messages.chargementDeVosReservations}
            </p>
          ) : bookings.length === 0 && !error ? (
            <div className="empty-state panel">
              <Truck size={40} />
              <h3>{messages.unNouveauDepartVousAttend}</h3>
              <p>{messages.vousNAvezPasEncoreDeReservation}</p>
              <Link className="button primary" to={routes.booking}>
                {messages.preparerMonDemenagement}
              </Link>
            </div>
          ) : (
            <div className="booking-list">
              {pagination.rows.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onChange={(next) =>
                    setBookings((rows) => rows.map((r) => (r.id === next.id ? next : r)))
                  }
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
      )}
    </section>
  );
}
