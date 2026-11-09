import { liveBookingPrice } from '../application/services/live-booking-price';
import { uiText } from '../content/reference-ui-text';
import { useEffect, useState } from 'react';
import { MessageCircle, Search, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../routing/routes';
import { useAdministration } from '../application/controllers/useAdministration';
import { useBookingCommands } from '../application/controllers/useBookingCommands';
import { BookingCard } from '../components/BookingCard';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useApp } from '../application/context';
import { messages } from '../content/fr';
import { money } from '../domain/format';
import type { Booking } from '../domain/model';
import { bookingReminder } from '../application/services/booking-reminder';
import { usePagination } from '../application/usePagination';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { visibleUiText } from '../content/visible-ui-text';

type ReservationFilter = 'all' | 'provisional' | 'final' | 'undated';
type ReservationPeriod = 'all' | 'day' | 'week';

function dakarToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(new Date());
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function weekStart(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function referenceShortDate(day: string) {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

function hasFinalQuote(booking: Booking) {
  return booking.status === 'completed';
}

function isProvisional(booking: Booking) {
  return booking.status !== 'completed' && booking.status !== 'cancelled';
}

function referenceDate(booking: Booking) {
  if (booking.date) {
    return referenceShortDate(booking.date);
  }
  const monthValue = booking.month ?? booking.createdAt.slice(0, 7);
  const month = new Date(`${monthValue}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Dakar',
  });
  return `Sans date · ${month}`;
}

function referenceVehicleName(name: string) {
  const normalized = name.toLocaleLowerCase('fr');
  if (normalized.includes('sprinter')) return 'Mercedes Sprinter';
  if (normalized.includes('trafic')) return 'Renault Trafic';
  if (normalized.includes('master')) return 'Renault Master';
  return name;
}

function referenceMoney(value: number | null) {
  return money(value).replace(/[\u00a0\u202f]/g, ' ');
}

export function Admin() {
  const { bookings, setBookings, loading, error, recordBookingReminder, removeBooking } =
    useAdministration();
  const { catalogue } = useApp();
  const bookingCommands = useBookingCommands();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [reservationFilter, setReservationFilter] = useState<ReservationFilter>('all');
  const [searchQuery, setSearchQuery] = useState(() => params.get('q') ?? '');
  const [period, setPeriod] = useState<ReservationPeriod>('all');
  const [selectedDay, setSelectedDay] = useState(dakarToday);
  const [reminderBusy, setReminderBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [fullDetail, setFullDetail] = useState<Booking | null>(null);
  const quoteHandoff = location.state as {
    initialTollLines?: { id: string; label: string; quantity: number; unitPrice: number }[];
    quoteError?: string;
  } | null;
  const periodBookings = bookings.filter((booking) => {
    if (period === 'all') return true;
    if (!booking.date) return false;
    if (period === 'day') return booking.date === selectedDay;
    const start = weekStart(selectedDay);
    return booking.date >= start && booking.date <= addDays(start, 6);
  });
  const reservationCounts = {
    all: periodBookings.length,
    provisional: periodBookings.filter(isProvisional).length,
    final: periodBookings.filter(hasFinalQuote).length,
    undated: periodBookings.filter((booking) => !booking.date).length,
  };
  const filteredBookings = periodBookings
    .filter((booking) => {
      if (reservationFilter === 'undated') return !booking.date;
      if (reservationFilter === 'provisional') return isProvisional(booking);
      if (reservationFilter === 'final') return hasFinalQuote(booking);
      return true;
    })
    .filter((booking) => {
      const query = searchQuery
        .trim()
        .toLocaleLowerCase('fr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '');
      if (!query) return true;
      const searchable = [
        booking.reference,
        booking.customerName,
        booking.phone,
        booking.fromAddress,
        booking.toAddress,
        booking.vehicle.name,
        booking.vehicle.shortName,
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '');
      return searchable.includes(query);
    });
  const bookingsPage = usePagination(
    filteredBookings,
    pageSizes.bookings,
    `${searchQuery}|${reservationFilter}|${period}|${selectedDay}`,
  );
  function reminderInfo(booking: Booking) {
    const reminder = bookingReminder(
      booking,
      catalogue?.settings,
      ['completed', 'cancelled'].includes(booking.status),
    );
    return {
      canSend: reminder.canSendReminder,
      why: reminder.reminderReason,
      daysBefore: reminder.daysUntilMove,
      when: reminder.reminderWhen,
      lastSent: reminder.lastReminderLabel,
      url: reminder.reminderHref,
    };
  }
  async function sendReminder(booking: Booking) {
    if (reminderBusy) return;
    setReminderBusy(booking.id);
    setActionError('');
    try {
      await recordBookingReminder(booking.id);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : 'Le rappel n’a pas pu être enregistré.',
      );
    } finally {
      setReminderBusy('');
    }
  }
  async function deleteBooking() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await removeBooking(deleteTarget.id);
      setSuccessToast(`Réservation ${deleteTarget.reference} placée dans la corbeille.`);
      setDeleteTarget(null);
    } catch (reason) {
      setDeleteError(
        reason instanceof Error ? reason.message : 'La réservation n’a pas pu être supprimée.',
      );
    } finally {
      setDeleteBusy(false);
    }
  }
  const selectedBookingId = params.get('detail');
  useEffect(() => {
    if (!selectedBookingId) {
      setFullDetail(null);
      return;
    }
    let active = true;
    setFullDetail(null);
    void bookingCommands
      .booking(selectedBookingId)
      .then((booking) => {
        if (active) setFullDetail(booking);
      })
      .catch((reason: unknown) => {
        if (active)
          setActionError(
            reason instanceof Error ? reason.message : 'Le dossier n’a pas pu être chargé.',
          );
      });
    return () => {
      active = false;
    };
  }, [bookingCommands, selectedBookingId]);
  const selectedBooking = selectedBookingId
    ? fullDetail?.id === selectedBookingId
      ? fullDetail
      : (bookings.find((booking) => booking.id === selectedBookingId) ?? null)
    : null;
  return (
    <>
      {quoteHandoff?.quoteError && (
        <p className="alert error" role="alert">
          {quoteHandoff.quoteError}
        </p>
      )}
      {actionError && (
        <p className="alert error" role="alert">
          {actionError}
        </p>
      )}
      {successToast && (
        <p className="alert success" role="status">
          {successToast}
        </p>
      )}
      {deleteTarget && (
        <ConfirmationDialog
          titleId="delete-reservation-title"
          eyebrow="SUPPRESSION D’UN RENDEZ-VOUS"
          title={visibleUiText.text13}
          description={`La réservation, son devis et ses photos iront dans la corbeille (Admin → Données). Vous pourrez la restaurer. ${deleteTarget.reference} · ${deleteTarget.customerName} · ${referenceDate(deleteTarget)} · ${deleteTarget.fromAddress || '—'} → ${deleteTarget.toAddress || '—'}`}
          confirmLabel="Supprimer"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void deleteBooking()}
          onClose={() => !deleteBusy && setDeleteTarget(null)}
        />
      )}
      <>
        <div className="admin-reference-reservation-toolbar">
          <label className="admin-reference-reservation-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={uiText['rechercherUneReservation']}
              aria-label={uiText['rechercherUneReservation']}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={uiText['effacerLaRecherche']}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </label>
          <div
            className="admin-reference-reservation-filters"
            aria-label={uiText['filtrerLesReservations']}
          >
            {(
              [
                ['all', 'Toutes'],
                ['provisional', 'Provisoires'],
                ['final', 'Finales'],
                ['undated', 'Sans date'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={reservationFilter === value ? 'active' : ''}
                onClick={() => setReservationFilter(value)}
              >
                {label} · {reservationCounts[value]}
              </button>
            ))}
          </div>
          <div className="admin-reference-period" aria-label={uiText['periodeDesReservations']}>
            <div className="admin-reference-period-tabs">
              {(
                [
                  ['all', 'Toutes dates'],
                  ['day', 'Jour'],
                  ['week', 'Semaine'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={period === value ? 'active' : ''}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {period !== 'all' && (
              <div className="admin-reference-period-controls">
                <button
                  type="button"
                  aria-label={uiText['precedent']}
                  onClick={() => setSelectedDay((day) => addDays(day, period === 'day' ? -1 : -7))}
                >
                  ‹
                </button>
                <input
                  type="date"
                  aria-label={uiText['dateDeLaPeriode']}
                  value={selectedDay}
                  onChange={(event) => event.target.value && setSelectedDay(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={uiText['suivant']}
                  onClick={() => setSelectedDay((day) => addDays(day, period === 'day' ? 1 : 7))}
                >
                  ›
                </button>
                <span>
                  {period === 'day'
                    ? new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'Africa/Dakar',
                      })
                    : `Semaine du ${referenceShortDate(weekStart(selectedDay))} au ${referenceShortDate(addDays(weekStart(selectedDay), 6))}`}
                </span>
              </div>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {loading ? (
          <p className="panel loading" role="status">
            {messages.chargementDesReservations}
          </p>
        ) : selectedBooking ? (
          <div className="admin-booking-detail">
            <button
              className="button secondary small"
              onClick={() => navigate(routes.administration)}
            >
              {uiText['retourAuxReservations']}
            </button>
            <BookingCard
              admin
              editInitially={params.get('edit') === 'quote'}
              initialTollLines={quoteHandoff?.initialTollLines}
              booking={selectedBooking}
              onChange={(next) => {
                setFullDetail(next);
                setBookings((rows) => rows.map((row) => (row.id === next.id ? next : row)));
              }}
              onDeleted={() => {
                setBookings((rows) => rows.filter((row) => row.id !== selectedBooking.id));
                navigate(routes.administration, { replace: true });
              }}
            />
          </div>
        ) : (
          <>
            <div
              className="admin-reservations-desktop"
              role="table"
              aria-label={uiText['reservations']}
            >
              <div className="admin-reservations-row admin-reservations-header" role="row">
                <span role="columnheader">{uiText['ref']}</span>
                <span role="columnheader">{uiText['client']}</span>
                <span role="columnheader">{uiText['trajet']}</span>
                <span role="columnheader">{uiText['date']}</span>
                <span role="columnheader">{uiText['vehicule']}</span>
                <span role="columnheader">{uiText['montant']}</span>
                <span role="columnheader">{uiText['statut']}</span>
              </div>
              {bookingsPage.total === 0 ? (
                <div className="admin-reservations-empty">
                  {searchQuery.trim()
                    ? uiText['aucuneReservationCorrespondante']
                    : uiText['aucuneReservation']}
                </div>
              ) : (
                bookingsPage.rows.map((booking) => {
                  const total = liveBookingPrice(booking, catalogue).total;
                  const reminder = reminderInfo(booking);
                  const href = `${routes.administrationCreateQuote}?modifier=${encodeURIComponent(booking.id)}`;
                  return (
                    <div
                      className="admin-reservations-row"
                      key={booking.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(href)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(href);
                        }
                      }}
                    >
                      <strong role="cell">{booking.reference}</strong>
                      <span className="admin-reservations-client" role="cell">
                        <strong>{booking.customerName}</strong>
                        <small>{booking.phone}</small>
                      </span>
                      <span role="cell">
                        {booking.fromAddress} → {booking.toAddress}
                      </span>
                      <span className="admin-reservations-date" role="cell">
                        {referenceDate(booking)}
                        {booking.date && <small>{booking.timeSlot || ''}</small>}
                      </span>
                      <span role="cell">{referenceVehicleName(booking.vehicle.name)}</span>
                      <span role="cell">
                        {booking.status === 'completed' ? '' : '≈ '}
                        {referenceMoney(total)}
                      </span>
                      <div className="admin-reservation-status-cell" role="cell">
                        <span
                          className={`admin-reservations-status ${booking.status === 'completed' ? 'final' : 'provisional'}`}
                        >
                          {booking.status === 'completed' ? 'Final' : 'Provisoire'}
                        </span>
                        {reminder.canSend && (
                          <a
                            className="reference-client-reminder"
                            href={reminder.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Message : rendez-vous ${reminder.when}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (reminderBusy === booking.id) {
                                event.preventDefault();
                                return;
                              }
                              void sendReminder(booking);
                            }}
                          >
                            <MessageCircle size={14} aria-hidden="true" />
                            {uiText['rappel']}{' '}
                            {reminder.daysBefore === 0
                              ? 'aujourd’hui'
                              : reminder.daysBefore === 1
                                ? 'demain'
                                : `J-${reminder.daysBefore}`}
                          </a>
                        )}
                        {!reminder.canSend && (
                          <small className="admin-reminder-disabled" title={reminder.why}>
                            {uiText['rappelIndisponible']}
                            {reminder.why}
                          </small>
                        )}
                        {reminder.lastSent && <small>{reminder.lastSent}</small>}
                        <button
                          type="button"
                          className="admin-reservation-team"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(
                              `${routes.administrationFleet}?date=${encodeURIComponent(booking.date ?? dakarToday())}&booking=${encodeURIComponent(booking.id)}`,
                            );
                          }}
                        >
                          {visibleUiText.text152}
                        </button>
                        <button
                          type="button"
                          className="admin-reservation-delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(booking);
                          }}
                        >
                          {uiText['supprimer']}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="admin-reservations-mobile">
              {bookingsPage.total === 0 ? (
                <div className="admin-reservations-empty">
                  {searchQuery.trim()
                    ? uiText['aucuneReservationCorrespondante']
                    : uiText['aucuneReservation']}
                </div>
              ) : (
                bookingsPage.rows.map((booking) => {
                  const total = liveBookingPrice(booking, catalogue).total;
                  const reminder = reminderInfo(booking);
                  const href = `${routes.administrationCreateQuote}?modifier=${encodeURIComponent(booking.id)}`;
                  return (
                    <div
                      className="admin-reservations-mobile-card"
                      key={booking.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(href)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(href);
                        }
                      }}
                    >
                      <div>
                        <strong>{booking.reference}</strong>
                        <strong>
                          {booking.status === 'completed' ? '' : '≈ '}
                          {referenceMoney(total)}
                        </strong>
                      </div>
                      <span className="admin-reservations-mobile-client">
                        <span>{booking.customerName}</span>
                        <small>{booking.phone}</small>
                      </span>
                      <span>
                        {booking.fromAddress} → {booking.toAddress}
                      </span>
                      <small>
                        {referenceDate(booking)} · {booking.date ? booking.timeSlot : ''} ·{' '}
                        {referenceVehicleName(booking.vehicle.name)}
                      </small>
                      <span
                        className={`admin-reservations-status ${booking.status === 'completed' ? 'final' : 'provisional'}`}
                      >
                        {booking.status === 'completed' ? 'Final' : 'Provisoire'}
                      </span>
                      {reminder.canSend && (
                        <a
                          className="reference-client-reminder"
                          href={reminder.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Message : rendez-vous ${reminder.when}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (reminderBusy === booking.id) {
                              event.preventDefault();
                              return;
                            }
                            void sendReminder(booking);
                          }}
                        >
                          <MessageCircle size={14} aria-hidden="true" />
                          {uiText['rappel']}{' '}
                          {reminder.daysBefore === 0
                            ? 'aujourd’hui'
                            : reminder.daysBefore === 1
                              ? 'demain'
                              : `J-${reminder.daysBefore}`}
                        </a>
                      )}
                      {!reminder.canSend && (
                        <small className="admin-reminder-disabled" title={reminder.why}>
                          {uiText['rappelIndisponible']}
                          {reminder.why}
                        </small>
                      )}
                      {reminder.lastSent && <small>{reminder.lastSent}</small>}
                      <button
                        type="button"
                        className="admin-reservation-team"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(
                            `${routes.administrationFleet}?date=${encodeURIComponent(booking.date ?? dakarToday())}&booking=${encodeURIComponent(booking.id)}`,
                          );
                        }}
                      >
                        {visibleUiText.text152}
                      </button>
                      <button
                        type="button"
                        className="admin-reservation-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(booking);
                        }}
                      >
                        {uiText['supprimer']}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <span className="admin-reservations-hint">
              {uiText['cliquezSurUneLignePourEtablirOuModifierLeDevis']}
            </span>
          </>
        )}
        {!loading && !selectedBooking && bookingsPage.total > 0 && (
          <Pagination
            page={bookingsPage.page}
            pageCount={bookingsPage.pageCount}
            total={bookingsPage.total}
            onPageChange={bookingsPage.setPage}
          />
        )}
      </>
    </>
  );
}
