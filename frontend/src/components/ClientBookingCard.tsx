import { uiText } from '../content/reference-ui-text';
import { useApp } from '../application/context';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { whatsappNumber, whatsappUrl } from '../application/services/whatsapp';
import { money, referenceTierLabels } from '../domain/format';
import type { Booking } from '../domain/model';
import { routes } from '../routing/routes';
import { BookingRouteMap } from './BookingRouteMap';
import { Link } from 'react-router-dom';

export function ClientBookingCard({
  booking,
  onChange,
  onReminder,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
  onReminder?: (message: string) => void;
}) {
  const { catalogue } = useApp();
  const { pdf, busy, error, recordReminder } = useBookingCard({ booking, onChange });
  const provisionalQuote = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const displayedEstimate =
    finalQuote?.price.total ?? provisionalQuote?.price.total ?? booking.estimate.total;
  const referenceDate = booking.date ? booking.date.split('-').reverse().join('/') : '—';
  const distanceBounds = catalogue?.settings.distanceBounds ??
    booking.pricingSettings?.distanceBounds ?? [15, 25, 35];
  const tierIndex =
    booking.distanceKm < distanceBounds[0]
      ? 0
      : booking.distanceKm <= distanceBounds[1]
        ? 1
        : booking.distanceKm <= distanceBounds[2]
          ? 2
          : 3;
  const distanceTier = referenceTierLabels(distanceBounds)[tierIndex];
  const isFinal = booking.status === 'completed';
  const canEdit = ['pending', 'confirmed', 'cancelled'].includes(booking.status) && !finalQuote;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(new Date());
  const daysBefore = booking.date
    ? Math.round(
        (+new Date(`${booking.date}T12:00:00Z`) - +new Date(`${today}T12:00:00Z`)) / 86400000,
      )
    : -1;
  const reminderPhone = whatsappNumber(
    booking.phone,
    catalogue?.settings.whatsappCountryCode ?? '221',
  );
  const canRemind =
    daysBefore >= 0 &&
    !['completed', 'cancelled'].includes(booking.status) &&
    reminderPhone.length >= 10;
  const reminderWhen =
    daysBefore === 0
      ? 'aujourd’hui'
      : daysBefore === 1
        ? 'demain'
        : daysBefore % 7 === 0
          ? `dans ${daysBefore / 7} semaine${daysBefore > 7 ? 's' : ''}`
          : `dans ${daysBefore} jours`;
  const reminderLabel =
    daysBefore === 0 ? 'aujourd’hui' : daysBefore === 1 ? 'demain' : `J-${daysBefore}`;
  const paymentModes = [
    catalogue?.settings.paymentWave !== false ? 'Wave' : '',
    catalogue?.settings.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const paymentText = paymentModes.length
    ? `Mode de paiement : ${paymentModes.join(' ou ')}${paymentModes.length > 1 ? ' (au choix)' : ''}.`
    : '';
  const reminderDate = booking.date
    ? new Date(`${booking.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Dakar',
      })
    : '';
  const reminderMessage =
    `Bonjour ${booking.customerName}, petit rappel de Demenag Express : votre déménagement (${booking.reference}) est prévu ${reminderWhen}, le ${reminderDate}` +
    (booking.timeSlot && booking.timeSlot !== 'À définir' ? ` à ${booking.timeSlot}` : '') +
    `.\n` +
    (booking.fromAddress ? `Départ : ${booking.fromAddress}\n` : '') +
    (booking.toAddress ? `Arrivée : ${booking.toAddress}\n` : '') +
    `Merci de préparer vos affaires pour le chargement.${paymentText ? `\n${paymentText}` : ''} Pour toute question, contactez-nous au ${catalogue?.settings.businessPhone ?? ''}. À bientôt !`;
  const reminderUrl = whatsappUrl(booking.phone, reminderMessage, catalogue?.settings);
  const lastReminder = booking.reminders?.at(-1);
  const lastReminderDate = lastReminder
    ? (() => {
        const parts = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: 'Africa/Dakar',
        }).formatToParts(new Date(lastReminder.at));
        const part = (type: Intl.DateTimeFormatPartTypes) =>
          parts.find((entry) => entry.type === type)?.value ?? '';
        return `${part('day')}/${part('month')} à ${part('hour')}:${part('minute')}`;
      })()
    : '';
  const tolls = finalQuote?.tolls ?? [];
  const tollTotal = tolls.reduce((total, toll) => total + toll.unitPrice * toll.quantity, 0);
  const mapsUrl = new URL('https://www.google.com/maps/dir/');
  mapsUrl.searchParams.set('api', '1');
  mapsUrl.searchParams.set('origin', booking.from.join(','));
  mapsUrl.searchParams.set('destination', booking.to.join(','));
  mapsUrl.searchParams.set('travelmode', 'driving');

  async function sendReminder() {
    if (await recordReminder())
      onReminder?.(
        `Rappel WhatsApp envoyé à ${booking.customerName || 'client'} (${reminderWhen}).`,
      );
  }

  return (
    <article className="reference-client-card">
      <div className="reference-client-card-top">
        <div>
          <span>
            {booking.reference} · {referenceDate}
          </span>
          <strong>
            {booking.fromAddress} → {booking.toAddress}
          </strong>
        </div>
        <div className="reference-client-actions">
          {canEdit && (
            <Link
              className="reference-client-edit"
              to={`${routes.booking}?modifier=${encodeURIComponent(booking.id)}`}
            >
              {uiText['modifierMaDemande']}
            </Link>
          )}
          <div className="reference-client-status-group">
            <span className={`reference-client-status ${isFinal ? 'completed' : 'pending'}`}>
              {isFinal ? 'Final' : 'Provisoire'}
            </span>
            {canRemind && (
              <a
                className="reference-client-reminder"
                href={reminderUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Message : rendez-vous ${reminderWhen}`}
                onClick={() => void sendReminder()}
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
                {`Rappel · ${reminderLabel}`}
              </a>
            )}
            {lastReminderDate && (
              <small>
                {canRemind ? 'Dernier rappel :' : 'Rappel envoyé le'} {lastReminderDate}
              </small>
            )}
          </div>
        </div>
      </div>
      <div className="reference-client-map">
        <BookingRouteMap booking={booking} />
        <div className="reference-client-map-overlay">
          <span>
            {(booking.distanceKm
              ? `${String(booking.distanceKm).replace('.', ',')} km`
              : 'Trajet') +
              ' · ' +
              distanceTier}
          </span>
          <a href={mapsUrl.toString()} target="_blank" rel="noopener noreferrer">
            {uiText['ouvrirDansGoogleMaps']}
          </a>
        </div>
      </div>
      <div className="reference-client-addresses">
        <span>{uiText['a2']}</span>
        <p>{booking.fromAddress}</p>
        <span>{uiText['b']}</span>
        <p>{booking.toAddress}</p>
      </div>
      <div className="reference-client-facts">
        <div>
          <span>{uiText['vehicule']}</span>
          <strong>{booking.vehicle.shortName || booking.vehicle.name}</strong>
        </div>
        <div>
          <span>{uiText['creneau']}</span>
          <strong>{booking.timeSlot || '—'}</strong>
        </div>
        <div>
          <span>{uiText['estimation']}</span>
          <strong>{money(displayedEstimate)}</strong>
        </div>
      </div>
      <button
        className="reference-client-pdf"
        type="button"
        disabled={busy}
        onClick={() => void pdf(provisionalQuote)}
      >
        {uiText['telechargerLeDevisProvisoirePDF']}
      </button>
      {finalQuote && (
        <div className="reference-client-final">
          <div className="reference-client-final-heading">
            <strong>
              {uiText['devisFinal']}
              {finalQuote.reference}
            </strong>
            <strong>{money(finalQuote.price.total)}</strong>
          </div>
          {paymentText && (
            <div className="reference-client-payment">
              <div>
                <span>{uiText['modeDEPAIEMENT']}</span>
                <strong>
                  {paymentText.replace(/^Mode de paiement : /u, '').replace(/\.$/u, '')}
                </strong>
              </div>
              {catalogue?.settings.paymentWave !== false && catalogue?.settings.paymentQr && (
                <img src={catalogue.settings.paymentQr} alt={uiText['qrCodeWaveMarchand']} />
              )}
            </div>
          )}
          {finalQuote.price.lines.map((line, index) => (
            <div className="reference-client-line" key={`${line.label}-${index}`}>
              <span>
                {line.label} × {line.quantity}
              </span>
              <span>{money(line.total)}</span>
            </div>
          ))}
          {tolls.length > 0 && (
            <div className="reference-client-tolls">
              <div className="reference-client-tolls-heading">
                <strong>{uiText['peagesAVOTRECHARGE']}</strong>
                <span>{uiText['nonINCLUSDANSLETOTAL']}</span>
              </div>
              {tolls.map((toll) => (
                <div className="reference-client-toll-line" key={toll.tollPointId}>
                  <span>{toll.label.replace(/^Péage · /i, '')}</span>
                  <span>
                    {toll.quantity} × {toll.unitPrice ? money(toll.unitPrice) : 'prix à confirmer'}
                  </span>
                  <strong>{toll.unitPrice ? money(toll.unitPrice * toll.quantity) : '—'}</strong>
                </div>
              ))}
              <div className="reference-client-toll-total">
                <strong>{uiText['totalPeages']}</strong>
                <strong>{money(tollTotal)}</strong>
              </div>
            </div>
          )}
          <div className="reference-client-final-actions">
            <button type="button" disabled={busy} onClick={() => void pdf(finalQuote)}>
              {uiText['telechargerLeDevisFinalPDF']}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="reference-client-error">
          {error}
        </p>
      )}
    </article>
  );
}
