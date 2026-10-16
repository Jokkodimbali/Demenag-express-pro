import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { messages } from '../content/fr';
import { dateLabel, money, statuses } from '../domain/format';
import type { Booking } from '../domain/model';
export function BookingCard({
  booking: b,
  onChange,
  admin = false,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
}) {
  const {
    refresh,
    open,
    setOpen,
    busy,
    error,
    editing,
    setEditing,
    last,
    terminal,
    change,
    pdf,
    quote,
    wa,
  } = useBookingCard({ booking: b, onChange, admin });

  return (
    <article className="booking-card panel">
      <div className="booking-card-top">
        <span className="reference">{b.reference}</span>
        <span className={'status ' + b.status}>{statuses[b.status]}</span>
      </div>
      <div className="booking-card-main">
        <img src={b.vehicle.image} alt={messages.text} />
        <div>
          <h3>{admin ? b.customerName : b.vehicle.name}</h3>
          {admin && (
            <p className="muted">
              {b.phone} · {b.vehicle.name}
            </p>
          )}
          <p>
            <MapPin size={15} />
            <span>
              {b.fromAddress} → {b.toAddress}
            </span>
          </p>
          <p>
            <CalendarDays size={15} />
            {dateLabel(b.date)} · {b.timeSlot}
          </p>
        </div>
        <div className="booking-amount">
          <span>{last ? 'Dernier devis' : 'Estimation'}</span>
          <strong>{money(last?.price.total ?? (last ? null : b.estimate.total))}</strong>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="button secondary small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? messages.reduire : messages.voirLeDetail}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button className="button secondary small" disabled={busy} onClick={() => pdf(last)}>
          <Download size={16} />
          {messages.telechargerLePdf}
        </button>
        {!admin && ['pending', 'confirmed'].includes(b.status) && (
          <button
            className="button text danger small"
            disabled={busy}
            onClick={() => {
              if (window.confirm(messages.annulerCetteReservation)) void change('cancelled');
            }}
          >
            {messages.annuler}
          </button>
        )}
      </div>
      {open && (
        <div className="booking-detail">
          <dl>
            <div>
              <dt>{messages.distanceRoutiere}</dt>
              <dd>
                {b.distanceKm}
                {messages.km}
              </dd>
            </div>
            <div>
              <dt>{messages.manUvres}</dt>
              <dd>{b.options.labour}</dd>
            </div>
            <div>
              <dt>{messages.montageDemontage}</dt>
              <dd>
                {b.options.desk + b.options.wardrobe + b.options.bed}
                {messages.meubleS}
              </dd>
            </div>
          </dl>
          {b.notes && (
            <p>
              <strong>{messages.precisions2}</strong> {b.notes}
            </p>
          )}
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${b.from.join(',')}&destination=${b.to.join(',')}`}
            target="_blank"
            rel="noreferrer"
          >
            {messages.ouvrirLeTrajetDansGoogleMaps}
          </a>
          {b.quotes.length > 0 && (
            <div className="quote-history">
              <h4>{messages.historiqueDesDevis}</h4>
              {b.quotes.map((q) => (
                <div key={q.id}>
                  <span>
                    <strong>{q.reference}</strong> ·{' '}
                    {q.kind === 'final' ? 'Final' : messages.labelProvisoire}
                    <small>
                      {dateLabel(q.createdAt.slice(0, 10))} · {q.price.trips}
                      {messages.allerSRetourS}
                    </small>
                  </span>
                  <strong>{money(q.price.total)}</strong>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => pdf(q)}
                    aria-label={messages.telecharger + q.reference}
                  >
                    <Download size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {admin && !terminal && (
        <div className="admin-actions">
          {b.status === 'pending' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => change('confirmed')}
            >
              {messages.confirmerLaReservation}
            </button>
          )}
          {b.status === 'confirmed' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => change('in_progress')}
            >
              {messages.demarrerLeDemenagement}
            </button>
          )}
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? messages.fermerLeFormulaire : messages.creerUnDevis}
          </button>
          {b.status !== 'in_progress' && (
            <button
              className="button text danger small"
              disabled={busy}
              onClick={() => {
                if (window.confirm(messages.annulerCetteReservation)) void change('cancelled');
              }}
            >
              {messages.annuler}
            </button>
          )}
        </div>
      )}
      {admin && last && (
        <a className="whatsapp-link" target="_blank" rel="noreferrer" href={wa}>
          <MessageCircle size={17} />
          {messages.preparerLeMessageWhatsapp}
        </a>
      )}
      {editing && (
        <form onSubmit={quote} className="quote-form">
          <h4>
            {messages.unNouveauDevisPour}
            {b.reference}
          </h4>
          <div className="field-pair">
            <div>
              <label htmlFor={'kind-' + b.id}>{messages.typeDeDevis}</label>
              <select name="kind" id={'kind-' + b.id}>
                <option value="provisional">{messages.provisoire}</option>
                {b.status === 'in_progress' && (
                  <option value="final">{messages.finalClotureLeDemenagement}</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor={'trips-' + b.id}>{messages.allersRetours}</label>
              <input
                name="trips"
                id={'trips-' + b.id}
                type="number"
                min={1}
                max={b.pricingSettings?.maxTrips}
                step={1}
                defaultValue={last?.price.trips || 1}
                required
              />
            </div>
          </div>
          <div className="field-pair">
            {b.estimate.tier === 3 && (
              <div>
                <label htmlFor={'custom-' + b.id}>{messages.transportParAllerRetourFcfa}</label>
                <input
                  name="customPrice"
                  id={'custom-' + b.id}
                  type="number"
                  min={1}
                  max={10000000}
                  step={1}
                  placeholder={messages.tarifAConvenir}
                />
              </div>
            )}
            <div>
              <label htmlFor={'discount-' + b.id}>{messages.remiseFcfa}</label>
              <input
                name="discount"
                id={'discount-' + b.id}
                type="number"
                min={0}
                max={10000000}
                step={1}
                defaultValue={0}
                required
              />
            </div>
          </div>
          <label htmlFor={'notes-' + b.id}>{messages.noteDuDevis}</label>
          <textarea name="notes" id={'notes-' + b.id} rows={3} maxLength={2000} />
          <p className="caption">{messages.unDevisFinalEstConserveSansModificationEt}</p>
          <button className="button primary" disabled={busy}>
            {busy ? messages.enregistrement : messages.enregistrerLeDevis}
          </button>
        </form>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void refresh()}>
            {messages.actualiser}
          </button>
        </p>
      )}
    </article>
  );
}
