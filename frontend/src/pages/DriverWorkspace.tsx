import { RefreshCw, Truck } from 'lucide-react';
import { useApp } from '../application/context';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { usePagination } from '../application/usePagination';
import { BookingCard } from '../components/BookingCard';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';

export function DriverWorkspace() {
  const { profile, bookings, loading, error, setRetry } = useDriverWorkspace();
  const { catalogue } = useApp();
  const pagination = usePagination(bookings, pageSizes.bookings);
  const vehicle = profile?.vehicleId
    ? (catalogue?.vehicles.find((item) => item.id === profile.vehicleId) ??
      bookings.find((booking) => booking.vehicle.id === profile.vehicleId)?.vehicle ??
      null)
    : null;
  return (
    <section className="container workspace-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceChauffeur}</p>
          <h1>{messages.mesMissions}</h1>
          <p>{messages.missionsDuVehiculeAffecte}</p>
        </div>
        <button
          className="button secondary small"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {messages.actualiser2}
        </button>
      </div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && vehicle ? (
        <article className="driver-vehicle-card panel">
          <img src={vehicle.image} alt={vehicle.name} />
          <div>
            <p className="eyebrow">{messages.vehiculeAffecte}</p>
            <h2>{vehicle.name}</h2>
            <p>{vehicle.volume}</p>
            <p className="muted">
              {vehicle.length} · {vehicle.width} · {vehicle.height}
            </p>
          </div>
        </article>
      ) : null}
      <div className="list-heading">
        <h2>
          {messages.mesMissions}
          <span>{bookings.length}</span>
        </h2>
      </div>
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : bookings.length ? (
        <div className="booking-list">
          {pagination.rows.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              driverMode
              onChange={() => setRetry((value) => value + 1)}
            />
          ))}
        </div>
      ) : !error ? (
        <div className="empty-state panel">
          <Truck size={40} />
          <h3>{profile?.vehicleId ? messages.aucuneMission : messages.aucunVehiculeAffecte}</h3>
        </div>
      ) : null}
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
      />
    </section>
  );
}
