import { useState } from 'react';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { money } from '../domain/format';
import type { Booking } from '../domain/model';
import { BookingRouteMap } from './BookingRouteMap';

export function ClientBookingCard({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
}) {
  const { pdf, busy, error, finalQuote, saveSchedule } = useBookingCard({ booking, onChange });
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(booking.date ?? '');
  const [timeSlot, setTimeSlot] = useState(booking.timeSlot);
  const provisionalQuote = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  const referenceDate = booking.date ? booking.date.split('-').reverse().join('/') : '—';
  const distanceTier =
    booking.distanceKm < 15
      ? 'Moins de 15 km'
      : booking.distanceKm <= 25
        ? '15 – 25 km'
        : booking.distanceKm <= 35
          ? '25 – 35 km'
          : 'Plus de 35 km';
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
          {!finalQuote && ['pending', 'confirmed'].includes(booking.status) && (
            <button
              type="button"
              className="reference-client-edit"
              onClick={() => setEditing((current) => !current)}
            >
              Modifier ma demande
            </button>
          )}
          <span className={`reference-client-status ${finalQuote ? 'completed' : 'pending'}`}>
            {finalQuote ? 'Final' : 'Provisoire'}
          </span>
        </div>
      </div>
      {editing && (
        <form
          className="reference-client-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await saveSchedule(date, timeSlot)) setEditing(false);
          }}
        >
          <label>
            Date{' '}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Créneau{' '}
            <input
              type="time"
              value={timeSlot}
              required={Boolean(date)}
              onChange={(event) => setTimeSlot(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Enregistrer
          </button>
        </form>
      )}
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
            Ouvrir dans Google Maps
          </a>
        </div>
      </div>
      <div className="reference-client-addresses">
        <span>A</span>
        <p>{booking.fromAddress}</p>
        <span>B</span>
        <p>{booking.toAddress}</p>
      </div>
      <div className="reference-client-facts">
        <div>
          <span>VÉHICULE</span>
          <strong>{booking.vehicle.name}</strong>
        </div>
        <div>
          <span>CRÉNEAU</span>
          <strong>{booking.timeSlot || '—'}</strong>
        </div>
        <div>
          <span>ESTIMATION</span>
          <strong>{money(booking.estimate.total)}</strong>
        </div>
      </div>
      <button
        className="reference-client-pdf"
        type="button"
        disabled={busy}
        onClick={() => void pdf(provisionalQuote)}
      >
        Télécharger le devis provisoire (PDF)
      </button>
      {finalQuote && (
        <div className="reference-client-final">
          <div className="reference-client-final-heading">
            <strong>Devis final {finalQuote.reference}</strong>
            <strong>{money(finalQuote.price.total)}</strong>
          </div>
          {finalQuote.price.lines.map((line, index) => (
            <div className="reference-client-line" key={`${line.label}-${index}`}>
              <span>
                {line.label} × {line.quantity}
              </span>
              <span>{money(line.total)}</span>
            </div>
          ))}
          <button type="button" disabled={busy} onClick={() => void pdf(finalQuote)}>
            Télécharger le devis final (PDF)
          </button>
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
