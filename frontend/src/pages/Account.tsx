import { ArrowRight, RefreshCw, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../application/context';
import { BookingCard } from '../components/BookingCard';
import { PasswordForm } from '../components/PasswordForm';
import type { Booking } from '../domain/model';
export function Account() {
  const { api, user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .bookings()
      .then((data) => {
        if (active) setBookings(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, retry]);
  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MON ESPACE</p>
          <h1>BONJOUR, {user?.name.split(' ')[0].toUpperCase()}.</h1>
          <p>Vos déménagements, du premier clic au dernier carton.</p>
        </div>
        <Link className="button primary" to="/#reserver">
          Nouvelle réservation <ArrowRight size={18} />
        </Link>
      </div>
      <div className="list-heading">
        <h2>
          Mes réservations <span>{bookings.length}</span>
        </h2>
        <button
          className="button secondary small"
          disabled={loading}
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="panel loading">
          Chargement de vos réservations…
        </p>
      ) : bookings.length === 0 && !error ? (
        <div className="empty-state panel">
          <Truck size={40} />
          <h3>Un nouveau départ vous attend.</h3>
          <p>Vous n’avez pas encore de réservation.</p>
          <Link className="button primary" to="/#reserver">
            Préparer mon déménagement
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
