import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  MapPin,
  MessageCircle,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBookingCard } from '../application/controllers/useBookingCard';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Modal } from './Modal';
import { DriverCourseActions } from './DriverCourseActions';
import { BookingRouteMap } from './BookingRouteMap';
import { TollRateSelector } from './TollRateSelector';
import { quotedServiceOptions } from '../application/services/quote-service-options';
import { messages } from '../content/fr';
import { dateLabel, money, statuses } from '../domain/format';
import type { Booking } from '../domain/model';
export function BookingCard({
  booking: b,
  onChange,
  admin = false,
  driverMode = false,
  editInitially = false,
  initialTollLines,
  onDeleted,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
  driverMode?: boolean;
  editInitially?: boolean;
  initialTollLines?: { id: string; label: string; quantity: number; unitPrice: number }[];
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
    quoteNotes,
    setQuoteNotes,
    setQuoteDraft,
    quotePreviewTotal,
    quoteSettings,
    wa,
    finalQuote,
    finalWa,
    saveSchedule,
    shareQuote,
    saveBookingNotes,
  } = useBookingCard({ booking: b, onChange, admin, editInitially, onDeleted });
  const trips = b.trips ?? [];
  const displayedQuote = finalQuote ?? last;
  const displayedPrice = displayedQuote?.price ?? b.estimate;
  const displayedOptions = quotedServiceOptions(b, displayedQuote);
  const incompleteTrips = trips.filter((trip) => !trip.finishedAt || !trip.unloadingPhotos?.length);
  const canCloseBooking =
    b.status === 'in_progress' &&
    !!finalQuote &&
    !!b.driverFinishedAt &&
    trips.length > 0 &&
    incompleteTrips.length === 0;
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(b.date ?? '');
  const [scheduleSlot, setScheduleSlot] = useState(() =>
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.timeSlot) ? b.timeSlot : '',
  );
  const [editingNotes, setEditingNotes] = useState(false);
  const [bookingNotes, setBookingNotes] = useState(b.notes);

  useEffect(() => {
    if (initialTollLines?.length) {
      setExtraLines((lines) => {
        const existingLabels = new Set(lines.map((line) => line.label));
        const newLines = initialTollLines.filter((line) => !existingLabels.has(line.label));
        return newLines.length ? [...lines, ...newLines] : lines;
      });
    }
  }, [initialTollLines, setExtraLines]);

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
          {admin && !finalQuote && !terminal && (
            <button
              className="button text small"
              type="button"
              onClick={() => setEditingSchedule((value) => !value)}
            >
              {editingSchedule ? 'Fermer' : 'Modifier le rendez-vous'}
            </button>
          )}
          {admin && !finalQuote && !terminal && editingSchedule && (
            <form
              className="schedule-editor"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await saveSchedule(scheduleDate, scheduleSlot)) setEditingSchedule(false);
              }}
            >
              <label>
                Date du rendez-vous
                <input
                  type="date"
                  value={scheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setScheduleDate(event.target.value)}
                />
              </label>
              {scheduleDate && (
                <label>
                  Heure du rendez-vous
                  <input
                    type="time"
                    step="60"
                    value={scheduleSlot}
                    onChange={(event) => setScheduleSlot(event.target.value)}
                    required
                  />
                </label>
              )}
              <button className="button primary small" disabled={busy} type="submit">
                Enregistrer
              </button>
            </form>
          )}
        </div>
        <div className="booking-amount">
          <span>{displayedQuote ? 'Dernier devis' : 'Estimation'}</span>
          <strong>{money(displayedPrice.total)}</strong>
        </div>
      </div>
      {(admin || driverMode) && (
        <BookingRouteMap
          booking={b}
          admin={admin && !finalQuote}
          onChange={admin && !finalQuote ? onChange : undefined}
        />
      )}
      {driverMode && (
        <div className="booking-route-actions">
          <a
            className="button secondary small booking-google-route"
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${b.from[0]},${b.from[1]}`)}&destination=${encodeURIComponent(`${b.to[0]},${b.to[1]}`)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> {messages.ouvrirLeTrajetDansGoogleMaps} <ArrowUpRight size={15} />
          </a>
          <a
            className="button secondary small booking-google-route"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${b.from[0]},${b.from[1]}`)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> {messages.versLeDepart} <ArrowUpRight size={15} />
          </a>
          <a
            className="button secondary small booking-google-route"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${b.to[0]},${b.to[1]}`)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> {messages.versLArrivee} <ArrowUpRight size={15} />
          </a>
        </div>
      )}
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
            <dd>{displayedOptions.labour}</dd>
          </div>
          <div>
            <dt>{messages.montageDemontageDeBureau}</dt>
            <dd>{displayedOptions.desk}</dd>
          </div>
          <div>
            <dt>{messages.montageDemontageDArmoire}</dt>
            <dd>{displayedOptions.wardrobe}</dd>
          </div>
          <div>
            <dt>{messages.montageDemontageDeLit}</dt>
            <dd>{displayedOptions.bed}</dd>
          </div>
        </dl>
        <div className="booking-price-breakdown">
          <h4>{displayedQuote ? 'Détail du devis' : 'Détail de l’estimation'}</h4>
          <div className="booking-price-table-wrap">
            <table className="booking-price-table">
              <thead>
                <tr>
                  <th>Prestation</th>
                  <th>Qté</th>
                  <th>Prix unitaire</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {displayedPrice.lines.map((line, index) => (
                  <tr key={`${line.label}-${index}`}>
                    <td>{line.label}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unitPrice)}</td>
                    <td>{money(line.total)}</td>
                  </tr>
                ))}
                {displayedPrice.discount > 0 && (
                  <tr>
                    <td colSpan={3}>Remise</td>
                    <td>−{money(displayedPrice.discount)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Total</th>
                  <th>{money(displayedPrice.total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      {admin && (
        <section className="booking-precision">
          <div className="booking-precision-heading">
            <strong>Note de précision</strong>
            {!editingNotes && !terminal && !finalQuote && (
              <button
                className="button text small"
                type="button"
                onClick={() => {
                  setBookingNotes(b.notes);
                  setEditingNotes(true);
                }}
              >
                Modifier
              </button>
            )}
          </div>
          {editingNotes && !finalQuote ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (await saveBookingNotes(bookingNotes)) setEditingNotes(false);
              }}
            >
              <textarea
                aria-label="Note de précision de la réservation"
                rows={3}
                maxLength={2000}
                value={bookingNotes}
                onChange={(event) => setBookingNotes(event.target.value)}
                placeholder="Ajouter une précision pour cette réservation…"
              />
              <div className="booking-precision-actions">
                <button className="button primary small" type="submit" disabled={busy}>
                  <Save size={15} /> Enregistrer
                </button>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBookingNotes(b.notes);
                    setEditingNotes(false);
                  }}
                >
                  <X size={15} /> Annuler
                </button>
              </div>
            </form>
          ) : (
            <p className={b.notes ? '' : 'muted'}>{b.notes || 'Aucune note de précision.'}</p>
          )}
        </section>
      )}
      <div className="card-actions">
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => pdf(displayedQuote)}
        >
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
        {admin && !terminal && !finalQuote && (
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
        {admin && canCloseBooking && (
          <button
            className="button primary small"
            type="button"
            disabled={busy}
            onClick={() => void change('completed')}
          >
            <Check size={16} /> Valider le devis final et clôturer
          </button>
        )}
        {admin && last && (
          <button
            className="button secondary small"
            type="button"
            disabled={busy}
            onClick={() => void shareQuote(finalQuote ?? last, finalQuote ? finalWa : wa)}
          >
            <MessageCircle size={16} />
            {messages.partagerLeDevisWhatsApp}
          </button>
        )}
        {admin && finalQuote && (
          <button
            className="button primary small"
            type="button"
            disabled={busy}
            onClick={() => void shareQuote(finalQuote, finalWa)}
          >
            <MessageCircle size={16} />
            {messages.envoyerLeDevisDefinitif}
          </button>
        )}
        {admin && (
          <button
            className="button text danger small"
            disabled={busy || deleteBusy}
            onClick={() => {
              setDeleting(true);
            }}
          >
            <Trash2 size={16} />
            Supprimer définitivement
          </button>
        )}
      </div>
      {driverMode && <DriverCourseActions booking={b} onChange={onChange} />}
      {admin && b.driverFinishedAt && !terminal && (
        <div className="driver-course-complete" role="status">
          <p>
            Le chauffeur a signalé {trips.length} aller(s)-retour(s) terminé(s). Vérifiez les
            preuves avant la clôture.
          </p>
          {!finalQuote && (
            <p>
              Vous pouvez encore modifier la réservation. Enregistrez ensuite le devis final ; il
              verrouillera les modifications et permettra la clôture.
            </p>
          )}
          {finalQuote && (
            <p>
              Le devis final est enregistré et les modifications sont verrouillées. Clôturez la
              réservation pour terminer le dossier.
            </p>
          )}
          {incompleteTrips.length > 0 && (
            <p>
              Clôture indisponible : vérifiez la preuve de déchargement des courses{' '}
              {incompleteTrips.map((trip) => trip.sequence).join(', ')}.
            </p>
          )}
          {finalQuote && b.status !== 'in_progress' && (
            <p>Clôture indisponible : le statut actuel est « {statuses[b.status]} ».</p>
          )}
        </div>
      )}
      {!driverMode && !!b.trips?.length && (
        <section className="booking-trip-history">
          <h4>Preuves des courses ({b.trips.length})</h4>
          {b.trips.map((trip) => (
            <div className="booking-trip-proof" key={trip.id}>
              <strong>Course {trip.sequence}</strong>
              <div>
                <span>Chargement</span>
                {trip.loadingPhotos.map((photo, index) => (
                  <a key={`load-${index}`} href={photo} target="_blank" rel="noreferrer">
                    <img
                      src={photo}
                      alt={`Chargement, course ${trip.sequence}, photo ${index + 1}`}
                    />
                  </a>
                ))}
              </div>
              <div>
                <span>Déchargement</span>
                {trip.unloadingPhotos?.map((photo, index) => (
                  <a key={`unload-${index}`} href={photo} target="_blank" rel="noreferrer">
                    <img
                      src={photo}
                      alt={`Déchargement, course ${trip.sequence}, photo ${index + 1}`}
                    />
                  </a>
                )) ?? <em>En attente</em>}
              </div>
            </div>
          ))}
        </section>
      )}
      {editing && (
        <Modal
          titleId={'quote-title-' + b.id}
          busy={busy}
          onClose={() => setEditing(false)}
          className="account-dialog quote-dialog"
        >
          <form onSubmit={quote} className="quote-form">
            <div className="quote-modal-heading">
              <h2 id={'quote-title-' + b.id}>
                {messages.unNouveauDevisPour}
                {b.reference}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label={messages.fermer}
                title={messages.fermer}
                disabled={busy}
                onClick={() => setEditing(false)}
              >
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
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({
                          ...draft,
                          kind: event.target.value === 'final' ? 'final' : 'provisional',
                          trips:
                            event.target.value === 'final'
                              ? (b.trips?.length ?? draft.trips)
                              : draft.trips,
                        }))
                      }
                    >
                      <option value="provisional">{messages.provisoire}</option>
                      {(!!b.driverFinishedAt || last?.kind === 'final') && (
                        <option value="final">{messages.finalClotureLeDemenagement}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={'trips-' + b.id}>{messages.allersRetours}</label>
                    <input
                      name={quoteDraft.kind === 'final' ? undefined : 'trips'}
                      id={'trips-' + b.id}
                      type="number"
                      min={1}
                      max={quoteDraft.kind === 'final' ? 10000 : b.pricingSettings?.maxTrips}
                      step={1}
                      value={quoteDraft.trips}
                      disabled={quoteDraft.kind === 'final'}
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({ ...draft, trips: Number(event.target.value) }))
                      }
                      required
                    />
                    {quoteDraft.kind === 'final' && (
                      <input type="hidden" name="trips" value={quoteDraft.trips} />
                    )}
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
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({
                          ...draft,
                          customPrice: event.target.value ? Number(event.target.value) : null,
                        }))
                      }
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
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({
                          ...draft,
                          discount: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="quote-column">
                <label htmlFor={'notes-' + b.id}>{messages.noteDuDevis}</label>
                <textarea
                  name="notes"
                  id={'notes-' + b.id}
                  rows={3}
                  maxLength={2000}
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                />
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
              {(
                [
                  ['labour', messages.manUvres, messages.chargementEtDechargement],
                  ['desk', messages.montageDemontageDeBureau, messages.unMenuisierPourVosMeubles],
                  [
                    'wardrobe',
                    messages.montageDemontageDArmoire,
                    messages.demontageEtRemontageSurPlace,
                  ],
                  ['bed', messages.montageDemontageDeLit, messages.litDeuxPlaces],
                ] as const
              ).map(([key, label, description]) => {
                const price =
                  key === 'labour'
                    ? (quoteSettings?.labourPrice ?? 0)
                    : (quoteSettings?.assemblyPrice ?? 0);
                return (
                  <label key={key}>
                    <span>
                      <strong>{label}</strong>
                      <small>
                        {description} · {money(price)} / unité
                      </small>
                    </span>
                    <input
                      aria-label={label}
                      type="number"
                      min={0}
                      max={b.pricingSettings?.maxOptions ?? 20}
                      step={1}
                      value={quoteDraft.options[key]}
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({
                          ...draft,
                          options: { ...draft.options, [key]: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            <TollRateSelector
              lines={extraLines}
              onToggle={(line, selected) =>
                setExtraLines((current) =>
                  selected
                    ? [...current.filter((existing) => existing.id !== line.id), line]
                    : current.filter((existing) => existing.id !== line.id),
                )
              }
            />
            <div className="quote-live-total" aria-live="polite">
              <span>{messages.montantCalculeDuDevis}</span>
              <strong>
                {quotePreviewTotal === null ? messages.tarifAConvenir : money(quotePreviewTotal)}
              </strong>
            </div>
            <p className="caption">
              {b.driverFinishedAt && quoteDraft.kind === 'final'
                ? 'Vérifiez les trajets et les preuves, puis validez le devis final. Vous pourrez ensuite clôturer la réservation ; le devis final sera conservé avec elle.'
                : messages.unDevisFinalEstConserveSansModificationEt}
            </p>
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
