import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../../application/controllers/useAdministration';
import { useApp } from '../../../shared/application/context';
import { ReferenceCalendar } from '../components/ReferenceCalendar';
import { messages } from '../../../shared/content/fr';
import { routes } from '../../../app/routing/routes';
import { useCalendarEmployees } from '../application/controllers/useCalendarEmployees';

export function AdminPlanning() {
  const { bookings, loading, error } = useAdministration();
  const { catalogue, exportPlanningWeek } = useApp();
  const navigate = useNavigate();
  const employees = useCalendarEmployees();
  const select = (booking: (typeof bookings)[number]) =>
    navigate(`${routes.administrationCreateQuote}?modifier=${encodeURIComponent(booking.id)}`);
  const createAtDay = (date: string, time: string) =>
    navigate(routes.administrationCreateQuote, { state: { calendarAppointment: { date, time } } });
  const openTeam = (booking: (typeof bookings)[number]) =>
    navigate(
      `${routes.administrationFleet}?date=${encodeURIComponent(booking.date ?? '')}&booking=${encodeURIComponent(booking.id)}`,
    );
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
          employees={employees}
          onSelect={select}
          onCreateAtDay={createAtDay}
          onOpenTeam={openTeam}
          onExportWeek={exportPlanningWeek}
        />
      )}
    </div>
  );
}
