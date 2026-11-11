import { visibleUiText } from '../content/visible-ui-text';
import { uiText } from '../content/reference-ui-text';
import { ChevronDown } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { normalizedClientPhone } from '../application/services/client-summary';
import { CallInventory } from '../components/booking/CallInventory';
import { FleetVehicleImagePreview } from '../components/FleetVehicleDimensions';
import { AdminQuoteQuestionnaire } from '../components/AdminQuoteQuestionnaire';
import { TollRateSelector } from '../components/TollRateSelector';
import { dateLabel, money, referenceTierLabels } from '../application/presentation/format';
import { today } from '../domain/date';
import { bookingInventorySnapshot, formatDuration } from '../domain/moving-estimate';
import { BookingConfirmation } from '../components/booking/BookingConfirmation';
import { routes } from '../routing/routes';
import { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import { AdminCreateQuoteAside } from '../components/AdminCreateQuoteAside';
import { AdminQuoteVehicleBilling } from '../components/AdminQuoteVehicleBilling';
import { AdminQuoteSettings } from '../components/AdminQuoteSettings';
import { AdminQuoteSaveBar } from '../components/AdminQuoteSaveBar';
import { AdminQuoteStepHeading } from '../components/AdminQuoteStepHeading';
import { AdminQuoteStep } from '../components/AdminQuoteStep';
import { LoadingSimulation } from '../components/booking/LoadingSimulation';
import { adminQuoteVehicleText as quoteText } from '../content/admin-quote-vehicle';
import { quoteConditionsText } from '../application/services/whatsapp-templates';
import { normalizePhoneNumber, sanitizePhoneInput } from '../domain/phone-number';

const RouteMap = lazy(() => import('../components/RouteMap'));

export function AdminCreateQuote({ publicRequest = false }: { publicRequest?: boolean }) {
  const model = useAdminCreateQuoteModel(publicRequest);
  const [activeStep, setActiveStep] = useState(1);
  const {
    editingReservation,
    editingBooking,
    quoteHandoffError,
    resetVersion,
    quoteConfig,
    setQuoteConfig,
    questionnaireOpen,
    setQuestionnaireOpen,
    quoteKind,
    setStageError,
    openQuoteSections,
    setOpenQuoteSections,
    googleMapsKey,
    traffic,
    trafficBusy,
    trafficError,
    trafficDuration,
    state,
    editingLocked,
    pricingSnapshotBusy,
    pricingSnapshotError,
    applyCurrentPricingSnapshot,
    quoteSettings,
    quoteTollPoints,
    user,
    catalogue,
    loading,
    error,
    reload,
    draft,
    setDraft,
    selected,
    done,
    submit,
    tollLines,
    extras,
    clientRecognition,
    recognizingClient,
    editLoading,
    editError,
    estimateInventory,
    route,
    refreshTraffic,
    trafficDelay,
    trafficColor,
    movingEstimate,
    questionnaire,
    visibleInventoryText,
    estimateText,
    questionnaireText,
    totalTolls,
    tiers,
    effectiveDistance,
    previewTier,
    previewSubtotal,
    previewDiscount,
    manoeuvreOvertimeLine,
    confirmVehicleFit,
    onTollToggle,
    changeQuoteOption,
    toggleQuoteSection,
  } = model;
  useEffect(() => setActiveStep(1), [resetVersion]);
  const openStep = (step: number) => {
    if (step === 1) setOpenQuoteSections((current) => ({ ...current, client: true }));
    if (step === 2) setOpenQuoteSections((current) => ({ ...current, route: true }));
    if (step <= 5) setActiveStep(step);
    window.requestAnimationFrame(() => {
      const target =
        step === 6
          ? document.querySelector('.admin-quote-aside')
          : document.querySelector(`[data-step="${step}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const toggleStep = (step: number) => {
    const next = activeStep === step ? 0 : step;
    if (next === 1) setOpenQuoteSections((sections) => ({ ...sections, client: true }));
    if (next === 2) setOpenQuoteSections((sections) => ({ ...sections, route: true }));
    setActiveStep(next);
  };
  const toggleAllSteps = () => {
    if (activeStep === -1) {
      setActiveStep(1);
      return;
    }
    setOpenQuoteSections((sections) => ({ ...sections, client: true, route: true }));
    setActiveStep(-1);
  };
  const stepSummary = {
    client: [
      draft.customerName.trim() || 'Nom du client à saisir',
      draft.customerPhone,
      draft.noDate
        ? 'date à fixer'
        : draft.date
          ? `${dateLabel(draft.date)}${draft.timeSlot ? ` à ${draft.timeSlot}` : ''}`
          : 'date à choisir',
    ]
      .filter(Boolean)
      .join(' · '),
    route:
      draft.fromAddress || draft.toAddress
        ? `${draft.fromAddress || '?'} → ${draft.toAddress || '?'}${effectiveDistance ? ` · ${String(effectiveDistance).replace('.', ',')} km` : ''}`
        : 'Adresses de départ et d’arrivée',
    inventory:
      model.inventoryCount > 0
        ? `${model.inventoryCount} objets · ${String(Math.round((movingEstimate?.volume ?? 0) * 10) / 10).replace('.', ',')} m³ · ${quoteConfig.trips} aller(s)-retour(s)`
        : 'Fiche d’appel à remplir',
    formula: `Formule ${quoteConfig.billingMode === 'complete' ? 'Complète' : quoteConfig.billingMode === 'standard' ? 'Standard' : 'Économique'} · ${selected && ['sprinter', 'master', 'trafic'].includes(selected.id) ? selected.id[0].toUpperCase() + selected.id.slice(1) : selected?.shortName || selected?.name || ''}${model.previewTotal == null ? '' : ` · ${money(model.previewTotal)}`}`,
    planning:
      model.inventoryCount > 0 && movingEstimate
        ? `Durée ${formatDuration(movingEstimate.totalMinutes)} · fin prévue ${movingEstimate.endTime} · ${movingEstimate.crew} manœuvres`
        : 'Après l’inventaire',
  };
  const enterManualCalculation = () => {
    const crew = Math.max(1, movingEstimate?.crew ?? draft.options.labour ?? 2);
    setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }));
    setDraft((current) => ({
      ...current,
      options: { ...current.options, labour: crew },
      inventory: { ...current.inventory, crew },
    }));
  };
  if (loading)
    return (
      <div className="panel loading" role="status">
        {uiText['chargementDuCatalogue']}
      </div>
    );
  if (publicRequest && done && catalogue)
    return (
      <div className="reference-request-page">
        <BookingConfirmation booking={done} settings={catalogue.settings} isClient />
      </div>
    );
  if (error || !catalogue || !selected)
    return (
      <div className="alert error" role="alert">
        {error || 'Catalogue indisponible.'}
        <button className="button secondary" onClick={reload}>
          {uiText['reessayer']}
        </button>
      </div>
    );
  if (publicRequest && catalogue.settings.bookingsEnabled === false && !editingReservation)
    return (
      <section className="reference-request-page">
        <div className="booking-closed" role="status" aria-live="polite">
          <p className="eyebrow">{uiText['formulaireDERESERVATION']}</p>
          <h3>{uiText['lesReservationsSontTemporairementFermees']}</h3>
          <Link className="button secondary" to={routes.home}>
            {uiText['retourALAccueil']}
          </Link>
        </div>
      </section>
    );
  return (
    <div className={`admin-quote-page${publicRequest ? ' reference-request-page' : ''}`}>
      {quoteHandoffError && (
        <p className="alert error" role="alert">
          {quoteHandoffError}
        </p>
      )}
      {publicRequest && (
        <div className="reference-request-heading">
          <div>
            <span>{uiText['reservation']}</span>
            <h2>{uiText['maDEMANDEDEDEMENAGEMENT']}</h2>
          </div>
          <Link
            className="reference-request-back"
            to={editingReservation ? routes.account : routes.home}
          >
            {editingReservation ? 'Retour à mon espace' : 'Retour à l’accueil'}
          </Link>
        </div>
      )}
      {editLoading && (
        <p className="panel loading" role="status">
          {uiText['chargementDeLaReservation']}
        </p>
      )}
      {editError && (
        <p className="alert error" role="alert">
          {editError}
        </p>
      )}
      {editingLocked && (
        <p className="alert error" role="status">
          {uiText['cetteReservationEstClotureeSonDevisResteConsultableMai']}
        </p>
      )}
      {editingReservation && editingBooking && user?.role === 'admin' && !editingLocked && (
        <section
          className="admin-quote-pricing-snapshot"
          aria-label={visibleUiText.pricingSnapshotHeading}
        >
          <p>{visibleUiText.pricingSnapshotNotice}</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => void applyCurrentPricingSnapshot()}
            disabled={pricingSnapshotBusy}
          >
            {pricingSnapshotBusy
              ? visibleUiText.pricingSnapshotBusy
              : visibleUiText.pricingSnapshotAction}
          </button>
          {pricingSnapshotError && (
            <p className="alert error" role="alert">
              {pricingSnapshotError}
            </p>
          )}
        </section>
      )}
      <form
        id="admin-quote-form"
        onSubmit={async (event) => {
          if (!normalizePhoneNumber(draft.customerPhone)) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Saisissez un numéro valide avec son indicatif international.');
            return;
          }
          if (publicRequest && !draft.date) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Choisissez une date.');
            return;
          }
          if (
            quoteKind === 'final' &&
            estimateInventory.stairs === 'balcon' &&
            !(Number(estimateInventory.balcPx) > 0)
          ) {
            event.preventDefault();
            setStageError('Passage par le balcon : fixez le supplément avant le devis final.');
            return;
          }
          if (
            quoteKind === 'final' &&
            previewTier === 3 &&
            !(Number(quoteConfig.customPrice) > 0)
          ) {
            event.preventDefault();
            setStageError(
              `Distance au-delà de ${(quoteSettings ?? catalogue.settings).distanceBounds[2]} km : fixez le prix par aller-retour avant le devis final.`,
            );
            return;
          }
          if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
            event.preventDefault();
            setStageError(
              'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
            );
            return;
          }
          event.preventDefault();
          if (!(await confirmVehicleFit())) return;
          setStageError('');
          void submit(
            event,
            [
              visibleInventoryText,
              estimateText,
              questionnaireText,
              quoteConditionsText(estimateInventory, quoteConfig.billingMode),
            ]
              .filter(Boolean)
              .join('\n'),
            (movingEstimate?.planning ?? []).map((step, index) => ({
              id: `plan-${index + 1}`,
              time: step.time,
              title: step.title,
              detail: step.detail,
              minutes: step.minutes,
            })),
            movingEstimate &&
              (visibleInventoryText || estimateInventory.ready || estimateInventory.stairs)
              ? bookingInventorySnapshot(estimateInventory, movingEstimate)
              : null,
            movingEstimate?.volume
              ? { ...draft.options, labour: movingEstimate.crew }
              : draft.options,
            manoeuvreOvertimeLine ? [manoeuvreOvertimeLine] : [],
          );
        }}
        className="admin-quote-layout"
      >
        <div className="admin-quote-fields">
          {!publicRequest && (
            <div className="admin-quote-expand-all">
              <button type="button" onClick={toggleAllSteps}>
                {activeStep === -1 ? 'Replier les étapes' : 'Tout afficher'}
              </button>
            </div>
          )}
          {publicRequest && (
            <section className="reference-request-vehicle">
              <span>{uiText['vehicule']}</span>
              <div className="reference-vehicle-list">
                {catalogue.vehicles
                  .filter((vehicle) => vehicle.active !== false)
                  .map((vehicle) => (
                    <button
                      type="button"
                      key={vehicle.id}
                      className={draft.vehicleId === vehicle.id ? 'selected' : ''}
                      aria-pressed={draft.vehicleId === vehicle.id}
                      onClick={() => setDraft((current) => ({ ...current, vehicleId: vehicle.id }))}
                    >
                      <img src={vehicle.image} alt="" />
                      <span>
                        <strong>
                          {vehicle.shortName || vehicle.name.replace(/\s+(?:III|IV)$/i, '')}
                        </strong>
                        <small>
                          {vehicle.volume} {uiText['des']}
                          {money(vehicle.prices[0])}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
              <div className="reference-vehicle-detail reference-request-vehicle-detail">
                <FleetVehicleImagePreview vehicle={selected} />
                <strong>{selected.name.toUpperCase()}</strong>
                <div className="reference-vehicle-facts">
                  <span className="volume">{selected.volume}</span>
                  <span>
                    {uiText['longueur']}
                    {selected.length}
                  </span>
                  <span>
                    {uiText['hauteur']}
                    {selected.height}
                  </span>
                  <span>
                    {uiText['largeur']}
                    {selected.width}
                  </span>
                  <span>
                    {uiText['passagesDeRoue']}
                    {selected.wheelWidth}
                  </span>
                </div>
                <div className="reference-prices">
                  {selected.prices.map((amount, index) => (
                    <span key={index}>
                      {
                        referenceTierLabels((quoteSettings ?? catalogue.settings).distanceBounds)[
                          index
                        ]
                      }{' '}
                      : <strong>{money(amount)}</strong>
                    </span>
                  ))}
                  <span>
                    {referenceTierLabels((quoteSettings ?? catalogue.settings).distanceBounds)[3]} :{' '}
                    <strong>{uiText['surDevis']}</strong>
                  </span>
                  <span>
                    {uiText['manœuvre']}
                    <strong>{money((quoteSettings ?? catalogue.settings).labourPrice)}</strong>{' '}
                    {uiText['pers']}
                  </span>
                  <span>
                    {uiText['menuisier']}
                    <strong>
                      {money((quoteSettings ?? catalogue.settings).assemblyPrice)}
                    </strong>{' '}
                    {uiText['meuble']}
                  </span>
                </div>
              </div>
            </section>
          )}
          <AdminQuoteStep
            number={1}
            title={quoteText.stepClient}
            summary={stepSummary.client}
            expanded={activeStep === -1 || activeStep === 1}
            onToggle={() => toggleStep(1)}
            onNext={() => openStep(2)}
            nextLabel="Suivant : trajet →"
            collapsible={!publicRequest}
          >
            <section className="admin-quote-card">
              <button
                className="admin-quote-section-toggle"
                type="button"
                aria-expanded={openQuoteSections.client}
                aria-controls="admin-quote-client-fields"
                onClick={() => toggleQuoteSection('client')}
              >
                <ChevronDown size={16} aria-hidden="true" />
                <span>
                  {state.editingBooking
                    ? `DEVIS POUR ${state.editingBooking.reference}`
                    : publicRequest
                      ? 'VOS INFORMATIONS'
                      : 'NOUVEAU DEVIS · CLIENT EN AGENCE'}
                </span>
              </button>
              {openQuoteSections.client && (
                <div id="admin-quote-client-fields">
                  <div className="admin-quote-identity">
                    <div className="admin-quote-client-name">
                      <input
                        required
                        maxLength={100}
                        value={draft.customerName}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, customerName: event.target.value }))
                        }
                        placeholder={uiText['nomDuClient']}
                        aria-label={uiText['nomDuClient']}
                      />
                    </div>
                    <div>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        maxLength={25}
                        value={draft.customerPhone}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            customerPhone: sanitizePhoneInput(event.target.value),
                          }))
                        }
                        placeholder={visibleUiText.text123}
                        aria-label={uiText['telephone']}
                      />
                    </div>
                    {!publicRequest && (
                      <div className="admin-quote-source">
                        <span>{uiText['commentLECLIENTNOUSACONNUS']}</span>
                        <div>
                          {[
                            'Facebook',
                            'YouTube',
                            'Instagram',
                            'Snapchat',
                            'TikTok',
                            'Autre pub',
                            'Bouche-à-oreille',
                            'Client fidèle',
                            'Autre',
                          ].map((source) => {
                            const selected = draft.source === source;
                            return (
                              <button
                                type="button"
                                key={source}
                                className={selected ? 'selected' : ''}
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    source: selected ? '' : source,
                                  }))
                                }
                              >
                                {source}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="admin-quote-date-control">
                      {!draft.noDate && (
                        <input
                          type="date"
                          min={editingReservation ? undefined : today()}
                          value={draft.date}
                          aria-label={uiText['datePrevue']}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              date: event.target.value,
                              month: event.target.value
                                ? event.target.value.slice(0, 7)
                                : current.month,
                            }))
                          }
                        />
                      )}
                      {draft.noDate && state.administrativeQuote && (
                        <input
                          type="month"
                          required
                          value={draft.month}
                          aria-label={uiText['moisSouhaite']}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, month: event.target.value }))
                          }
                        />
                      )}
                      {state.administrativeQuote && (
                        <label className="admin-quote-no-date">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.noDate)}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                noDate: event.target.checked,
                                date: event.target.checked ? '' : current.date,
                                timeSlot: event.target.checked ? '' : current.timeSlot,
                              }))
                            }
                          />
                          <span>{uiText['dateADefinirMoisSeulement']}</span>
                        </label>
                      )}
                    </div>
                    <label className="admin-quote-start-time">
                      <span>{uiText['debut']}</span>
                      <input
                        type="time"
                        required={Boolean(draft.date)}
                        value={draft.timeSlot}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, timeSlot: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  {recognizingClient && (
                    <p className="muted" role="status">
                      {uiText['verificationDuClient']}
                    </p>
                  )}
                  {clientRecognition &&
                    clientRecognition.phone === normalizedClientPhone(draft.customerPhone) && (
                      <p className="client-recognition">
                        {uiText['clientDejaConnu']}
                        {clientRecognition.name} · {clientRecognition.bookingCount}{' '}
                        {uiText['reservationS']}
                      </p>
                    )}
                </div>
              )}
            </section>
          </AdminQuoteStep>
          <AdminQuoteStep
            number={2}
            title={quoteText.stepRoute}
            summary={stepSummary.route}
            expanded={activeStep === -1 || activeStep === 2}
            onToggle={() => toggleStep(2)}
            onNext={() => openStep(3)}
            nextLabel="Suivant : inventaire →"
            collapsible={!publicRequest}
          >
            <section
              className={`admin-quote-card${publicRequest ? ' reference-request-route-card' : ''}`}
            >
              <button
                className="admin-quote-section-toggle"
                type="button"
                aria-expanded={openQuoteSections.route}
                aria-controls="admin-quote-route-fields"
                onClick={() => toggleQuoteSection('route')}
              >
                <ChevronDown size={16} aria-hidden="true" />
                <span>{uiText['trajetCARTE']}</span>
              </button>
              {openQuoteSections.route && (
                <div id="admin-quote-route-fields">
                  <Suspense
                    fallback={<div className="map loading">{uiText['chargementDeLaCarte']}</div>}
                  >
                    <RouteMap
                      key={resetVersion}
                      {...(!publicRequest ? { tollLines, onTollToggle } : {})}
                      adminQuote
                      fromNote={draft.fromNote}
                      toNote={draft.toNote}
                      onNoteChange={(side, value) =>
                        setDraft((current) => ({
                          ...current,
                          [side === 'from' ? 'fromNote' : 'toNote']: value,
                        }))
                      }
                    />
                  </Suspense>
                  <a
                    className="button secondary small admin-quote-map-link"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(draft.from?.join(',') || draft.fromAddress || 'Dakar')}&destination=${encodeURIComponent(draft.to?.join(',') || draft.toAddress || 'Dakar')}&travelmode=driving`}
                  >
                    {uiText['verifierDansGoogleMaps']}
                  </a>
                  <label className="admin-quote-distance-editor">
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.1"
                      placeholder={uiText['distanceKm']}
                      value={effectiveDistance ?? ''}
                      disabled={!draft.route && !publicRequest}
                      aria-label={uiText['distanceDuTrajetEnKilometres']}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          distanceKmOverride:
                            event.target.value === '' ? null : Number(event.target.value),
                        }))
                      }
                    />
                    <span>
                      {uiText['calculeeParLItineraireModifiableTrancheAppliquee']}{' '}
                      <strong>{draft.route ? tiers[previewTier] : '—'}</strong>
                    </span>
                  </label>
                  {draft.from && draft.to && (
                    <div className="admin-quote-traffic" role="status">
                      <span aria-hidden="true" style={{ background: trafficColor }} />
                      <strong>
                        {!googleMapsKey
                          ? 'Trafic en direct inactif'
                          : traffic
                            ? `Trajet avec trafic : ${trafficDuration(traffic.minutes)}`
                            : trafficError
                              ? 'Trafic indisponible'
                              : 'Calcul du trafic…'}
                      </strong>
                      <small>
                        {!googleMapsKey
                          ? 'Ajoutez votre clé Google Maps dans Paramètres.'
                          : traffic
                            ? `${traffic.future ? 'Prévision Google pour le départ prévu' : 'Google, trafic actuel'}${trafficDelay > 0 ? ` · +${trafficDuration(trafficDelay)} de bouchons` : ''} · mis à jour à ${new Date(traffic.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                            : trafficError
                              ? 'Vérifiez la clé et l’activation de Distance Matrix.'
                              : ''}
                      </small>
                      <button
                        type="button"
                        disabled={!publicRequest && (!googleMapsKey || !route || trafficBusy)}
                        onClick={() => void refreshTraffic()}
                      >
                        {uiText['actualiser']}
                      </button>
                    </div>
                  )}
                  {draft.route && previewTier === 3 && (
                    <input
                      className="admin-quote-custom-price"
                      aria-label={uiText['prixParAllerRetourAuDelaDe35Km']}
                      placeholder={uiText['prixParAllerRetourAuDelaDe35Km']}
                      type="number"
                      min={1}
                      max={10000000}
                      value={quoteConfig.customPrice ?? ''}
                      onChange={(event) =>
                        setQuoteConfig((current) => ({
                          ...current,
                          customPrice: event.target.value
                            ? Math.max(1, Number(event.target.value))
                            : null,
                        }))
                      }
                    />
                  )}
                </div>
              )}
            </section>
          </AdminQuoteStep>
          <AdminQuoteStep
            number={3}
            title={quoteText.stepInventory}
            summary={stepSummary.inventory}
            expanded={activeStep === -1 || activeStep === 3}
            onToggle={() => toggleStep(3)}
            onNext={() => openStep(4)}
            nextLabel="Suivant : formule et prix →"
            collapsible={!publicRequest}
          >
            <CallInventory
              draft={draft}
              setDraft={setDraft}
              maxOptions={(quoteSettings ?? catalogue.settings).maxOptions}
              vehicles={catalogue.vehicles}
              selectedVehicleId={draft.vehicleId}
              quoteTrips={quoteConfig.trips}
              maxTrips={(quoteSettings ?? catalogue.settings).maxTrips}
              laborPlanning={(quoteSettings ?? catalogue.settings).movingLaborPlanning}
              ignoreTraffic={quoteConfig.trafficOff}
              manualLegMinutes={quoteConfig.calcMode === 'manual' ? quoteConfig.legMinutes : 0}
              hasToll={tollLines.some((line) => line.quantity * line.unitPrice > 0)}
              onManualCalculation={enterManualCalculation}
              heatOff={quoteConfig.heatOff}
              heatRest={quoteConfig.heatRest}
              onHeatChange={
                publicRequest
                  ? undefined
                  : (value) => setQuoteConfig((current) => ({ ...current, ...value }))
              }
              audience={publicRequest ? 'client' : 'admin'}
              referenceMode={publicRequest}
              estimateInventory={estimateInventory}
              onApplyEstimate={(vehicleId, trips) => {
                setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
                setQuoteConfig((current) =>
                  current.calcMode === 'manual' ? current : { ...current, trips },
                );
              }}
            />
          </AdminQuoteStep>
          <AdminQuoteStep
            number={4}
            title={quoteText.stepFormula}
            summary={stepSummary.formula}
            expanded={activeStep === -1 || activeStep === 4}
            onToggle={() => toggleStep(4)}
            onNext={() => openStep(5)}
            nextLabel="Suivant : planning et 3D →"
            collapsible={!publicRequest}
            showHeading={false}
          >
            {!publicRequest && <AdminQuoteSettings model={model} catalogue={catalogue} />}
            {!publicRequest && (
              <>
                <section className="admin-quote-card admin-quote-vehicle-panel">
                  <span className="admin-quote-vehicle-label">{quoteText.vehicle}</span>
                  <div
                    className="admin-quote-vehicle-choices admin-quote-vehicle-choices-compact"
                    role="group"
                    aria-label={quoteText.vehicle}
                  >
                    {catalogue.vehicles
                      .filter((vehicle) => vehicle.active !== false)
                      .map((vehicle) => (
                        <button
                          type="button"
                          key={vehicle.id}
                          aria-pressed={draft.vehicleId === vehicle.id}
                          className={draft.vehicleId === vehicle.id ? 'active' : ''}
                          onClick={() =>
                            setDraft((current) => ({ ...current, vehicleId: vehicle.id }))
                          }
                        >
                          {vehicle.shortName || vehicle.name}
                        </button>
                      ))}
                  </div>
                </section>
                <AdminQuoteVehicleBilling model={model} catalogue={catalogue} />
              </>
            )}
            {publicRequest && <AdminQuoteStepHeading number={5} title={quoteText.stepOptions} />}
            {!publicRequest && (
              <section className="admin-quote-card">
                <div className="admin-quote-card-head">
                  <button
                    className="admin-quote-section-toggle"
                    type="button"
                    aria-expanded={openQuoteSections.tolls}
                    aria-controls="admin-quote-toll-fields"
                    onClick={() => toggleQuoteSection('tolls')}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                    <span>{uiText['peages']}</span>
                  </button>
                  <strong>{totalTolls ? money(totalTolls) : ''}</strong>
                </div>
                {openQuoteSections.tolls && (
                  <div id="admin-quote-toll-fields">
                    <TollRateSelector
                      lines={tollLines}
                      onToggle={onTollToggle}
                      roundTrips={quoteConfig.trips}
                      points={quoteTollPoints}
                    />
                  </div>
                )}
              </section>
            )}

            <section
              className={`admin-quote-card admin-quote-services${publicRequest ? ' reference-request-options' : ''}`}
            >
              <button
                className="admin-quote-section-toggle"
                type="button"
                aria-expanded={openQuoteSections.options}
                aria-controls="admin-quote-option-fields"
                onClick={() => toggleQuoteSection('options')}
              >
                <ChevronDown size={16} aria-hidden="true" />
                <span>{uiText['optionsETQUANTITES']}</span>
              </button>
              {openQuoteSections.options && (
                <div id="admin-quote-option-fields" className="admin-quote-option-fields">
                  {(publicRequest || quoteConfig.billingMode !== 'driver-rental') && (
                    <>
                      <div className="admin-quote-service-row">
                        <strong>{uiText['allersRetours']}</strong>
                        <div className="admin-quote-stepper">
                          <button
                            type="button"
                            aria-label={uiText['retirerUnAllerRetour']}
                            disabled={quoteConfig.trips <= 1}
                            onClick={() => {
                              const trips = Math.max(1, quoteConfig.trips - 1);
                              enterManualCalculation();
                              setQuoteConfig((current) => ({
                                ...current,
                                trips,
                              }));
                              if (publicRequest)
                                setDraft((current) => ({ ...current, estimatedTrips: trips }));
                            }}
                          >
                            −
                          </button>
                          <output>{quoteConfig.trips}</output>
                          <button
                            type="button"
                            aria-label={uiText['ajouterUnAllerRetour']}
                            disabled={
                              quoteConfig.trips >= (quoteSettings ?? catalogue.settings).maxTrips
                            }
                            onClick={() => {
                              const trips = Math.min(
                                (quoteSettings ?? catalogue.settings).maxTrips,
                                quoteConfig.trips + 1,
                              );
                              enterManualCalculation();
                              setQuoteConfig((current) => ({
                                ...current,
                                trips,
                              }));
                              if (publicRequest)
                                setDraft((current) => ({ ...current, estimatedTrips: trips }));
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {extras
                        .filter(
                          ([key]) =>
                            quoteConfig.billingMode === 'complete' ||
                            (quoteConfig.billingMode === 'driver-rental' &&
                              quoteConfig.menuIncluded) ||
                            key === 'labour',
                        )
                        .map(([key, label]) => (
                          <div className="admin-quote-service-row" key={key}>
                            <strong>
                              {key === 'labour'
                                ? 'Manœuvres'
                                : key === 'desk'
                                  ? 'Montage/démontage bureau'
                                  : key === 'wardrobe'
                                    ? 'Montage/démontage armoire'
                                    : 'Montage/démontage lit 2 places'}
                            </strong>
                            <div className="admin-quote-stepper">
                              <button
                                type="button"
                                aria-label={`Retirer ${label}`}
                                disabled={
                                  draft.options[key] === 0 ||
                                  (key === 'labour' &&
                                    Boolean(movingEstimate?.volume) &&
                                    draft.options.labour <= 1)
                                }
                                onClick={() => changeQuoteOption(key, -1)}
                              >
                                −
                              </button>
                              <output>{draft.options[key]}</output>
                              <button
                                type="button"
                                aria-label={`Ajouter ${label}`}
                                disabled={
                                  draft.options[key] >=
                                  (quoteSettings ?? catalogue.settings).maxOptions
                                }
                                onClick={() => changeQuoteOption(key, 1)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                    </>
                  )}
                  {!publicRequest && (
                    <div className="admin-quote-options-bottom">
                      <div className="admin-quote-discount-panel">
                        <div className="admin-quote-discount-heading">
                          <strong>{uiText['remise']}</strong>
                          {quoteConfig.discount > 0 && (
                            <span>
                              − {money(previewDiscount)} {uiText['sur']}
                              {money(previewSubtotal)}
                            </span>
                          )}
                        </div>
                        <div className="admin-quote-discount-entry">
                          <input
                            type="number"
                            min={0}
                            value={quoteConfig.discount || ''}
                            aria-label={uiText['remise2']}
                            placeholder={
                              quoteConfig.discountType === 'pct' ? 'Remise en %' : 'Remise en FCFA'
                            }
                            onChange={(event) =>
                              setQuoteConfig((current) => ({
                                ...current,
                                discount: Math.max(0, Number(event.target.value) || 0),
                              }))
                            }
                          />
                          <div
                            className="admin-quote-discount-types"
                            role="group"
                            aria-label={uiText['typeDeRemise']}
                          >
                            {(['fcfa', 'pct'] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                className={quoteConfig.discountType === type ? 'selected' : ''}
                                aria-pressed={quoteConfig.discountType === type}
                                onClick={() =>
                                  setQuoteConfig((current) => ({ ...current, discountType: type }))
                                }
                              >
                                {type === 'fcfa' ? 'FCFA' : '%'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          className="admin-quote-discount-reason-input"
                          type="text"
                          maxLength={200}
                          value={quoteConfig.discountReason}
                          placeholder={uiText['motifDeLaRemise']}
                          aria-label={uiText['motifDeLaRemise']}
                          onChange={(event) =>
                            setQuoteConfig((current) => ({
                              ...current,
                              discountReason: event.target.value,
                            }))
                          }
                        />
                        <div
                          className="admin-quote-discount-reasons"
                          aria-label={uiText['motifsDeRemiseProposes']}
                        >
                          {['Client fidèle', 'Promotion', 'Geste commercial', 'Parrainage'].map(
                            (reason) => (
                              <button
                                type="button"
                                key={reason}
                                aria-pressed={quoteConfig.discountReason === reason}
                                onClick={() =>
                                  setQuoteConfig((current) => ({
                                    ...current,
                                    discountReason: reason,
                                  }))
                                }
                              >
                                {reason}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                      <textarea
                        className="admin-quote-free-note"
                        aria-label={uiText['remarqueLibre']}
                        rows={3}
                        maxLength={2000}
                        value={draft.notes}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder={uiText['remarqueLibreAjouteeSousLInventaireDeLaFicheDAppel']}
                      />
                    </div>
                  )}
                  {publicRequest && (
                    <textarea
                      className="admin-quote-free-note"
                      aria-label={uiText['remarqueLibre']}
                      rows={3}
                      maxLength={2000}
                      value={draft.notes}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder={uiText['precisionsUtilesEtagesAscenseurAccesAuCamionObjetsFrag']}
                    />
                  )}
                </div>
              )}
            </section>
          </AdminQuoteStep>
          {!publicRequest && (
            <AdminQuoteQuestionnaire
              questions={questionnaire}
              draft={draft}
              setDraft={setDraft}
              open={questionnaireOpen}
              onToggle={() => setQuestionnaireOpen((value) => !value)}
            />
          )}
          {!publicRequest && (
            <AdminQuoteStep
              number={5}
              title={quoteText.stepPlanning}
              summary={stepSummary.planning}
              expanded={activeStep === -1 || activeStep === 5}
              onToggle={() => toggleStep(5)}
              onNext={() => openStep(6)}
              nextLabel="Suivant : vérifier et envoyer →"
              collapsible
            >
              <LoadingSimulation
                draft={draft}
                vehicles={catalogue.vehicles}
                quoteConfig={quoteConfig}
                crew={movingEstimate?.crew ?? 2}
                estimate={movingEstimate}
                setDraft={setDraft}
                setQuoteConfig={setQuoteConfig}
                onPlanNeeds={model.setSimulationNeeds}
              />
              {model.inventoryCount === 0 && (
                <span className="admin-quote-plan-empty">
                  Remplissez l’inventaire pour voir la simulation de chargement et la fatigue de
                  l’équipe.
                </span>
              )}
            </AdminQuoteStep>
          )}
        </div>

        <AdminCreateQuoteAside
          model={model}
          publicRequest={publicRequest}
          catalogue={catalogue}
          selected={selected}
        />
        {!publicRequest && (
          <AdminQuoteSaveBar
            quoteKind={quoteKind}
            total={model.previewTotal}
            trips={quoteConfig.trips}
            movingEstimate={model.inventoryCount > 0 ? movingEstimate : null}
            driverRental={quoteConfig.billingMode === 'driver-rental'}
            submitting={model.submitting}
            disabled={
              model.submitting ||
              model.estimating ||
              model.editLoading ||
              Boolean(model.editError) ||
              model.editingLocked
            }
            editingReservation={model.editingReservation}
          />
        )}
      </form>
    </div>
  );
}
