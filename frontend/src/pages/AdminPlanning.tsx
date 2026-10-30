import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { useApp } from '../application/context';
import { ReferenceCalendar } from '../components/ReferenceCalendar';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function AdminPlanning() {
  const { bookings, loading, error } = useAdministration();
  const { catalogue } = useApp();
  const navigate = useNavigate();
  const select = (booking: (typeof bookings)[number]) =>
    navigate(`${routes.administrationCreateQuote}?modifier=${encodeURIComponent(booking.id)}`);
  return (
    <div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : (
        <ReferenceCalendar
          bookings={bookings}
          vehicles={catalogue?.vehicles ?? []}
          onSelect={select}
        />
      )}
    </div>
  );
}
