import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { RevenueDashboard } from '../components/AdministrationDashboard';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function AdminPlanning() {
  const { bookings, loading, error } = useAdministration();
  const navigate = useNavigate();
  const select = (reference: string) => navigate(`${routes.administrationBookings}?q=${reference}`);
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
        <RevenueDashboard bookings={bookings} onSelect={(booking) => select(booking.reference)} />
      )}
    </div>
  );
}
