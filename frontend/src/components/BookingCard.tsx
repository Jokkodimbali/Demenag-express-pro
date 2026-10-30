import { uiText } from '../content/reference-ui-text';
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  Download,
  Eye,
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
import { BookingWorkPlan } from './BookingWorkPlan';
import { BookingRouteMap } from './BookingRouteMap';
import { TollRateSelector } from './TollRateSelector';
import { quotedServiceOptions } from '../application/services/quote-service-options';
import { messages } from '../content/fr';
import { money, statuses } from '../domain/format';
import { assemblyUnitPrice, labourUnitPrice } from '../domain/labour-price';
import { inventoryAssemblyLines } from '../domain/inventory-assembly';
import type { Booking } from '../domain/model';
import { useApp } from '../application/context';
import { bookingReminder } from '../application/services/booking-reminder';
import { BookingCardMain } from './BookingCardMain';
import { bookingClosure } from '../domain/booking-closure';
import { BookingPdfPreview } from './BookingPdfPreview';
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
  const { catalogue } = useApp();
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
    createPdf,
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
    recordReminder,
  } = useBookingCard({ booking: b, onChange, admin, editInitially, onDeleted });
  const trips = b.trips ?? [];
  const displayedQuote = finalQuote ?? last;
  const displayedPrice = displayedQuote?.price ?? b.estimate;
  const displayedOptions = quotedServiceOptions(b, displayedQuote);
  const inventoryMenuPreview = quoteSettings
    ? inventoryAssemblyLines(b.inventorySnapshot?.sourceInventory, quoteSettings)
    : [];
  const {
    clientPhoneLink,
    canSendReminder,
    daysUntilMove,
    reminderWhen,
    reminderReason,
    reminderHref,
    lastReminderLabel,
  } = bookingReminder(b, catalogue?.settings, terminal);
  const {
    blockers: bookingClosureBlockers,
    canClose: canCloseBooking,
    incompleteTrips,
  } = bookingClosure(b, Boolean(finalQuote));
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(b.date ?? '');
  const [scheduleSlot, setScheduleSlot] = useState(() =>
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.timeSlot) ? b.timeSlot : '',
  );
  const [editingNotes, setEditingNotes] = useState(false);
  const [bookingNotes, setBookingNotes] = useState(b.notes);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewName, setPdfPreviewName] = useState('');

  useEffect(
    () => () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    },
    [pdfPreviewUrl],
  );

  async function previewQuote() {
    const blob = await createPdf(displayedQuote);
    if (!blob) return;
    const nextUrl = URL.createObjectURL(blob);
    setPdfPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
    setPdfPreviewName(`${displayedQuote?.reference || b.reference}.pdf`);
  }

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
      <BookingCardMain
        booking={b}
        admin={admin}
        driverMode={driverMode}
        clientPhoneLink={clientPhoneLink}
        finalQuote={finalQuote}
        terminal={terminal}
        editingSchedule={editingSchedule}
        setEditingSchedule={setEditingSchedule}
        scheduleDate={scheduleDate}
        setScheduleDate={setScheduleDate}
        scheduleSlot={scheduleSlot}
        setScheduleSlot={setScheduleSlot}
        saveSchedule={saveSchedule}
        busy={busy}
        displayedQuote={displayedQuote}
        displayedPrice={displayedPrice}
      />
      {(admin || driverMode) && (
        <BookingRouteMap
          booking={b}
          admin={admin && !finalQuote}
          onChange={admin && !finalQuote ? onChange : undefined}
        />
      )}
      <div className="booking-plan-toggle-wrap">
        <button
          type="button"
          className="button secondary small booking-plan-toggle"
          aria-expanded={planningOpen}
          onClick={() => setPlanningOpen((value) => !value)}
        >
          <CalendarClock size={16} />
          {planningOpen ? 'Fermer le planning' : 'Ouvrir le planning'}
          {b.workPlan?.length ? (
            <span>
              {b.workPlan.length} {uiText['etapes']}
            </span>
          ) : null}
        </button>
      </div>
      {planningOpen && (
        <BookingWorkPlan booking={b} admin={admin} driverMode={driverMode} onChange={onChange} />
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
                  <th>{uiText['prestation']}</th>
                  <th>{uiText['qte']}</th>
                  <th>{uiText['prixUnitaire']}</th>
                  <th>{uiText['montant2']}</th>
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
                    <td colSpan={3}>{displayedPrice.discountLabel ?? 'Remise'}</td>
                    <td>−{money(displayedPrice.discount)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>{uiText['total2']}</th>
                  <th>{money(displayedPrice.total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
          {!!displayedQuote?.tolls?.length && (
            <div className="booking-toll-summary">
              <div className="booking-toll-heading">
                <strong>{uiText['peagesAVOTRECHARGE']}</strong>
                <span>{uiText['nonINCLUSDANSLETOTAL']}</span>
              </div>
              {displayedQuote.tolls.map((line, index) => (
                <div className="booking-toll-line" key={`${line.tollPointId}-${index}`}>
                  <span>{line.label}</span>
                  <span>
                    {line.quantity} {uiText['passageS']}
                  </span>
                  <strong>{money(line.quantity * line.unitPrice)}</strong>
                </div>
              ))}
              <div className="booking-toll-total">
                <strong>{uiText['totalPeages']}</strong>
                <strong>
                  {money(
                    displayedQuote.tolls.reduce(
                      (sum, line) => sum + line.quantity * line.unitPrice,
                      0,
                    ),
                  )}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
      {!!b.questionnaireAnswers?.length && (
        <section className="booking-precision booking-client-questionnaire">
          <strong>{uiText['questionnaireClient']}</strong>
          {b.questionnaireAnswers.map((answer) => (
            <div key={answer.questionId}>
              <span>{answer.question}</span>
              <strong>{answer.answer}</strong>
            </div>
          ))}
        </section>
      )}
      {admin && (
        <section className="booking-precision">
          <div className="booking-precision-heading">
            <strong>{uiText['noteDePrecision']}</strong>
            {!editingNotes && !terminal && !finalQuote && (
              <button
                className="button text small"
                type="button"
                onClick={() => {
                  setBookingNotes(b.notes);
                  setEditingNotes(true);
                }}
              >
                {uiText['modifier']}
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
                aria-label={uiText['noteDePrecisionDeLaReservation']}
                rows={3}
                maxLength={2000}
                value={bookingNotes}
                onChange={(event) => setBookingNotes(event.target.value)}
                placeholder={uiText['ajouterUnePrecisionPourCetteReservation']}
              />
              <div className="booking-precision-actions">
                <button className="button primary small" type="submit" disabled={busy}>
                  <Save size={15} /> {uiText['enregistrer2']}
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
                  <X size={15} /> {uiText['annuler2']}
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
          onClick={() => void previewQuote()}
        >
          <Eye size={16} /> {uiText['apercuDuDevisPDF']}
        </button>
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
        {admin && b.status === 'in_progress' && (
          <button
            className="button primary small"
            type="button"
            disabled={busy || !canCloseBooking}
            onClick={() => void change('completed')}
          >
            <Check size={16} /> {uiText['cloturerLaReservation']}
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
        {admin && canSendReminder && (
          <a
            className="button secondary small"
            href={reminderHref}
            target="_blank"
            rel="noopener noreferrer"
            title={`Message : rendez-vous ${reminderWhen}`}
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) {
                event.preventDefault();
                return;
              }
              void recordReminder();
            }}
          >
            <Bell size={16} />
            {uiText['rappel']}{' '}
            {daysUntilMove === 0
              ? 'aujourd’hui'
              : daysUntilMove === 1
                ? 'demain'
                : `J-${daysUntilMove}`}
          </a>
        )}
        {admin && !canSendReminder && (
          <span className="caption booking-reminder-disabled" title={reminderReason}>
            {uiText['rappelIndisponible']}
            {reminderReason}
          </span>
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
        {admin && !finalQuote && (
          <button
            className="button text danger small"
            disabled={busy || deleteBusy}
            onClick={() => {
              setDeleting(true);
            }}
          >
            <Trash2 size={16} />
            {uiText['supprimerDefinitivement']}
          </button>
        )}
      </div>
      {admin && lastReminderLabel && (
        <p className="caption booking-reminder-status" role="status">
          {lastReminderLabel}
        </p>
      )}
      {admin && b.status === 'in_progress' && !canCloseBooking && (
        <p className="caption booking-close-hint" role="status">
          {uiText['pourCloturer']}
          {bookingClosureBlockers.join(' ; ')}.
        </p>
      )}
      <BookingPdfPreview
        bookingId={b.id}
        url={pdfPreviewUrl}
        fileName={pdfPreviewName}
        busy={busy}
        onClose={() => setPdfPreviewUrl('')}
      />
      {driverMode && <DriverCourseActions booking={b} onChange={onChange} />}
      {admin &&
        ['confirmed', 'in_progress'].includes(b.status) &&
        !finalQuote &&
        !b.driverFinishedAt && <DriverCourseActions booking={b} onChange={onChange} adminMode />}
      {admin && b.driverFinishedAt && !terminal && (
        <div className="driver-course-complete" role="status">
          <p>
            {trips.length > 0
              ? `${admin ? 'L’administration a' : 'Le chauffeur a'} signalé ${trips.length} aller(s)-retour(s) terminé(s).`
              : 'Les courses sont signalées comme terminées.'}{' '}
            {uiText['verifiezLeDossierAvantLaCloture']}
          </p>
          {!finalQuote && <p>{uiText['vousPouvezEncoreModifierLaReservationEnregistrezEnsuit']}</p>}
          {finalQuote && <p>{uiText['leDevisFinalEstEnregistreEtLesModificationsSontVerroui']}</p>}
          {incompleteTrips.length > 0 && (
            <p>
              {uiText['clotureIndisponibleTerminezLesCourses']}{' '}
              {incompleteTrips.map((trip) => trip.sequence).join(', ')}.
            </p>
          )}
          {finalQuote && b.status !== 'in_progress' && (
            <p>
              {uiText['clotureIndisponibleLeStatutActuelEst']}
              {statuses[b.status]} ».
            </p>
          )}
        </div>
      )}
      {!driverMode && !!b.trips?.length && (
        <section className="booking-trip-history">
          <h4>
            {uiText['coursesEtPreuves']}
            {b.trips.length})
          </h4>
          {b.trips.map((trip) => (
            <div className="booking-trip-proof" key={trip.id}>
              <strong>
                {uiText['course']}
                {trip.sequence}
              </strong>
              <div>
                <span>{uiText['chargement2']}</span>
                {trip.loadingPhotos.length ? (
                  trip.loadingPhotos.map((photo, index) => (
                    <a key={`load-${index}`} href={photo} target="_blank" rel="noreferrer">
                      <img
                        src={photo}
                        alt={`Chargement, course ${trip.sequence}, photo ${index + 1}`}
                      />
                    </a>
                  ))
                ) : (
                  <em>{uiText['aucunePhotoEnregistree']}</em>
                )}
              </div>
              <div>
                <span>{uiText['dechargement']}</span>
                {trip.unloadingPhotos?.length ? (
                  trip.unloadingPhotos.map((photo, index) => (
                    <a key={`unload-${index}`} href={photo} target="_blank" rel="noreferrer">
                      <img
                        src={photo}
                        alt={`Déchargement, course ${trip.sequence}, photo ${index + 1}`}
                      />
                    </a>
                  ))
                ) : (
                  <em>{trip.finishedAt ? 'Aucune photo enregistrée' : 'En attente'}</em>
                )}
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
                      max={
                        quoteDraft.kind === 'final'
                          ? 10000
                          : (catalogue?.settings.maxTrips ?? b.pricingSettings?.maxTrips)
                      }
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
                    <label htmlFor={'discountType-' + b.id}>{uiText['typeDeRemise']}</label>
                    <select
                      name="discountType"
                      id={'discountType-' + b.id}
                      value={quoteDraft.discountType}
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({
                          ...draft,
                          discountType: event.target.value as 'fcfa' | 'pct',
                        }))
                      }
                    >
                      <option value="fcfa">{uiText['fcfa']}</option>
                      <option value="pct">{uiText['pourcentage']}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={'discount-' + b.id}>
                      {uiText['remise3']}
                      {quoteDraft.discountType === 'pct' ? '%' : 'FCFA'})
                    </label>
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
                  <div>
                    <label htmlFor={'discountReason-' + b.id}>{uiText['motifDeLaRemise']}</label>
                    <input
                      name="discountReason"
                      id={'discountReason-' + b.id}
                      type="text"
                      maxLength={200}
                      value={quoteDraft.discountReason}
                      onChange={(event) =>
                        setQuoteDraft((draft) => ({ ...draft, discountReason: event.target.value }))
                      }
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
              <h3>{uiText['prestationsInclusesAuDevis']}</h3>
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
                    ? quoteSettings
                      ? labourUnitPrice(quoteSettings, b.workAccess)
                      : 0
                    : quoteSettings
                      ? assemblyUnitPrice(
                          quoteSettings,
                          key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
                        )
                      : 0;
                return (
                  <label key={key}>
                    <span>
                      <strong>{label}</strong>
                      <small>
                        {description} · {money(price)} {uiText['unite']}
                      </small>
                    </span>
                    <input
                      aria-label={label}
                      type="number"
                      min={0}
                      max={catalogue?.settings.maxOptions ?? b.pricingSettings?.maxOptions ?? 20}
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
            {inventoryMenuPreview.length > 0 && (
              <div className="quote-inventory-services">
                <h4>{uiText['demontageMontageSelonLInventaire']}</h4>
                {inventoryMenuPreview.map((line) => (
                  <div key={line.label}>
                    <span>
                      {line.quantity} × {line.label}
                    </span>
                    <strong>{money(line.quantity * line.unitPrice)}</strong>
                  </div>
                ))}
              </div>
            )}
            <TollRateSelector
              lines={extraLines}
              vehicleId={b.vehicle.id}
              onToggle={(line, selected) =>
                setExtraLines((current) =>
                  selected
                    ? [...current.filter((existing) => existing.id !== line.id), line]
                    : current.filter((existing) => existing.id !== line.id),
                )
              }
            />
            <p className="caption">
              {uiText['lesPeagesSontALaChargeDuClientEtExclusDuTotalDuDevis']}
            </p>
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
