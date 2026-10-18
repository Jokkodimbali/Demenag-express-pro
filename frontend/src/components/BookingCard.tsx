import { CalendarDays, Download, MapPin, MessageCircle, Trash2, X } from 'lucide-react';
import { useState } from 'react';
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
  onDeleted,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
  driverMode?: boolean;
  editInitially?: boolean;
  onDeleted?: () => void;
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
    deleting,
    setDeleting,
    deleteBusy,
    deleteError,
    confirmDelete,
    pdf,
    quote,
    extraLines,
    setExtraLines,
    quoteDraft,
    setQuoteDraft,
    quotePreviewTotal,
    quoteSettings,
    wa,
    finalQuote,
    finalWa,
    saveSchedule,
    enabledSlots,
    shareQuote,
  } = useBookingCard({ booking: b, onChange, admin, editInitially, onDeleted });
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(b.date ?? '');
  const [scheduleSlot, setScheduleSlot] = useState(b.timeSlot);

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
            {b.date ? `${dateLabel(b.date)} · ${b.timeSlot}` : 'Sans date de rendez-vous'}
          </p>
          {admin && b.status === 'pending' && <button className="button text small" type="button" onClick={() => setEditingSchedule((value) => !value)}>{editingSchedule ? 'Fermer' : 'Modifier le rendez-vous'}</button>}
          {admin && editingSchedule && b.status === 'pending' && <form className="schedule-editor" onSubmit={async (event) => { event.preventDefault(); if (await saveSchedule(scheduleDate, scheduleSlot)) setEditingSchedule(false); }}>
            <label>Date du rendez-vous<input type="date" value={scheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setScheduleDate(event.target.value)} /></label>
            {scheduleDate && <label>Créneau<select value={scheduleSlot} onChange={(event) => setScheduleSlot(event.target.value)}>{enabledSlots.map((slot) => <option key={slot.label} value={slot.label}>{slot.label}</option>)}</select></label>}
            <button className="button primary small" disabled={busy} type="submit">Enregistrer</button>
          </form>}
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
          <button className="button secondary small" type="button" disabled={busy} onClick={() => void shareQuote(last, wa)}>
            <MessageCircle size={16} />
            {messages.partagerLeDevisWhatsApp}
          </button>
        )}
        {admin && finalQuote && (
          <button className="button primary small" type="button" disabled={busy} onClick={() => void shareQuote(finalQuote, finalWa)}>
            <MessageCircle size={16} />
            {messages.envoyerLeDevisDefinitif}
          </button>
        )}
        {admin && (
          <button className="button text danger small" disabled={busy || deleteBusy} onClick={() => { setDeleting(true); }}>
            <Trash2 size={16} />Supprimer définitivement
          </button>
        )}
      </div>
      {editing && (
        <Modal titleId={'quote-title-' + b.id} busy={busy} onClose={() => setEditing(false)} className="account-dialog quote-dialog">
          <form onSubmit={quote} className="quote-form">
            <div className="quote-modal-heading">
              <h2 id={'quote-title-' + b.id}>
                {messages.unNouveauDevisPour}
                {b.reference}
              </h2>
              <button type="button" className="icon-button" aria-label={messages.fermer} title={messages.fermer} disabled={busy} onClick={() => setEditing(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="quote-columns">
              <div className="quote-column">
            <div className="field-pair">
              <div>
                <label htmlFor={'kind-' + b.id}>{messages.typeDeDevis}</label>
                <select
                  name="kind"
                  id={'kind-' + b.id}
                  value={quoteDraft.kind}
                  onChange={(event) => setQuoteDraft((draft) => ({
                    ...draft,
                    kind: event.target.value === 'final' ? 'final' : 'provisional',
                  }))}
                >
                  <option value="provisional">{messages.provisoire}</option>
                  {(b.status === 'in_progress' || last?.kind === 'final') && (
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
                  value={quoteDraft.trips}
                  onChange={(event) => setQuoteDraft((draft) => ({ ...draft, trips: Number(event.target.value) }))}
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
                  value={quoteDraft.customPrice ?? ''}
                  onChange={(event) => setQuoteDraft((draft) => ({ ...draft, customPrice: event.target.value ? Number(event.target.value) : null }))}
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
                  value={quoteDraft.discount}
                  onChange={(event) => setQuoteDraft((draft) => ({ ...draft, discount: Number(event.target.value) }))}
                  required
                />
              </div>
            </div>
              </div>
              <div className="quote-column">
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
              </div>
            </div>
            <div className="quote-service-options">
              <h3>Prestations incluses au devis</h3>
              {([
                ['labour', messages.manUvres, messages.chargementEtDechargement],
                ['desk', messages.montageDemontageDeBureau, messages.unMenuisierPourVosMeubles],
                ['wardrobe', messages.montageDemontageDArmoire, messages.demontageEtRemontageSurPlace],
                ['bed', messages.montageDemontageDeLit, messages.litDeuxPlaces],
              ] as const).map(([key, label, description]) => {
                const price = key === 'labour'
                  ? quoteSettings?.labourPrice ?? 0
                  : quoteSettings?.assemblyPrice ?? 0;
                return <label key={key}>
                  <span><strong>{label}</strong><small>{description} · {money(price)} / unité</small></span>
                  <input
                    aria-label={label}
                    type="number"
                    min={0}
                    max={b.pricingSettings?.maxOptions ?? 20}
                    step={1}
                    value={quoteDraft.options[key]}
                    onChange={(event) => setQuoteDraft((draft) => ({
                      ...draft,
                      options: { ...draft.options, [key]: Number(event.target.value) },
                    }))}
                  />
                </label>;
              })}
            </div>
            <div className="quote-live-total" aria-live="polite">
              <span>{messages.montantCalculeDuDevis}</span>
              <strong>{quotePreviewTotal === null ? messages.tarifAConvenir : money(quotePreviewTotal)}</strong>
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
      {deleting && (
        <ConfirmationDialog
          titleId={'delete-booking-' + b.id}
          eyebrow={messages.suppressionDefinitive}
          title={messages.supprimerReservationDefinitivement}
          description={messages.confirmationSuppressionReservation(b.reference)}
          confirmLabel={messages.supprimerDefinitivement}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(false)}
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
