import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Search,
  Settings2,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../application/context';
import { BookingCard } from '../components/BookingCard';
import { statuses } from '../domain/format';
import type { Booking, BookingStatus } from '../domain/model';
import { Fleet } from './Fleet';
import { Settings } from './Settings';
import { Users } from './Users';
export function Admin() {
  const { api } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [tab, setTab] = useState<'bookings' | 'settings' | 'users' | 'fleet'>('bookings'),
    [filter, setFilter] = useState<BookingStatus | 'all'>('all'),
    [query, setQuery] = useState('');
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
  const visible = bookings.filter(
    (b) =>
      (filter === 'all' || filter === b.status) &&
      `${b.reference} ${b.customerName} ${b.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
  const stats = [
    { label: 'Demandes reçues', status: 'pending', Icon: ClipboardList },
    { label: 'À préparer', status: 'confirmed', Icon: CalendarDays },
    { label: 'En cours', status: 'in_progress', Icon: Truck },
    { label: 'Terminées', status: 'completed', Icon: CheckCircle2 },
  ];
  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ESPACE ADMINISTRATEUR</p>
          <h1>ADMINISTRATION</h1>
          <p>Gérez les réservations et accompagnez vos clients.</p>
        </div>
        <button
          className="button secondary small"
          disabled={loading}
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, status, Icon }) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status as BookingStatus);
              setTab('bookings');
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
      <div className="tabs admin-tabs">
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>
          <ClipboardList size={17} /> Réservations
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <Settings2 size={17} /> Tarifs et paramètres
        </button>
        <button className={tab === 'fleet' ? 'active' : ''} onClick={() => setTab('fleet')}>
          Véhicules
        </button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          Comptes et accès
        </button>
      </div>
      {tab === 'fleet' ? (
        <Fleet />
      ) : tab === 'users' ? (
        <Users />
      ) : tab === 'settings' ? (
        <Settings />
      ) : (
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
                aria-label="Rechercher une réservation"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, référence, téléphone…"
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
              Chargement des réservations…
            </p>
          ) : visible.length === 0 ? (
            <div className="empty-state panel">
              <ClipboardList size={36} />
              <h3>Aucune réservation à afficher.</h3>
              <p>Les nouvelles demandes apparaîtront ici.</p>
            </div>
          ) : (
            <div className="booking-list">
              {visible.map((b) => (
                <BookingCard
                  key={b.id}
                  admin
                  booking={b}
                  onChange={(next) =>
                    setBookings((rows) => rows.map((r) => (r.id === next.id ? next : r)))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
