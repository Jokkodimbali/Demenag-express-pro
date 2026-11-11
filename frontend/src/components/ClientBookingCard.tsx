import { liveBookingPrice } from '../application/services/live-booking-price';
import { uiText } from '../content/reference-ui-text';
import { useApp } from '../application/context';
import { useClientBookingPdf } from '../application/controllers/useClientBookingPdf';
import { whatsappPaymentLine } from '../application/services/whatsapp-templates';
import { money, referenceTierLabels } from '../application/presentation/format';
import type { Booking } from '../domain/model';
import { routes } from '../routing/routes';
import { BookingRouteMap } from './BookingRouteMap';
import { Link } from 'react-router-dom';

export function ClientBookingCard({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
}) {
  const { catalogue } = useApp();
  const { pdf, busy, error } = useClientBookingPdf(booking);
  const provisionalQuote = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const displayedEstimate = liveBookingPrice(booking, catalogue).total;
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
  const paymentText = whatsappPaymentLine(catalogue?.settings).split(' Le QR code')[0];
  const tolls = finalQuote?.tolls ?? [];
  const tollTotal = tolls.reduce((total, toll) => total + toll.unitPrice * toll.quantity, 0);
  const mapsUrl = new URL('https://www.google.com/maps/dir/');
  mapsUrl.searchParams.set('api', '1');
  mapsUrl.searchParams.set('origin', booking.from.join(','));
  mapsUrl.searchParams.set('destination', booking.to.join(','));
  mapsUrl.searchParams.set('travelmode', 'driving');

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
