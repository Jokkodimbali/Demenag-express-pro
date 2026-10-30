import { uiText } from '../content/reference-ui-text';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { money } from '../domain/format';
import type { Booking } from '../domain/model';
import type { Vehicle } from '../../../shared/contracts.js';

type View = 'day' | 'week' | 'month';
type CalendarProps = {
  bookings: Booking[];
  vehicles: Vehicle[];
  onSelect: (booking: Booking) => void;
};
type CalendarEvent = {
  booking: Booking;
  range: ReturnType<typeof timeRange>;
  lane?: number;
  laneCount?: number;
  vehicleLane?: number;
  vehicleCount?: number;
  continuation?: boolean;
};

const weekLabels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const shortWeekLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dakarToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(new Date());
}

function atNoon(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

function addDays(day: string, amount: number) {
  const date = atNoon(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return iso(date);
}

function startOfWeek(day: string) {
  const date = atNoon(day);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return iso(date);
}

function dateLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return atNoon(day).toLocaleDateString('fr-FR', { ...options, timeZone: 'Africa/Dakar' });
}

function amount(booking: Booking) {
  const final = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const provisional = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  if (booking.status === 'completed') {
    return {
      final: final?.price.total ?? provisional?.price.total ?? booking.estimate.total,
      provisional: null,
    };
  }
  return {
    final: null,
    provisional: final?.price.total ?? provisional?.price.total ?? booking.estimate.total,
  };
}

function timeRange(booking: Booking) {
  const plan = booking.workPlan ?? [];
  const snapshot = booking.inventorySnapshot;
  const normalizedSlot = booking.timeSlot
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
  const standardSlot = normalizedSlot.includes('matin')
    ? [480, 720]
    : normalizedSlot.includes('apres-midi') || normalizedSlot.includes('apres midi')
      ? [780, 1020]
      : [480, 1020];
  const standardStart = `${String(Math.floor(standardSlot[0] / 60)).padStart(2, '0')}:${String(standardSlot[0] % 60).padStart(2, '0')}`;
  const first =
    snapshot?.startTime ||
    plan[0]?.time ||
    booking.timeSlot.match(/\b\d{1,2}:\d{2}\b/)?.[0] ||
    standardStart;
  const [hoursPart, minutesPart] = first.split(':').map(Number);
  const start = Math.max(0, Math.min(1439, (hoursPart ?? 8) * 60 + (minutesPart ?? 0)));
  const endParts = snapshot?.endTime?.split(':').map(Number);
  const snapshotEnd = endParts?.length === 2 ? (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0) : 0;
  const slot = booking.timeSlot.match(/(\d{1,2}:\d{2})\s*(?:–|-|à)\s*(\d{1,2}:\d{2})/i);
  const slotEnd = slot ? Number(slot[2].slice(0, 2)) * 60 + Number(slot[2].slice(3, 5)) : 0;
  const duration = snapshot?.totalMinutes || plan.reduce((sum, step) => sum + step.minutes, 0);
  const normalizedSnapshotEnd =
    snapshotEnd && snapshotEnd <= start ? snapshotEnd + 1440 : snapshotEnd;
  const normalizedSlotEnd = slotEnd && slotEnd <= start ? slotEnd + 1440 : slotEnd;
  const end =
    normalizedSnapshotEnd > start
      ? normalizedSnapshotEnd
      : normalizedSlotEnd > start
        ? normalizedSlotEnd
        : duration
          ? start + duration
          : start + (standardSlot[1] - standardSlot[0]);
  const label = (minute: number) =>
    `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return {
    start,
    end,
    duration: end - start,
    label: `${label(start)}–${label(end)}${end > 1440 ? ' · suite le lendemain' : ''}`,
    estimated: !snapshot && !plan.length,
  };
}

function quoteKind(booking: Booking) {
  return booking.status === 'completed' ? 'final' : 'provisional';
}

function statusLabel(booking: Booking) {
  return booking.status === 'completed' ? 'Final' : 'Provisoire';
}

function formatDuration(minutes: number) {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours
    ? `${hours} h${remainder ? ` ${String(remainder).padStart(2, '0')}` : ''}`
    : `${remainder} min`;
}

function vehicleTag(name: string) {
  return name.match(/sprinter|trafic|master/i)?.[0] ?? name;
}

function periodTitle(view: View, day: string, month: Date) {
  if (view === 'day')
    return dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./u, (c) =>
      c.toUpperCase(),
    );
  if (view === 'week') {
    const start = startOfWeek(day);
    return `${dateLabel(start, { day: 'numeric', month: 'long' })} – ${dateLabel(addDays(start, 6), { day: 'numeric', month: 'long' })}`;
  }
  return month
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })
    .replace(/^./u, (character) => character.toUpperCase());
}

export function ReferenceCalendar({ bookings, vehicles, onSelect }: CalendarProps) {
  const [view, setView] = useState<View>('month');
  const [monthCursor, setMonthCursor] = useState(dakarToday);
  const [gridAnchor, setGridAnchor] = useState<string | null>(null);
  const [verticalZoom, setVerticalZoom] = useState(2);
  const [horizontalZoom, setHorizontalZoom] = useState(2);
  const [selectedDay, setSelectedDay] = useState(dakarToday);
  const today = dakarToday();
  const timelineAnchor = gridAnchor ?? selectedDay ?? today;
  const monthDate = atNoon(monthCursor);
  const month = new Date(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1);
  const days = useMemo(() => {
    if (view === 'day') return [timelineAnchor];
    if (view === 'week') {
      const start = startOfWeek(timelineAnchor);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const first = new Date(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count =
      Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) *
      7;
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(first);
      day.setDate(index - offset + 1);
      return iso(day);
    });
  }, [monthDate, timelineAnchor, view]);
  const periodBookings = bookings.filter((booking) => {
    if (!booking.date || booking.status === 'cancelled') return false;
    if (view === 'month') return booking.date.slice(0, 7) === monthCursor.slice(0, 7);
    return days.includes(booking.date);
  });
  const countBookings = bookings.filter((booking) => {
    if (!booking.date) return false;
    if (view === 'month') return booking.date.slice(0, 7) === monthCursor.slice(0, 7);
    return days.includes(booking.date);
  });
  const visibleBookings = periodBookings;
  const undated = bookings.filter(
    (booking) =>
      !booking.date &&
      booking.status !== 'cancelled' &&
      booking.createdAt.slice(0, 7) === monthCursor.slice(0, 7),
  );
  const totals = visibleBookings.reduce(
    (result, booking) => {
      const quote = amount(booking);
      result.provisional += quote.provisional ?? 0;
      result.final += quote.final ?? 0;
      return result;
    },
    { provisional: 0, final: 0 },
  );
  const selected = bookings.filter((booking) => booking.date === selectedDay);
  const timedBookings = bookings
    .filter(
      (booking) =>
        booking.status !== 'cancelled' &&
        booking.date &&
        (days.includes(booking.date) ||
          (days.includes(addDays(booking.date, 1)) && timeRange(booking).end > 1440)),
    )
    .map((booking) => ({ booking, range: timeRange(booking) }));
  const hasOvernightContinuation = timedBookings.some(({ booking, range }) =>
    Boolean(booking.date && days.includes(addDays(booking.date, 1)) && range.end > 1440),
  );
  const gridStart =
    view === 'month'
      ? 6
      : Math.min(
          hasOvernightContinuation ? 0 : 6,
          Math.floor(Math.min(...timedBookings.map(({ range }) => range.start), 360) / 60),
        );
  const gridEnd =
    view === 'month'
      ? 22
      : Math.min(
          24,
          Math.max(
            22,
            Math.ceil(Math.max(...timedBookings.map(({ range }) => range.end), 1320) / 60),
          ),
        );
  const dayHeight = gridEnd - gridStart;
  const rowHeight = [28, 40, 56, 80, 112, 160][verticalZoom] ?? 56;
  const colWidth =
    (view === 'day' ? [160, 200, 240, 360, 520, 760] : [70, 95, 120, 170, 240, 340])[
      horizontalZoom
    ] ?? 120;
  const now = new Date();
  const todayMinutes = Number(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Dakar',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(now)
      .replace(':', ''),
  );
  const nowPosition = (todayMinutes / 100 - gridStart) * rowHeight;

  function move(amount: number) {
    if (view === 'month') {
      const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
      const nextDay = iso(next);
      setMonthCursor(nextDay);
      return;
    }
    const next = addDays(timelineAnchor, amount * (view === 'week' ? 7 : 1));
    setGridAnchor(next);
    setSelectedDay(next);
    setMonthCursor(next);
  }

  function setCurrentDay(day: string) {
    setGridAnchor(day);
    setSelectedDay(day);
    setMonthCursor(day);
  }

  function getDayEvents(day: string) {
    const events: CalendarEvent[] = bookings
      .filter(
        (booking) =>
          booking.status !== 'cancelled' &&
          booking.date &&
          (booking.date === day ||
            (booking.date === addDays(day, -1) && timeRange(booking).end > 1440)),
      )
      .map((booking) => {
        const range = timeRange(booking);
        const continuation = booking.date !== day;
        return {
          booking,
          range: continuation
            ? {
                ...range,
                start: 0,
                end: range.end - 1440,
                duration: range.end - 1440,
                label: `${range.label} · suite de la veille`,
              }
            : range,
          continuation,
        };
      })
      .sort((left, right) => left.range.start - right.range.start);
    const vehicleGroups = new Map<string, typeof events>();
    events.forEach((event) => {
      const group = vehicleGroups.get(event.booking.vehicle.id) ?? [];
      group.push(event);
      vehicleGroups.set(event.booking.vehicle.id, group);
    });
    const orderedVehicles = [
      ...vehicles.map((vehicle) => vehicle.id),
      ...vehicleGroups.keys(),
    ].filter((id, index, all) => all.indexOf(id) === index);
    orderedVehicles.forEach((id) => {
      if (!vehicleGroups.has(id)) vehicleGroups.set(id, []);
    });
    const vehicleCount = orderedVehicles.length;
    return orderedVehicles.flatMap((vehicleId, vehicleLane) => {
      const group = vehicleGroups.get(vehicleId) ?? [];
      const laneEnds: number[] = [];
      group.forEach((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.range.start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = event.range.end;
        event.lane = lane;
        event.laneCount = laneEnds.length;
        event.vehicleLane = vehicleLane;
        event.vehicleCount = vehicleCount;
      });
      group.forEach((event) => {
        const item = event as CalendarEvent & { lane: number; laneCount: number };
        const overlapping = group.filter(
          (other) => other.range.start < item.range.end && other.range.end > item.range.start,
        );
        item.laneCount = Math.max(1, ...overlapping.map((other) => other.lane! + 1));
      });
      return group;
    });
  }

  return (
    <div className="reference-calendar-page">
      <section className="reference-calendar-panel">
        <header className="reference-calendar-heading">
          <button type="button" aria-label={uiText['periodePrecedente']} onClick={() => move(-1)}>
            <ChevronLeft size={19} />
          </button>
          <strong>{periodTitle(view, timelineAnchor, month)}</strong>
          <button type="button" aria-label={uiText['periodeSuivante']} onClick={() => move(1)}>
            <ChevronRight size={19} />
          </button>
          <button
            type="button"
            className="reference-calendar-today"
            onClick={() => setCurrentDay(today)}
          >
            {uiText['aujourdHui']}
          </button>
        </header>
        <div className="reference-calendar-toolbar">
          <div className="reference-calendar-views">
            {(['day', 'week', 'month'] as const).map((value) => (
              <button
                type="button"
                className={view === value ? 'active' : ''}
                key={value}
                onClick={() => setView(value)}
              >
                {{ day: 'Jour', week: 'Semaine', month: 'Mois' }[value]}
              </button>
            ))}
          </div>
          {view !== 'month' && (
            <div className="reference-calendar-zoom">
              <label>
                {uiText['heures']}{' '}
                <button
                  type="button"
                  onClick={() => setVerticalZoom((value) => Math.max(0, value - 1))}
                >
                  −
                </button>
                <span>{Math.round((rowHeight / 56) * 100)} %</span>
                <button
                  type="button"
                  onClick={() => setVerticalZoom((value) => Math.min(5, value + 1))}
                >
                  +
                </button>
              </label>
              <label>
                {uiText['jours']}{' '}
                <button
                  type="button"
                  onClick={() => setHorizontalZoom((value) => Math.max(0, value - 1))}
                >
                  −
                </button>
                <span>{Math.round((colWidth / (view === 'day' ? 240 : 120)) * 100)} %</span>
                <button
                  type="button"
                  onClick={() => setHorizontalZoom((value) => Math.min(5, value + 1))}
                >
                  +
                </button>
              </label>
            </div>
          )}
        </div>
        <div className="reference-calendar-legend">
          <span>
            <i className="provisional" /> {uiText['provisoire3']}
          </span>
          <span>
            <i className="final" /> {uiText['final2']}
          </span>
          <strong>
            {countBookings.length} {uiText['rdv']}{' '}
            {view === 'month' ? 'ce mois' : view === 'week' ? 'cette semaine' : 'ce jour'}
          </strong>
        </div>
        <div className="reference-calendar-totals">
          <div>
            <span>
              {uiText['provisoire4']}
              {{ month: 'MOIS', week: 'SEMAINE', day: 'JOUR' }[view]}
            </span>
            <strong>{money(totals.provisional)}</strong>
          </div>
          <div>
            <span>
              {uiText['final3']}
              {{ month: 'MOIS', week: 'SEMAINE', day: 'JOUR' }[view]}
            </span>
            <strong>{money(totals.final)}</strong>
          </div>
          <div>
            <span>
              {uiText['total3']}
              {{ month: 'MOIS', week: 'SEMAINE', day: 'JOUR' }[view]}
            </span>
            <strong>{money(totals.provisional + totals.final)}</strong>
          </div>
        </div>
        {undated.length > 0 && (
          <section className="reference-calendar-undated">
            <strong>
              {uiText['sansDATE']}
              {dateLabel(monthCursor, { month: 'long' }).toLocaleUpperCase('fr-FR')} ·{' '}
              {undated.length}
            </strong>
            <div>
              {undated.map((booking) => (
                <button type="button" key={booking.id} onClick={() => onSelect(booking)}>
                  <b>
                    {booking.reference.replace(/^DEM-/u, '')} · {booking.customerName}
                  </b>
                  <span>
                    {booking.fromAddress || '—'} → {booking.toAddress || '—'}
                  </span>
                  <strong>
                    {statusLabel(booking)} ·{' '}
                    {money(amount(booking).final ?? amount(booking).provisional ?? 0)}
                  </strong>
                </button>
              ))}
            </div>
          </section>
        )}
        {view === 'month' ? (
          <div className="reference-month-view">
            {weekLabels.map((label, index) => (
              <strong className="reference-month-weekday" key={`${label}-${index}`}>
                <span>{label}</span>
                <small>{shortWeekLabels[index]}</small>
              </strong>
            ))}
            {days.map((day) => {
              const dayBookings = bookings.filter((booking) => booking.date === day);
              const sameMonth = day.slice(0, 7) === monthCursor.slice(0, 7);
              const dayTotals = dayBookings
                .filter((booking) => booking.status !== 'cancelled')
                .reduce(
                  (sum, booking) => {
                    const value = amount(booking);
                    sum.provisional += value.provisional ?? 0;
                    sum.final += value.final ?? 0;
                    return sum;
                  },
                  { provisional: 0, final: 0 },
                );
              return (
                <div
                  key={day}
                  className={`reference-month-day ${sameMonth ? '' : 'outside'} ${day === selectedDay ? 'selected' : ''} ${day === today ? 'today' : ''}`}
                  onClick={() => setCurrentDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setCurrentDay(day);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={dateLabel(day, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                >
                  <span
                    className="reference-month-date"
                    aria-label={dateLabel(day, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  >
                    {Number(day.slice(-2))}
                  </span>
                  {dayBookings.length > 0 && (
                    <small className="reference-month-mobile-count">{dayBookings.length}</small>
                  )}
                  {dayBookings.length > 0 && (
                    <span className="reference-month-amounts">
                      <i>
                        {uiText['prov']}
                        {money(dayTotals.provisional)}
                      </i>
                      <i>
                        {uiText['final4']}
                        {money(dayTotals.final)}
                      </i>
                    </span>
                  )}
                  <span className="reference-month-chips">
                    {dayBookings.slice(0, 3).map((booking) => (
                      <button
                        type="button"
                        className={`reference-month-booking ${quoteKind(booking)}`}
                        key={booking.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(booking);
                        }}
                      >
                        {booking.vehicle.image && <img src={booking.vehicle.image} alt="" />}
                        <span>
                          {booking.customerName.split(' ')[0]} ·{' '}
                          {booking.reference.replace(/^DEM-/u, '')}
                        </span>
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="reference-time-grid-scroll" style={{ maxHeight: '72vh' }}>
            <div
              className="reference-time-grid"
              style={{
                gridTemplateColumns: `52px repeat(${days.length}, minmax(${colWidth}px, 1fr))`,
                minWidth: 'fit-content',
              }}
            >
              <div className="reference-time-grid-corner" />
              {days.map((day) => {
                const dayBookings = bookings.filter(
                  (booking) => booking.date === day && booking.status !== 'cancelled',
                );
                const dayTotals = dayBookings.reduce(
                  (sum, booking) => {
                    const value = amount(booking);
                    sum.provisional += value.provisional ?? 0;
                    sum.final += value.final ?? 0;
                    return sum;
                  },
                  { provisional: 0, final: 0 },
                );
                return (
                  <button
                    type="button"
                    className={`reference-time-grid-day ${day === today ? 'today' : ''} ${day === selectedDay ? 'selected' : ''}`}
                    key={day}
                    onClick={() => {
                      setCurrentDay(day);
                      setView('day');
                    }}
                  >
                    <span>{weekLabels[(atNoon(day).getUTCDay() + 6) % 7]}</span>
                    <strong>{Number(day.slice(-2))}</strong>
                    {dayBookings.length > 0 && (
                      <>
                        <i>
                          {uiText['prov']}
                          {money(dayTotals.provisional)}
                        </i>
                        <i>
                          {uiText['final4']}
                          {money(dayTotals.final)}
                        </i>
                      </>
                    )}
                    <span className="reference-time-grid-vehicles">
                      {vehicles.map((vehicle) => (
                        <span key={vehicle.id}>
                          {vehicle.image && <img src={vehicle.image} alt="" />}
                          <small>{vehicleTag(vehicle.name)}</small>
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
              <div
                className="reference-time-grid-hours"
                style={{ height: `${dayHeight * rowHeight}px` }}
              >
                {Array.from({ length: dayHeight + 1 }, (_, index) => gridStart + index).map(
                  (hour) => (
                    <span key={hour} style={{ top: `${(hour - gridStart) * rowHeight}px` }}>
                      {String(hour).padStart(2, '0')}
                      {uiText['00']}
                    </span>
                  ),
                )}
              </div>
              {days.map((day) => (
                <div
                  className={`reference-time-grid-column ${day === today ? 'today' : ''}`}
                  key={day}
                  style={{ height: `${dayHeight * rowHeight}px` }}
                  onClick={() => setSelectedDay(day)}
                >
                  {Array.from({ length: dayHeight + 1 }, (_, index) => gridStart + index).map(
                    (hour) => (
                      <i key={hour} style={{ top: `${(hour - gridStart) * rowHeight}px` }} />
                    ),
                  )}
                  {day === today && nowPosition >= 0 && nowPosition <= dayHeight * rowHeight && (
                    <b className="reference-time-now" style={{ top: `${nowPosition}px` }} />
                  )}
                  {getDayEvents(day).map(
                    ({
                      booking,
                      range,
                      lane = 0,
                      laneCount = 1,
                      vehicleLane = 0,
                      vehicleCount = 1,
                    }) => {
                      const totalsForBooking = amount(booking);
                      const clippedStart = Math.max(range.start, gridStart * 60);
                      const clippedEnd = Math.min(range.end, gridEnd * 60);
                      const top = ((clippedStart - gridStart * 60) / 60) * rowHeight;
                      const height = Math.max(24, ((clippedEnd - clippedStart) / 60) * rowHeight);
                      const laneWidth = 100 / vehicleCount / laneCount;
                      const left =
                        (vehicleLane / vehicleCount + lane / vehicleCount / laneCount) * 100;
                      const quote = quoteKind(booking);
                      return (
                        <button
                          type="button"
                          key={`${booking.id}-${vehicleLane}-${lane}`}
                          className={`reference-time-event ${quote} ${range.estimated ? 'estimated' : ''}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${left}% + 2px)`,
                            width: `calc(${laneWidth}% - 4px)`,
                            backgroundColor: quote === 'final' ? '#0e3a22' : '#3a3420',
                            borderLeftColor: range.estimated ? 'rgba(255,255,255,.35)' : '#fff',
                          }}
                          title={`${booking.reference} · ${booking.customerName} · ${range.label}${range.estimated ? ' (créneau, durée estimée)' : ' (durée calculée)'}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(booking);
                          }}
                        >
                          {booking.vehicle.image && <img src={booking.vehicle.image} alt="" />}
                          <span>{range.label}</span>
                          <strong>
                            {booking.reference.replace(/^DEM-/u, '')} ·{' '}
                            {booking.customerName.split(' ')[0]}
                          </strong>
                          <span>
                            {quote === 'final' ? 'Final · ' : 'Provisoire · '}
                            {money(totalsForBooking.final ?? totalsForBooking.provisional ?? 0)}
                          </span>
                          {height >= 64 && (
                            <>
                              <small>
                                {vehicleTag(booking.vehicle.name)} ·{' '}
                                {formatDuration(range.duration)}
                                {range.estimated ? ' (estimé)' : ''}
                              </small>
                              <small>
                                {booking.fromAddress} → {booking.toAddress}
                              </small>
                            </>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="reference-calendar-selected">
        <strong>
          {dateLabel(selectedDay, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).replace(/^./u, (c) => c.toUpperCase())}
        </strong>
        {selected.length === 0 ? (
          <span>{uiText['aucunRendezVousCeJour']}</span>
        ) : (
          selected.map((booking) => (
            <button type="button" key={booking.id} onClick={() => onSelect(booking)}>
              <span className="reference-calendar-selected-heading">
                <strong>
                  {booking.reference.replace(/^DEM-/u, '')} · {booking.timeSlot || 'Journée'}
                </strong>
                <b>{statusLabel(booking)}</b>
              </span>
              <strong>
                {booking.customerName} · {booking.phone}
              </strong>
              <span>
                {booking.fromAddress} → {booking.toAddress}
              </span>
              <small>
                {vehicleTag(booking.vehicle.name)} · {booking.status === 'completed' ? '' : '≈ '}
                {money(amount(booking).final ?? amount(booking).provisional ?? 0)}
              </small>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
