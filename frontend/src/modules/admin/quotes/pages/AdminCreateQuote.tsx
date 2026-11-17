import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { uiText } from '../../../shared/content/reference-ui-text';
import { ChevronDown } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CallInventory } from '../../../booking/components/CallInventory';
import { FleetVehicleImagePreview } from '../../fleet/components/FleetVehicleDimensions';
import { AdminQuoteQuestionnaire } from '../components/AdminQuoteQuestionnaire';
import { TollRateSelector } from '../../../moving/tolls/components/TollRateSelector';
import {
  dateLabel,
  money,
  referenceTierLabels,
} from '../../../shared/application/presentation/format';
import {
  bookingInventorySnapshot,
  formatDuration,
} from '../../../moving/domain/estimate/moving-estimate';
import { BookingConfirmation } from '../../../booking/components/BookingConfirmation';
import { routes } from '../../../shared/navigation/config/routes';
import { vehicleImageForDisplay } from '../../../shared/application/presentation/vehicle-image';
import { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import { AdminCreateQuoteAside } from '../components/AdminCreateQuoteAside';
import { AdminQuoteVehicleBilling } from '../components/AdminQuoteVehicleBilling';
import { AdminQuoteSettings } from '../components/AdminQuoteSettings';
import { AdminQuoteSaveBar } from '../components/AdminQuoteSaveBar';
import { AdminQuoteStepHeading } from '../components/AdminQuoteStepHeading';
import { AdminQuoteStep } from '../components/AdminQuoteStep';
import { AdminQuoteClientIdentity } from '../components/AdminQuoteClientIdentity';
import { LoadingSimulation } from '../components/LoadingSimulation';
import { adminQuoteVehicleText as quoteText } from '../content/admin-quote-vehicle';
import { quoteConditionsText } from '../../../shared/messaging/application/services/whatsapp-templates';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { useApp } from '../../../shared/application/context';
import type { RouteMapDraftUpdater } from '../../../moving/maps/route-map-state';

const RouteMap = lazy(() => import('../../../moving/maps/RouteMap'));

export function AdminCreateQuote({ publicRequest = false }: { publicRequest?: boolean }) {
  const model = useAdminCreateQuoteModel(publicRequest);
  const { showErrorToast, showSuccessToast } = useApp();
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
    canCommitQuoteStage,
    latestSavedQuote,
    pricingSnapshotBusy,
    pricingSnapshotError,
    applyCurrentPricingSnapshot,
    applyVehicleEstimate,
    quoteSettings,
    contactCard,
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
    cancelPendingWhatsApp,
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
    movingEstimate,
    questionnaire,
    visibleInventoryText,
    estimateText,
    questionnaireText,
    totalTolls,
    tiers,
    effectiveDistance,
    estimatedTravelMinutes,
    freeTravelMinutes,
    trafficCoefficient,
    trafficFactors,
    previewTier,
    previewSubtotal,
    previewDiscount,
    taxiFeeLines,
    manoeuvreOvertimeLine,
    confirmVehicleFit,
    onTollToggle,
    changeQuoteOption,
    toggleQuoteSection,
  } = model;
  const manualTravelTime = quoteConfig.calcMode === 'manual' && quoteConfig.legMinutes > 0;
  const estimatedTrafficColor =
    manualTravelTime || quoteConfig.trafficOff
      ? '#AEB4BB'
      : trafficCoefficient >= 1.6
        ? '#FF5A5F'
        : trafficCoefficient >= 1.25
          ? '#FFD23F'
          : '#3DDC84';
  const updateRouteDraft = useCallback<RouteMapDraftUpdater>(
    (update) => setDraft((current) => ({ ...current, ...update(current) })),
    [setDraft],
  );
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
          const submittedKind = quoteKind;
          const quoteStageCommit = Boolean(editingBooking && canCommitQuoteStage);
          const quoteStageCommitId = quoteStageCommit ? latestSavedQuote?.id : undefined;
          if (!normalizePhoneNumber(draft.customerPhone)) {
            event.preventDefault();
            cancelPendingWhatsApp();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            const message = 'Saisissez un numéro valide avec son indicatif international.';
            setStageError(message);
            showErrorToast(message);
            return;
          }
          if (publicRequest && !draft.date) {
            event.preventDefault();
            cancelPendingWhatsApp();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Choisissez une date.');
            showErrorToast('Choisissez une date.');
            return;
          }
          if (
            submittedKind === 'final' &&
            estimateInventory.stairs === 'balcon' &&
            !(Number(estimateInventory.balcPx) > 0)
          ) {
            event.preventDefault();
            cancelPendingWhatsApp();
            setStageError('Passage par le balcon : fixez le supplément avant le devis final.');
            showErrorToast('Passage par le balcon : fixez le supplément avant le devis final.');
            return;
          }
          if (
            submittedKind === 'final' &&
            previewTier === 3 &&
            !(Number(quoteConfig.customPrice) > 0)
          ) {
            event.preventDefault();
            cancelPendingWhatsApp();
            setStageError(
              `Distance au-delà de ${(quoteSettings ?? catalogue.settings).distanceBounds[2]} km : fixez le prix par aller-retour avant le devis final.`,
            );
            showErrorToast(
              `Distance au-delà de ${(quoteSettings ?? catalogue.settings).distanceBounds[2]} km : fixez le prix par aller-retour avant le devis final.`,
            );
            return;
          }
          if (submittedKind === 'final' && (!draft.date || draft.noDate)) {
            event.preventDefault();
            cancelPendingWhatsApp();
            setStageError(
              'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
            );
            showErrorToast(
              'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
            );
            return;
          }
          event.preventDefault();
          if (!(await confirmVehicleFit())) {
            cancelPendingWhatsApp();
            return;
          }
          setStageError('');
          if (!draft.route) {
            setActiveStep(2);
            setOpenQuoteSections((current) => ({ ...current, route: true }));
            setStageError('Calculez le trajet avant d’enregistrer le devis.');
            showErrorToast('Calculez le trajet avant d’enregistrer le devis.');
            cancelPendingWhatsApp();
            return;
          }
          await submit(
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
            [
              ...taxiFeeLines.map((line) => ({
                label: line.label,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
              })),
              ...(manoeuvreOvertimeLine ? [manoeuvreOvertimeLine] : []),
            ],
            submittedKind,
            quoteStageCommitId,
            quoteStageCommit,
          );
          cancelPendingWhatsApp();
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
                      <img src={vehicleImageForDisplay(vehicle.image)} alt="" />
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
            <AdminQuoteClientIdentity
              draft={draft}
              setDraft={setDraft}
              expanded={openQuoteSections.client}
              onToggle={() => toggleQuoteSection('client')}
              editingReference={state.editingBooking?.reference}
              publicRequest={publicRequest}
              administrativeQuote={state.administrativeQuote}
              editingReservation={editingReservation}
              clientRecognition={clientRecognition}
              recognizingClient={recognizingClient}
              clientProfiles={model.clientProfiles}
              contactCard={contactCard}
            />
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
                      draft={draft}
                      setDraft={updateRouteDraft}
                      googleMapsKey={googleMapsKey}
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
                  {draft.from && draft.to && estimatedTravelMinutes > 0 && (
                    <div className="admin-quote-traffic" role="status">
                      <span aria-hidden="true" style={{ background: estimatedTrafficColor }} />
                      <strong>
                        {manualTravelTime
                          ? `Trajet saisi : ${trafficDuration(estimatedTravelMinutes)}`
                          : `Trajet estimé : ${trafficDuration(estimatedTravelMinutes)}`}
                      </strong>
                      <small>
                        {manualTravelTime
                          ? 'Mode manuel · durée de trajet fixée à la main'
                          : quoteConfig.trafficOff
                            ? 'Embouteillages ignorés · circulation fluide'
                            : `Sans embouteillages : ${trafficDuration(Math.round(freeTravelMinutes * 1.05))} · coefficient ×${trafficCoefficient.toFixed(2).replace('.', ',')}`}
                      </small>
                      {!manualTravelTime &&
                        !quoteConfig.trafficOff &&
                        trafficFactors.length > 0 && (
                          <div className="admin-quote-traffic-factors">
                            {trafficFactors.map((factor) => (
                              <span key={factor.label}>
                                {factor.label}
                                <strong
                                  style={{
                                    color:
                                      factor.factor > 1.001
                                        ? '#FFD23F'
                                        : factor.factor < 0.999
                                          ? '#3DDC84'
                                          : '#AEB4BB',
                                  }}
                                >
                                  ×{factor.factor.toFixed(2).replace('.', ',')}
                                </strong>
                              </span>
                            ))}
                          </div>
                        )}
                      {googleMapsKey && traffic && (
                        <small>
                          {traffic.future
                            ? 'Prévision Google pour le départ prévu'
                            : 'Google, trafic actuel'}
                          {trafficDelay > 0
                            ? ` · +${trafficDuration(trafficDelay)} de bouchons`
                            : ''}
                          {' · mis à jour à '}
                          {new Date(traffic.fetchedAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      )}
                      {googleMapsKey && trafficError && (
                        <small>
                          Google Maps indisponible ; l’estimation locale reste utilisée.
                        </small>
                      )}
                      {googleMapsKey && (
                        <button
                          type="button"
                          disabled={!publicRequest && (!route || trafficBusy)}
                          onClick={() => void refreshTraffic()}
                        >
                          {uiText['actualiser']}
                        </button>
                      )}
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
              onApplyEstimate={applyVehicleEstimate}
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
                      vehicleId={draft.vehicleId}
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
                    <div className="admin-quote-custom-quantity-list">
                      {quoteConfig.customLines.map((line) => (
                        <div
                          className="admin-quote-service-row admin-quote-custom-quantity-row"
                          key={line.id}
                        >
                          <input
                            type="text"
                            maxLength={100}
                            value={line.label}
                            placeholder="Libellé de l’option"
                            aria-label="Libellé de l’option facturée"
                            onChange={(event) => {
                              const label = event.currentTarget.value;
                              setQuoteConfig((current) => ({
                                ...current,
                                customLines: current.customLines.map((item) =>
                                  item.id === line.id ? { ...item, label } : item,
                                ),
                              }));
                            }}
                          />
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            step="1"
                            inputMode="numeric"
                            value={line.quantity}
                            placeholder="Qté"
                            aria-label="Quantité de l’option"
                            onChange={(event) => {
                              const quantity = Math.max(
                                1,
                                Math.min(10000, Math.round(Number(event.currentTarget.value) || 1)),
                              );
                              setQuoteConfig((current) => ({
                                ...current,
                                customLines: current.customLines.map((item) =>
                                  item.id === line.id ? { ...item, quantity } : item,
                                ),
                              }));
                            }}
                          />
                          <input
                            type="number"
                            min="0"
                            max="10000000"
                            step="1"
                            inputMode="numeric"
                            value={line.unitPrice}
                            aria-label="Prix unitaire en FCFA"
                            placeholder="Prix unitaire"
                            onChange={(event) => {
                              const unitPrice = Math.max(
                                0,
                                Math.min(
                                  10000000,
                                  Math.round(Number(event.currentTarget.value) || 0),
                                ),
                              );
                              setQuoteConfig((current) => ({
                                ...current,
                                customLines: current.customLines.map((item) =>
                                  item.id === line.id ? { ...item, unitPrice } : item,
                                ),
                              }));
                            }}
                          />
                          <strong className="admin-quote-custom-quantity-total">
                            {money(line.quantity * line.unitPrice)}
                          </strong>
                          <button
                            type="button"
                            className="admin-quote-custom-quantity-remove"
                            aria-label={`Supprimer ${line.label || 'cette ligne'}`}
                            onClick={() => {
                              setQuoteConfig((current) => ({
                                ...current,
                                customLines: current.customLines.filter(
                                  (item) => item.id !== line.id,
                                ),
                              }));
                              showSuccessToast('Ligne supprimée du devis.');
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        className="admin-quote-custom-quantity-add"
                        type="button"
                        disabled={quoteConfig.customLines.length >= 20}
                        onClick={() => {
                          setQuoteConfig((current) => ({
                            ...current,
                            customLines: [
                              ...current.customLines,
                              {
                                id: crypto.randomUUID(),
                                label: '',
                                quantity: 1,
                                unitPrice: 0,
                              },
                            ],
                          }));
                          showSuccessToast('Nouvelle option ajoutée au devis.');
                        }}
                      >
                        + Ajouter une option facturée
                      </button>
                    </div>
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
                quoteConfig={{
                  ...quoteConfig,
                  hasToll: tollLines.some((line) => line.quantity * line.unitPrice > 0),
                }}
                laborPlanning={(quoteSettings ?? catalogue.settings).movingLaborPlanning}
                crew={movingEstimate?.crew ?? 2}
                estimate={movingEstimate}
                setDraft={setDraft}
                onTripsChange={(trips) => setQuoteConfig((current) => ({ ...current, trips }))}
                onCrewRecommendation={() =>
                  setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }))
                }
              />
              {model.inventoryCount === 0 && (
                <span className="admin-quote-plan-empty">
                  {visibleUiText.quoteLoadingSimulationHint}
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
              model.editLoading ||
              Boolean(model.editError) ||
              (editingLocked && !canCommitQuoteStage)
            }
            editingReservation={model.editingReservation}
          />
        )}
      </form>
    </div>
  );
}
