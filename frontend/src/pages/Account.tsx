import { ArrowRight, RefreshCw, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from '../application/controllers/useAccount';
import { BookingCard } from '../components/BookingCard';
import { PasswordForm } from '../components/PasswordForm';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Account() {
  const { user, bookings, setBookings, loading, error, setRetry } = useAccount();

  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.monEspace2}</p>
          <h1>
            {messages.bonjour}
            {user?.name.split(' ')[0].toUpperCase()}.
          </h1>
          <p>{messages.vosDemenagementsDuPremierClicAuDernierCarton}</p>
        </div>
        <Link className="button primary" to={routes.booking}>
          {messages.nouvelleReservation}
          <ArrowRight size={18} />
        </Link>
      </div>
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
          {bookings.map((b) => (
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
      <PasswordForm />
    </section>
  );
}
