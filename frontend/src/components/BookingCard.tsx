import { CalendarDays, Download, MapPin, MessageCircle } from 'lucide-react';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Modal } from './Modal';
import { messages } from '../content/fr';
import { dateLabel, money, statuses } from '../domain/format';
import type { Booking } from '../domain/model';
export function BookingCard({
  booking: b,
  onChange,
  admin = false,
  driverMode = false,
  editInitially = false,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
  driverMode?: boolean;
  editInitially?: boolean;
}) {
  const {
    refresh,
    busy,
    error,
    cancelling,
    setCancelling,
    editing,
    setEditing,
    last,
    terminal,
    change,
    requestCancellation,
    confirmCancellation,
    pdf,
    quote,
    extraLines,
    setExtraLines,
    wa,
    finalQuote,
    finalWa,
  } = useBookingCard({ booking: b, onChange, admin, editInitially });

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
      </div>
      <div className="card-actions">
        <button className="button secondary small" disabled={busy} onClick={() => pdf(last)}>
          <Download size={16} />
          {messages.telechargerLePdf}
        </button>
        {!admin && !driverMode && ['pending', 'confirmed'].includes(b.status) && (
          <button
            className="button text danger small"
            disabled={busy}
            onClick={requestCancellation}
          >
            {messages.annuler}
          </button>
        )}
        {driverMode && b.status === 'confirmed' && (
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => void change('in_progress')}
          >
            {messages.demarrerLeDemenagement}
          </button>
        )}
        {driverMode && b.status === 'in_progress' && (
          <button
            className="button primary small"
            disabled={busy}
            onClick={() => void change('completed')}
          >
            {messages.terminerLeDemenagement}
          </button>
        )}
        {admin && !terminal && (
          <>
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
              onClick={() => setEditing(true)}
            >
              {last ? messages.modifierLeDevis : messages.creerUnDevis}
            </button>
            {b.status !== 'in_progress' && (
              <button
                className="button text danger small"
                disabled={busy}
                onClick={requestCancellation}
              >
                {messages.annuler}
              </button>
            )}
          </>
        )}
        {admin && last && (
          <a className="button secondary small" target="_blank" rel="noreferrer" href={wa}>
            <MessageCircle size={16} />
            {messages.preparerLeMessageWhatsapp}
          </a>
        )}
        {admin && finalQuote && (
          <a className="button primary small" target="_blank" rel="noreferrer" href={finalWa}>
            <MessageCircle size={16} />
            {messages.envoyerLeDevisDefinitif}
          </a>
        )}
      </div>
      {editing && (
        <Modal titleId={'quote-title-' + b.id} busy={busy} onClose={() => setEditing(false)}>
          <form onSubmit={quote} className="quote-form">
            <h2 id={'quote-title-' + b.id}>
              {messages.unNouveauDevisPour}
              {b.reference}
            </h2>
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
              <div>
                <label htmlFor={'custom-' + b.id}>{messages.transportParAllerRetourFcfa}</label>
                <input
                  name="customPrice"
                  id={'custom-' + b.id}
                  type="number"
                  min={1}
                  max={10000000}
                  step={1}
                  defaultValue={last?.price.lines[0]?.unitPrice ?? ''}
                  placeholder={b.estimate.tier === 3 ? messages.tarifAConvenir : undefined}
                />
              </div>
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
            <div className="quote-extra-lines">
              <div className="section-heading">
                <h4>{messages.chargesSupplementaires}</h4>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() =>
                    setExtraLines((lines) => [
                      ...lines,
                      { id: crypto.randomUUID(), label: '', quantity: 1, unitPrice: 0 },
                    ])
                  }
                >
                  {messages.ajouterUneLigne}
                </button>
              </div>
              {extraLines.map((line) => (
                <div className="field-pair" key={line.id}>
                  <input
                    aria-label={messages.libelleDeLaCharge}
                    value={line.label}
                    onChange={(event) =>
                      setExtraLines((lines) =>
                        lines.map((item) =>
                          item.id === line.id ? { ...item, label: event.target.value } : item,
                        ),
                      )
                    }
                    required
                  />
                  <input
                    aria-label={messages.quantite}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) =>
                      setExtraLines((lines) =>
                        lines.map((item) =>
                          item.id === line.id
                            ? { ...item, quantity: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                  <input
                    aria-label={messages.montantFcfa}
                    type="number"
                    min={1}
                    value={line.unitPrice || ''}
                    onChange={(event) =>
                      setExtraLines((lines) =>
                        lines.map((item) =>
                          item.id === line.id
                            ? { ...item, unitPrice: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                  <button
                    type="button"
                    className="button text danger small"
                    onClick={() =>
                      setExtraLines((lines) => lines.filter((item) => item.id !== line.id))
                    }
                  >
                    {messages.retirer}
                  </button>
                </div>
              ))}
            </div>
            <p className="caption">{messages.unDevisFinalEstConserveSansModificationEt}</p>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                {messages.fermer}
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? messages.enregistrement : messages.enregistrerLeDevis}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {cancelling && (
        <ConfirmationDialog
          titleId={'cancel-booking-' + b.id}
          eyebrow={messages.annulerLaReservation}
          title={messages.annulerCetteReservation}
          description={messages.annulationReservationExplication}
          confirmLabel={messages.annuler}
          busy={busy}
          error={error}
          onConfirm={() => void confirmCancellation()}
          onClose={() => setCancelling(false)}
        />
      )}
      {error && !cancelling && !editing && (
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
