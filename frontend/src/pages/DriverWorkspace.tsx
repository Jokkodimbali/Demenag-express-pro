import { RefreshCw, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../application/context';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { usePagination } from '../application/usePagination';
import type { BookingStatus, DriverAvailabilityDay } from '../domain/model';
import { BookingCard } from '../components/BookingCard';
import { DriverVehicleReports } from '../components/DriverVehicleReports';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';
import { statuses } from '../domain/format';

type MissionPeriod = 'all' | 'today' | 'week' | 'custom' | 'undated';

function dakarToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(new Date());
}

function weekBounds(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return [start, date.toISOString().slice(0, 10)] as const;
}

const availabilityDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const defaultAvailability: DriverAvailabilityDay[] = availabilityDays.map((_, index) => ({
  available: index < 6,
  startTime: '08:00',
  endTime: '18:00',
}));

export function DriverWorkspace() {
  const { profile, bookings, loading, error, setRetry, availabilitySaving, saveAvailability } =
    useDriverWorkspace();
  const { catalogue } = useApp();
  const [availabilityDraft, setAvailabilityDraft] = useState(defaultAvailability);
  const [period, setPeriod] = useState<MissionPeriod>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const filteredBookings = useMemo(() => {
    const today = dakarToday();
    const [weekStart, weekEnd] = weekBounds(today);
    return bookings.filter((booking) => {
      const date = booking.date;
      let matchesPeriod = true;
      if (period === 'today') matchesPeriod = date === today;
      else if (period === 'week') matchesPeriod = !!date && date >= weekStart && date <= weekEnd;
      else if (period === 'undated') matchesPeriod = !date;
      else if (period === 'custom')
        matchesPeriod =
          !!date &&
          (!dateFrom || date >= dateFrom) &&
          (!dateTo || date <= dateTo) &&
          (!!dateFrom || !!dateTo);
      const searchText = query.trim().toLocaleLowerCase('fr');
      const matchesSearch =
        !searchText ||
        [booking.reference, booking.customerName, booking.fromAddress, booking.toAddress]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(searchText);
      return (
        matchesPeriod &&
        matchesSearch &&
        (statusFilter === 'all' || booking.status === statusFilter)
      );
    });
  }, [bookings, dateFrom, dateTo, period, query, statusFilter]);
  const pagination = usePagination(
    filteredBookings,
    pageSizes.bookings,
    `${period}:${dateFrom}:${dateTo}:${statusFilter}:${query}`,
  );
  const vehicle = profile?.vehicleId
    ? (catalogue?.vehicles.find((item) => item.id === profile.vehicleId) ??
      bookings.find((booking) => booking.vehicle.id === profile.vehicleId)?.vehicle ??
      null)
    : null;
  useEffect(() => {
    if (profile?.availability?.length === 7) setAvailabilityDraft(profile.availability);
  }, [profile]);
  function updateAvailabilityDay(index: number, patch: Partial<DriverAvailabilityDay>) {
    setAvailabilityDraft((days) =>
      days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    );
  }
  return (
    <section
      className="container workspace-page driver-reference-page"
      data-screen-label="Espace employé"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">ESPACE EMPLOYÉ · CHAUFFEUR</p>
          <h1>{profile?.name ?? messages.mesMissions}</h1>
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
      {profile ? (
        <section className="driver-availability-card panel">
          <span className="eyebrow">MES DISPONIBILITÉS</span>
          <div className="driver-availability-days">
            {availabilityDraft.map((day, index) => (
              <div className="driver-availability-row" key={availabilityDays[index]}>
                <strong>{availabilityDays[index]}</strong>
                <button
                  type="button"
                  className={day.available ? 'available' : ''}
                  aria-pressed={day.available}
                  onClick={() => updateAvailabilityDay(index, { available: !day.available })}
                >
                  {day.available ? 'Disponible' : 'Repos'}
                </button>
                {day.available && (
                  <div className="driver-availability-times">
                    <input
                      type="time"
                      aria-label={`Début · ${availabilityDays[index]}`}
                      value={day.startTime}
                      onChange={(event) =>
                        updateAvailabilityDay(index, { startTime: event.target.value })
                      }
                    />
                    <span>à</span>
                    <input
                      type="time"
                      aria-label={`Fin · ${availabilityDays[index]}`}
                      value={day.endTime}
                      onChange={(event) =>
                        updateAvailabilityDay(index, { endTime: event.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            className="button primary"
            type="button"
            disabled={availabilitySaving}
            onClick={() => void saveAvailability(availabilityDraft)}
          >
            {availabilitySaving ? 'Enregistrement…' : 'Enregistrer mes disponibilités'}
          </button>
        </section>
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
      {!loading && profile?.vehicleId ? <DriverVehicleReports /> : null}
      <div className="list-heading">
        <h2>
          {messages.mesMissions}
          <span>{pagination.total}</span>
        </h2>
      </div>
      <div className="driver-mission-filters" aria-label={messages.filtrerMissions}>
        <label>
          <span>{messages.filtrerMissions}</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as MissionPeriod)}
          >
            <option value="all">{messages.toutesLesDates}</option>
            <option value="today">{messages.missionsAujourdhui}</option>
            <option value="week">{messages.cetteSemaine}</option>
            <option value="custom">{messages.periodePersonnalisee}</option>
            <option value="undated">{messages.missionsSansDate}</option>
          </select>
        </label>
        {period === 'custom' && (
          <>
            <label>
              <span>{messages.dateDebut}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label>
              <span>{messages.dateFin}</span>
              <input
                type="date"
                min={dateFrom || undefined}
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          <span>{messages.statutMission}</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as BookingStatus | 'all')}
          >
            <option value="all">{messages.tousLesStatuts}</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="driver-mission-search">
          <span>{messages.rechercherMissions}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={messages.rechercherMissions}
          />
        </label>
      </div>
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : pagination.total ? (
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
          <h3>
            {!profile?.vehicleId
              ? messages.aucunVehiculeAffecte
              : bookings.length
                ? messages.aucuneMissionPourCeFiltre
                : messages.aucuneMission}
          </h3>
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
