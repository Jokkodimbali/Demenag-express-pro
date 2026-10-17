import { useNavigate } from 'react-router-dom';
import { useApp } from '../application/context';
import { useAdministration } from '../application/controllers/useAdministration';
import { RevenueDashboard } from '../components/AdministrationDashboard';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function AdminPlanning() {
  const { bookings, loading, error } = useAdministration();
  const { catalogue } = useApp();
  const navigate = useNavigate();
  const select = (booking: (typeof bookings)[number]) =>
    navigate(`${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}`);
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>{messages.planning}</h2>
          <p>{messages.planningDescription}</p>
        </div>
      </div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : (
        <RevenueDashboard bookings={bookings} vehicles={catalogue?.vehicles} onSelect={select} />
      )}
    </div>
  );
}
