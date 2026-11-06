import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { useApp } from '../application/context';
import { ReferenceCalendar } from '../components/ReferenceCalendar';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import type { Driver } from '../../../shared/contracts.js';

export function AdminPlanning() {
  const { bookings, loading, error } = useAdministration();
  const { api, catalogue } = useApp();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Driver[]>([]);
  useEffect(() => {
    let active = true;
    void api
      .drivers()
      .then((rows) => {
        if (active) setEmployees(rows);
      })
      .catch(() => {
        if (active) setEmployees([]);
      });
    return () => {
      active = false;
    };
  }, [api]);
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
        />
      )}
    </div>
  );
}
