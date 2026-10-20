import { ChevronLeft, ChevronRight, FilePenLine, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  bookingRevenueAmount,
  filterByVehicle,
  revenueFor,
  sameWeek,
} from '../application/services/revenue';
import { quoteNotificationUrl } from '../application/services/quote-notification';
import { messages } from '../content/fr';
import { dateLabel, money } from '../domain/format';
import type { Booking, Vehicle } from '../domain/model';

type DashboardProps = {
  bookings: Booking[];
  vehicles?: Vehicle[];
  onSelect: (booking: Booking) => void;
};
type Period = 'week' | 'month' | 'all';

const dateFromKey = (value: string) => new Date(value + 'T12:00:00Z');
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const weekStart = (value: string) => {
  const start = dateFromKey(value);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
};

function RevenueLegend({ provisional, definitive }: { provisional: number; definitive: number }) {
  return (
    <div className="revenue-legend" aria-label={messages.legendeChiffreDAffaires}>
      <span className="provisional">
        <i />
        {messages.provisoire} · {money(provisional)}
      </span>
      <span className="definitive">
        <i />
        {messages.definitif} · {money(definitive)}
      </span>
    </div>
  );
}

export function RevenueDashboard({ bookings, vehicles = [], onSelect }: DashboardProps) {
  const [vehicleId, setVehicleId] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const bookedVehicles = useMemo(
    () =>
      Array.from(
        new Map(bookings.map((booking) => [booking.vehicle.id, booking.vehicle])).values(),
      ),
    [bookings],
  );
  const vehicleBookings = useMemo(
    () => filterByVehicle(bookings, vehicleId),
    [bookings, vehicleId],
  );
  const scoped = useMemo(() => {
    if (period === 'all') return vehicleBookings;
    if (period === 'week')
      return vehicleBookings.filter(
        (booking) => !booking.date || sameWeek(booking.date, selectedDay),
      );
    return vehicleBookings.filter((booking) => {
      if (!booking.date) return true;
      const date = new Date(booking.date + 'T12:00:00Z');
      return (
        date.getUTCFullYear() === month.getFullYear() && date.getUTCMonth() === month.getMonth()
      );
    });
  }, [month, period, selectedDay, vehicleBookings]);
  const scopeRevenue = useMemo(() => revenueFor(scoped), [scoped]);
  const globalRevenue = useMemo(() => revenueFor(bookings), [bookings]);
  const dailyBookings = useMemo(
    () => vehicleBookings.filter((booking) => booking.date === selectedDay),
    [selectedDay, vehicleBookings],
  );
  const selectDay = (value: string) => {
    setSelectedDay(value);
    const date = new Date(value + 'T12:00:00Z');
    setMonth(new Date(date.getUTCFullYear(), date.getUTCMonth(), 1));
  };
  const changeMonth = (offset: number) => {
    setMonth((value) => {
      const next = new Date(value.getFullYear(), value.getMonth() + offset, 1);
      setSelectedDay(next.toISOString().slice(0, 10));
      return next;
    });
  };
  const changePeriod = (offset: number) => {
    if (period !== 'week') {
      changeMonth(offset);
      return;
    }
    const next = weekStart(selectedDay);
    next.setUTCDate(next.getUTCDate() + offset * 7);
    selectDay(dateKey(next));
  };

  return (
    <div className="admin-dashboard">
      <section className="panel revenue-controls">
        <div>
          <label htmlFor="revenue-vehicle">{messages.vehicule}</label>
          <select
            id="revenue-vehicle"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            <option value="">{messages.tousLesVehicules}</option>
            {(vehicles.length ? vehicles : bookedVehicles).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-buttons" aria-label={messages.periodeAnalyse}>
          {(['week', 'month', 'all'] as const).map((value) => (
            <button
              key={value}
              className={period === value ? 'active' : ''}
              onClick={() => setPeriod(value)}
            >
              {messages.periodes[value]}
            </button>
          ))}
        </div>
        <div className="revenue-date-filter">
          <label htmlFor="revenue-date">{messages.dateAnalyse}</label>
          <input
            id="revenue-date"
            type="date"
            value={selectedDay}
            onChange={(event) => selectDay(event.target.value)}
          />
          <button
            className="button secondary small"
            onClick={() => selectDay(new Date().toISOString().slice(0, 10))}
          >
            {messages.aujourdhui}
          </button>
        </div>
      </section>
      <div className="stats-grid revenue-grid">
        <div className="revenue-card provisional">
          <span>{messages.chiffreDAffairesProvisoire}</span>
          <strong>{money(scopeRevenue.provisional)}</strong>
        </div>
        <div className="revenue-card definitive">
          <span>{messages.chiffreDAffairesDefinitif}</span>
          <strong>{money(scopeRevenue.definitive)}</strong>
        </div>
        <div className="revenue-card total">
          <span>{messages.chiffreDAffairesGlobal}</span>
          <strong>{money(globalRevenue.total)}</strong>
        </div>
        <div>
          <span>{messages.reservationsPlanifiees}</span>
          <strong>
            {
              scoped.filter((booking) => !['completed', 'cancelled'].includes(booking.status))
                .length
            }
          </strong>
        </div>
      </div>
      <RevenueLegend provisional={scopeRevenue.provisional} definitive={scopeRevenue.definitive} />
      <p className="muted revenue-definition">
        Les demandes en attente sont provisoires. Les réservations confirmées, en cours ou terminées
        sont comptées en définitif ; le montant retenu est le devis final, sinon le devis
        provisoire, sinon l’estimation. Le global additionne chaque réservation active une seule
        fois et exclut les annulations.
      </p>
      <BookingCalendar
        bookings={scoped}
        onSelect={onSelect}
        period={period}
        month={month}
        changePeriod={changePeriod}
        selectedDay={selectedDay}
        onSelectDay={selectDay}
      />
      <DailyBookings bookings={dailyBookings} selectedDay={selectedDay} onSelect={onSelect} />
      <DailyVehicleRevenue bookings={dailyBookings} selectedDay={selectedDay} />
    </div>
  );
}

function DailyBookings({
  bookings,
  selectedDay,
  onSelect,
}: {
  bookings: Booking[];
  selectedDay: string;
  onSelect: (booking: Booking) => void;
}) {
  return (
    <section className="panel daily-bookings" aria-live="polite">
      <div className="section-heading">
        <div>
          <h2>{messages.reservationsDuJour(dateLabel(selectedDay))}</h2>
          <p>{bookings.length} réservation(s)</p>
        </div>
      </div>
      {bookings.length ? (
        <div className="daily-booking-list">
          {bookings.map((booking) => (
            <button
              className={'daily-booking-row ' + booking.status}
              key={booking.id}
              onClick={() => onSelect(booking)}
            >
              <span>
                <strong>{booking.customerName}</strong>
                <small>{booking.timeSlot || 'Créneau à convenir'}</small>
              </span>
              <span>
                <small>{booking.vehicle.name}</small>
                <small>{booking.reference}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">{messages.aucuneReservationCeJour}</p>
      )}
    </section>
  );
}

function DailyVehicleRevenue({
  bookings,
  selectedDay,
}: {
  bookings: Booking[];
  selectedDay: string;
}) {
  const rows = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const booking of bookings)
      grouped.set(booking.vehicle.id, [...(grouped.get(booking.vehicle.id) ?? []), booking]);
    return [...grouped.values()].map((vehicleBookings) => ({
      vehicle: vehicleBookings[0].vehicle,
      revenue: revenueFor(vehicleBookings),
      bookings: vehicleBookings.length,
    }));
  }, [bookings]);
  return (
    <section className="panel daily-revenue">
      <div className="section-heading">
        <div>
          <h2>{messages.chiffreDAffairesParVehicule}</h2>
          <p>{dateLabel(selectedDay)}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="revenue-table" role="table">
          <div role="row" className="revenue-table-header">
            <span>{messages.vehicule}</span>
            <span>{messages.provisoire}</span>
            <span>{messages.definitif}</span>
            <span>{messages.reservations}</span>
          </div>
          {rows.map((row) => (
            <div role="row" key={row.vehicle.id}>
              <strong>{row.vehicle.name}</strong>
              <span className="provisional">{money(row.revenue.provisional)}</span>
              <span className="definitive">{money(row.revenue.definitive)}</span>
              <span>{row.bookings}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{messages.aucunChiffreDAffairesPourCetteJournee}</p>
      )}
    </section>
  );
}

type CalendarProps = DashboardProps & {
  period: Period;
  month: Date;
  changePeriod: (offset: number) => void;
  selectedDay: string;
  onSelectDay: (value: string) => void;
};
function BookingCalendar({
  bookings,
  onSelect,
  period,
  month,
  changePeriod,
  selectedDay,
  onSelectDay,
}: CalendarProps) {
  const days = useMemo(() => {
    if (period === 'week') {
      const start = weekStart(selectedDay);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + index);
        return day;
      });
    }
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from(
      { length: 42 },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1),
    );
  }, [month, period, selectedDay]);
  const byDay = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const booking of bookings)
      if (booking.date) grouped.set(booking.date, [...(grouped.get(booking.date) ?? []), booking]);
    return grouped;
  }, [bookings]);
  return (
    <section className="panel booking-calendar">
      <div className="calendar-heading">
        <button
          className="icon-button"
          aria-label={period === 'week' ? messages.semainePrecedente : messages.moisPrecedent}
          onClick={() => changePeriod(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <h2>
          {period === 'week'
            ? messages.semaineDu(dateLabel(dateKey(days[0])), dateLabel(dateKey(days[6])))
            : month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          className="icon-button"
          aria-label={period === 'week' ? messages.semaineSuivante : messages.moisSuivant}
          onClick={() => changePeriod(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-weekdays">
        {messages.joursCalendrier.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayBookings = byDay.get(key) ?? [];
          const revenue = revenueFor(dayBookings);
          return (
            <div
              className={
                (period === 'week' || day.getMonth() === month.getMonth()
                  ? 'calendar-day'
                  : 'calendar-day muted') + (selectedDay === key ? ' selected' : '')
              }
              key={key}
            >
              <button
                className="calendar-date"
                onClick={() => onSelectDay(key)}
                aria-label={dateLabel(key)}
                aria-pressed={selectedDay === key}
              >
                {day.getDate()}
              </button>
              {dayBookings.length ? (
                <div className="calendar-revenue">
                  <span className="provisional">
                    {messages.chiffreAffairesProvisoireAbrege} {money(revenue.provisional)}
                  </span>
                  <span className="definitive">
                    {messages.chiffreAffairesDefinitifAbrege} {money(revenue.definitive)}
                  </span>
                </div>
              ) : null}
              {dayBookings.map((booking) => (
                <button
                  key={booking.id}
                  className={'calendar-booking ' + booking.status}
                  onClick={() => onSelect(booking)}
                  title={`${booking.customerName} · ${booking.timeSlot || 'Créneau à convenir'}`}
                >
                  <strong>{booking.customerName}</strong>
                  <span>{booking.timeSlot || 'Créneau à convenir'}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {bookings.some((booking) => !booking.date)
        ? (() => {
            const undatedBookings = bookings.filter((booking) => !booking.date);
            const undatedRevenue = revenueFor(undatedBookings);
            return (
              <section
                className="calendar-undated"
                aria-label="Réservations sans date de rendez-vous"
              >
                <h3>
                  Sans date de rendez-vous <span>{undatedBookings.length}</span>
                </h3>
                <div className="calendar-undated-totals">
                  <span className="provisional">
                    Provisoire : {money(undatedRevenue.provisional)}
                  </span>
                  <span className="definitive">Définitif : {money(undatedRevenue.definitive)}</span>
                  <strong>Total : {money(undatedRevenue.total)}</strong>
                </div>
                <div>
                  {undatedBookings.map((booking) => (
                    <button
                      key={booking.id}
                      className={'calendar-booking ' + booking.status}
                      onClick={() => onSelect(booking)}
                    >
                      <span>
                        {booking.customerName} · {booking.timeSlot || 'Créneau à convenir'}
                      </span>
                      <strong>{money(bookingRevenueAmount(booking))}</strong>
                    </button>
                  ))}
                </div>
              </section>
            );
          })()
        : null}
    </section>
  );
}

export function DefinitiveQuotes({
  bookings,
  onSelect,
  onEdit,
}: DashboardProps & { onEdit: (booking: Booking) => void }) {
  const rows = bookings.filter(
    (booking) =>
      booking.status === 'in_progress' || booking.quotes.some((quote) => quote.kind === 'final'),
  );
  return (
    <div className="booking-list">
      {rows.length ? (
        rows.map((booking) => {
          const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
          const lastQuote = booking.quotes.at(-1);
          return (
            <article className="finance-row panel" key={booking.id}>
              <button className="finance-row-summary" onClick={() => onSelect(booking)}>
                <span>
                  <strong>{booking.reference}</strong> · {booking.customerName}
                </span>
                <small>{booking.vehicle.name}</small>
                <strong>
                  {money(
                    finalQuote?.price.total ?? lastQuote?.price.total ?? booking.estimate.total,
                  )}
                </strong>
              </button>
              <div className="finance-row-actions">
                {booking.status === 'in_progress' && (
                  <button className="button secondary small" onClick={() => onEdit(booking)}>
                    <FilePenLine size={16} />
                    {lastQuote ? messages.modifierLeDevis : messages.creerUnDevis}
                  </button>
                )}
                {finalQuote && (
                  <a
                    className="button primary small"
                    target="_blank"
                    rel="noreferrer"
                    href={quoteNotificationUrl(booking, finalQuote)}
                  >
                    <MessageCircle size={16} />
                    {messages.envoyerLeDevisDefinitif}
                  </a>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="empty-state panel">{messages.aucunDevisDefinitifAProduire}</p>
      )}
    </div>
  );
}
