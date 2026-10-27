import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { BookingWorkPlan } from '../components/BookingWorkPlan';
import { messages } from '../content/fr';
import type { Booking } from '../domain/model';
import { routes } from '../routing/routes';

type Period = 'upcoming' | 'past' | 'all';

function todayDakar() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(new Date());
}

function statusFor(booking: Booking) {
  const steps = booking.workPlan ?? [];
  if (!steps.length) return 'todo';
  if (steps.some((step) => step.review.status === 'not_respected' && !step.review.reason.trim()))
    return 'unjustified';
  if (steps.some((step) => step.review.status === 'pending')) return 'todo';
  if (steps.every((step) => step.review.status === 'respected')) return 'respected';
  return 'justified';
}

export function AdminPlanFollowUp() {
  const { bookings, setBookings, loading, error } = useAdministration();
  const [period, setPeriod] = useState<Period>('upcoming');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const today = todayDakar();
  const visible = useMemo(
    () =>
      bookings
        .filter((booking) => booking.date && booking.status !== 'cancelled')
        .filter((booking) =>
          period === 'all'
            ? true
            : period === 'upcoming'
              ? booking.date! >= today
              : booking.date! < today,
        )
        .sort((a, b) => {
          const first = `${a.date}${a.timeSlot}`;
          const second = `${b.date}${b.timeSlot}`;
          return period === 'past' ? second.localeCompare(first) : first.localeCompare(second);
        }),
    [bookings, period, today],
  );
  const counts = visible.reduce(
    (result, booking) => {
      result[statusFor(booking)] += 1;
      return result;
    },
    { respected: 0, justified: 0, unjustified: 0, todo: 0 },
  );

  return (
    <div className="admin-plan-follow-up">
      <div className="section-heading">
        <div>
          <h2>Suivi des plannings prévisionnels</h2>
          <p>Comparez le déroulement des missions avec les horaires prévus.</p>
        </div>
        <div className="filter-buttons" aria-label="Période des réservations">
          {(
            [
              ['upcoming', 'À venir'],
              ['past', 'Passés'],
              ['all', 'Tout'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={period === value ? 'active' : ''}
              type="button"
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="stats-grid">
        {[
          ['Respectés', counts.respected, 'success'],
          ['Écarts justifiés', counts.justified, 'warning'],
          ['Non justifiés', counts.unjustified, 'danger'],
          ['À vérifier', counts.todo, 'muted'],
        ].map(([label, count, tone]) => (
          <div className={`panel plan-follow-up-stat ${tone}`} key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : visible.length ? (
        <div className="plan-follow-up-list">
          {visible.map((booking) => {
            const steps = booking.workPlan ?? [];
            const state = statusFor(booking);
            const date = new Date(`${booking.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
              weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Dakar',
            });
            const open = Boolean(expanded[booking.id]);
            const reviewed = steps.filter((step) => step.review.status !== 'pending').length;
            return (
              <article className="plan-follow-up-card panel" key={booking.id}>
                <button
                  type="button"
                  className="plan-follow-up-card-heading"
                  aria-expanded={open}
                  onClick={() => setExpanded((current) => ({ ...current, [booking.id]: !open }))}
                >
                  <span className="plan-follow-up-card-title">
                    <strong>{date} · {booking.timeSlot || 'Journée'}</strong>
                    <small>{booking.reference} · {booking.customerName} · {booking.vehicle.name}</small>
                  </span>
                  <span>{reviewed}/{steps.length} contrôlé(s)</span>
                  <span className={`plan-follow-up-badge ${state}`}>
                    {state === 'respected' ? 'Planning respecté' : state === 'justified' ? 'Écarts justifiés' : state === 'unjustified' ? 'Écart non justifié' : 'À vérifier'}
                  </span>
                </button>
                {open && (
                  <div className="plan-follow-up-detail">
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() => navigate(`${routes.administrationBookings}?detail=${booking.id}`)}
                    >
                      Ouvrir la réservation
                    </button>
                    <BookingWorkPlan
                      booking={booking}
                      admin
                      driverMode={false}
                      onChange={(next) =>
                        setBookings((current) =>
                          current.map((row) => (row.id === next.id ? next : row)),
                        )
                      }
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="panel empty-state">Aucun rendez-vous daté dans cette sélection.</p>
      )}
    </div>
  );
}
