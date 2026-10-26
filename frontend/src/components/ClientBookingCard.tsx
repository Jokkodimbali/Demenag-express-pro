import { useState } from 'react';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
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
  const { api } = useApp();
  const { pdf, busy, error } = useBookingCard({ booking, onChange });
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(booking.date ?? '');
  const [timeSlot, setTimeSlot] = useState(booking.timeSlot);
  const [notes, setNotes] = useState(booking.notes);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editBusy) return;
    setEditBusy(true);
    setEditError('');
    let current = booking;
    try {
      if (date !== (current.date ?? '') || (date ? timeSlot : '') !== current.timeSlot) {
        current = await api.schedule(
          current.id,
          date || null,
          date ? timeSlot : '',
          current.version,
        );
        onChange(current);
      }
      if (notes.trim() !== current.notes) {
        current = await api.updateBookingNotes(current.id, notes.trim(), current.version);
        onChange(current);
      }
      setEditing(false);
    } catch (reason) {
      setEditError(errorMessage(reason));
    } finally {
      setEditBusy(false);
    }
  }
  const provisionalQuote = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const displayedEstimate =
    finalQuote?.price.total ?? provisionalQuote?.price.total ?? booking.estimate.total;
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
        <form className="reference-client-editor" onSubmit={(event) => void saveChanges(event)}>
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
          <label className="reference-client-editor-notes">
            Précisions
            <textarea
              value={notes}
              maxLength={2000}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {editError && (
            <p role="alert" className="reference-client-error">
              {editError}
            </p>
          )}
          <button type="submit" disabled={busy || editBusy}>
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
          <strong>{money(displayedEstimate)}</strong>
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
