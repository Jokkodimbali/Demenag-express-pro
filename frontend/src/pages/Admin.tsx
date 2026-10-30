import { uiText } from '../content/reference-ui-text';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
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
import { whatsappNumber, whatsappUrl } from '../application/services/whatsapp';

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
  const visible = periodBookings.filter((booking) => {
    if (reservationFilter === 'undated') return !booking.date;
    if (reservationFilter === 'provisional') return isProvisional(booking);
    if (reservationFilter === 'final') return hasFinalQuote(booking);
    return true;
  });
  function reminderInfo(booking: Booking) {
    const daysBefore = booking.date
      ? Math.round(
          (+new Date(`${booking.date}T12:00:00Z`) - +new Date(`${dakarToday()}T12:00:00Z`)) /
            86400000,
        )
      : -1;
    const phone = whatsappNumber(booking.phone, catalogue?.settings.whatsappCountryCode ?? '221');
    const canSend =
      daysBefore >= 0 && !['completed', 'cancelled'].includes(booking.status) && phone.length >= 10;
    const why = !booking.date
      ? 'Ajoutez une date au rendez-vous.'
      : daysBefore < 0
        ? 'La date du rendez-vous est passée.'
        : ['completed', 'cancelled'].includes(booking.status)
          ? 'La réservation est clôturée.'
          : phone.length < 10
            ? 'Le numéro WhatsApp du client est manquant ou invalide.'
            : '';
    const when =
      daysBefore === 0
        ? 'aujourd’hui'
        : daysBefore === 1
          ? 'demain'
          : daysBefore % 7 === 0
            ? `dans ${daysBefore / 7} semaine${daysBefore > 7 ? 's' : ''}`
            : `dans ${daysBefore} jours`;
    const date = booking.date
      ? new Date(`${booking.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Africa/Dakar',
        })
      : '';
    const message =
      `Bonjour ${booking.customerName}, petit rappel de Demenag Express : votre déménagement (${booking.reference}) est prévu ${when}, le ${date}` +
      (booking.timeSlot && booking.timeSlot !== 'À définir' ? ` à ${booking.timeSlot}` : '') +
      `.\n` +
      (booking.fromAddress ? `Départ : ${booking.fromAddress}\n` : '') +
      (booking.toAddress ? `Arrivée : ${booking.toAddress}\n` : '') +
      (catalogue?.settings.paymentWave !== false || catalogue?.settings.paymentCash !== false
        ? `Mode de paiement : ${[
            catalogue?.settings.paymentWave !== false ? 'Wave' : '',
            catalogue?.settings.paymentCash !== false ? 'espèces' : '',
          ]
            .filter(Boolean)
            .join(
              ' ou ',
            )}${catalogue?.settings.paymentWave !== false && catalogue?.settings.paymentCash !== false ? ' (au choix)' : ''}.\n`
        : '') +
      `Merci de préparer vos affaires pour le chargement. Pour toute question, contactez-nous au ${catalogue?.settings.businessPhone ?? ''}. À bientôt !`;
    const last = booking.reminders?.at(-1);
    const sentAt = last
      ? new Date(last.at)
          .toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Dakar',
          })
          .replace(/\s+(?=\d{2}:\d{2}$)/, ' à ')
      : '';
    const lastSent = sentAt ? `${canSend ? 'Dernier rappel :' : 'Rappel envoyé le'} ${sentAt}` : '';
    return {
      canSend,
      why,
      daysBefore,
      when,
      lastSent,
      url: whatsappUrl(booking.phone, message, catalogue?.settings),
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
      setSuccessToast(`Réservation ${deleteTarget.reference} supprimée définitivement.`);
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
          title={uiText['voulezVousSupprimerDefinitivementCeRendezVous']}
          description={`La réservation, son devis et ses photos seront effacés. Cette action est irréversible. ${deleteTarget.reference} · ${deleteTarget.customerName} · ${referenceDate(deleteTarget)} · ${deleteTarget.fromAddress || '—'} → ${deleteTarget.toAddress || '—'}`}
          confirmLabel="Supprimer"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void deleteBooking()}
          onClose={() => !deleteBusy && setDeleteTarget(null)}
        />
      )}
      <>
        <div className="admin-reference-reservation-toolbar">
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
              {visible.length === 0 ? (
                <div className="admin-reservations-empty">{uiText['aucuneReservation']}</div>
              ) : (
                visible.map((booking) => {
                  const latestQuote = booking.quotes.at(-1);
                  const total = latestQuote?.price.total ?? booking.estimate.total;
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
              {visible.length === 0 ? (
                <div className="admin-reservations-empty">{uiText['aucuneReservation']}</div>
              ) : (
                visible.map((booking) => {
                  const latestQuote = booking.quotes.at(-1);
                  const total = latestQuote?.price.total ?? booking.estimate.total;
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
      </>
    </>
  );
}
