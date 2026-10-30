import { uiText } from '../content/reference-ui-text';
import { ChevronDown } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { normalizedClientPhone } from '../application/services/client-summary';
import { CallInventory } from '../components/booking/CallInventory';
import { FleetVehicleImagePreview } from '../components/FleetVehicleDimensions';
import { ClientQuestionnaire } from '../components/booking/ClientQuestionnaire';
import { TollRateSelector } from '../components/TollRateSelector';
import { money, referenceTierLabels, today } from '../domain/format';
import { bookingInventorySnapshot } from '../domain/moving-estimate';
import { BookingConfirmation } from '../components/booking/BookingConfirmation';
import { routes } from '../routing/routes';
import { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import { AdminCreateQuoteAside } from '../components/AdminCreateQuoteAside';

const RouteMap = lazy(() => import('../components/RouteMap'));

export function AdminCreateQuote({ publicRequest = false }: { publicRequest?: boolean }) {
  const model = useAdminCreateQuoteModel(publicRequest);
  const {
    editingReservation,
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
    labourPrice,
    movingEstimate,
    questionnaire,
    visibleInventoryText,
    questionnaireAutoAnswers,
    estimateText,
    questionnaireText,
    totalTolls,
    tiers,
    effectiveDistance,
    previewTier,
    previewSubtotal,
    previewDiscount,
    onTollToggle,
    changeQuoteOption,
    toggleQuoteSection,
  } = model;
  if (loading)
    return (
      <div className="panel loading" role="status">
        {uiText['chargementDuCatalogue']}
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
  if (publicRequest && done)
    return (
      <div className="reference-request-page">
        <BookingConfirmation booking={done} settings={catalogue.settings} isClient />
      </div>
    );

  return (
    <div className={`admin-quote-page${publicRequest ? ' reference-request-page' : ''}`}>
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
      <form
        id="admin-quote-form"
        onSubmit={(event) => {
          if (draft.customerPhone.replace(/\D/g, '').length < 9) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Indiquez votre numéro de téléphone (9 chiffres).');
            return;
          }
          if (publicRequest && !draft.date) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Choisissez une date.');
            return;
          }
          if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
            event.preventDefault();
            setStageError(
              'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
            );
            return;
          }
          setStageError('');
          void submit(
            event,
            [visibleInventoryText, estimateText, questionnaireText].filter(Boolean).join('\n'),
            (movingEstimate?.planning ?? []).map((step, index) => ({
              id: `plan-${index + 1}`,
              time: step.time,
              title: step.title,
              detail: step.detail,
              minutes: step.minutes,
            })),
            movingEstimate &&
              (movingEstimate.volume > 0 ||
                state.editingBooking?.inventorySnapshot?.sourceInventory)
              ? bookingInventorySnapshot(estimateInventory, movingEstimate)
              : undefined,
            movingEstimate?.volume
              ? { ...draft.options, labour: movingEstimate.crew }
              : draft.options,
          );
        }}
        className="admin-quote-layout"
      >
        <div className="admin-quote-fields">
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
                      {referenceTierLabels(catalogue.settings.distanceBounds)[index]} :{' '}
                      <strong>{money(amount)}</strong>
                    </span>
                  ))}
                  <span>
                    {referenceTierLabels(catalogue.settings.distanceBounds)[3]} :{' '}
                    <strong>{uiText['surDevis']}</strong>
                  </span>
                  <span>
                    {uiText['manœuvre']}
                    <strong>{money(catalogue.settings.labourPrice)}</strong> {uiText['pers']}
                  </span>
                  <span>
                    {uiText['menuisier']}
                    <strong>{money(catalogue.settings.assemblyPrice)}</strong> {uiText['meuble']}
                  </span>
                </div>
              </div>
            </section>
          )}
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
                      maxLength={25}
                      value={draft.customerPhone}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, customerPhone: event.target.value }))
                      }
                      placeholder={uiText['telephone']}
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
                  {!publicRequest && (
                    <div
                      className="admin-quote-vehicles"
                      role="group"
                      aria-label={uiText['vehicule2']}
                    >
                      {catalogue.vehicles.map((vehicle) => (
                        <button
                          type="button"
                          key={vehicle.id}
                          disabled={vehicle.active === false}
                          aria-pressed={draft.vehicleId === vehicle.id}
                          className={draft.vehicleId === vehicle.id ? 'active' : ''}
                          onClick={() =>
                            setDraft((current) => ({ ...current, vehicleId: vehicle.id }))
                          }
                        >
                          {vehicle.name.replace(/^(Mercedes|Renault) /, '')}
                        </button>
                      ))}
                    </div>
                  )}
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
                    required={!publicRequest}
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
                <div className="admin-quote-service-row">
                  <strong>{uiText['allersRetours']}</strong>
                  <div className="admin-quote-stepper">
                    <button
                      type="button"
                      aria-label={uiText['retirerUnAllerRetour']}
                      disabled={quoteConfig.trips <= 1}
                      onClick={() => {
                        const trips = Math.max(1, quoteConfig.trips - 1);
                        setQuoteConfig((current) => ({ ...current, trips }));
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
                      disabled={quoteConfig.trips >= catalogue.settings.maxTrips}
                      onClick={() => {
                        const trips = Math.min(catalogue.settings.maxTrips, quoteConfig.trips + 1);
                        setQuoteConfig((current) => ({ ...current, trips }));
                        if (publicRequest)
                          setDraft((current) => ({ ...current, estimatedTrips: trips }));
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                {extras.map(([key, label]) => (
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
                        disabled={draft.options[key] >= catalogue.settings.maxOptions}
                        onClick={() => changeQuoteOption(key, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
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
          <CallInventory
            draft={draft}
            setDraft={setDraft}
            maxOptions={catalogue.settings.maxOptions}
            vehicles={catalogue.vehicles}
            selectedVehicleId={draft.vehicleId}
            quoteTrips={quoteConfig.trips}
            maxTrips={catalogue.settings.maxTrips}
            laborPlanning={catalogue.settings.movingLaborPlanning}
            trafficDurationMinutes={traffic?.minutes}
            audience={publicRequest ? 'client' : 'admin'}
            referenceMode={publicRequest}
            labourPriceEditor={
              publicRequest ? undefined : (
                <div className="admin-quote-labour-override">
                  <label htmlFor="admin-labour-unit-price">{uiText['prixParManœuvreFCFA']}</label>
                  <input
                    id="admin-labour-unit-price"
                    type="number"
                    min="0"
                    value={quoteConfig.labourUnitPriceOverride ?? ''}
                    placeholder={String(labourPrice)}
                    onChange={(event) =>
                      setQuoteConfig((current) => ({
                        ...current,
                        labourUnitPriceOverride: event.target.value
                          ? Math.max(0, Number(event.target.value)) || null
                          : null,
                      }))
                    }
                  />
                  <small>
                    {uiText['videGrilleAdmin']}
                    {money(labourPrice)})
                  </small>
                </div>
              )
            }
            estimateInventory={estimateInventory}
            onApplyEstimate={(vehicleId, trips) => {
              setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
              setQuoteConfig((current) => ({ ...current, trips }));
            }}
          />
          {!publicRequest && (
            <ClientQuestionnaire
              questions={questionnaire}
              answers={draft.questionnaireAnswers}
              autoAnswers={questionnaireAutoAnswers}
              autoQuestionIds={[
                'name',
                'phone',
                'date',
                'time',
                'from',
                'to',
                'rep',
                'dwelling',
                'items',
              ]}
              open={questionnaireOpen}
              onToggle={() => setQuestionnaireOpen((value) => !value)}
              onChange={(id, value) =>
                setDraft((current) => ({
                  ...current,
                  questionnaireAnswers: { ...current.questionnaireAnswers, [id]: value },
                }))
              }
            />
          )}
        </div>

        <AdminCreateQuoteAside
          model={model}
          publicRequest={publicRequest}
          catalogue={catalogue}
          selected={selected}
        />
      </form>
    </div>
  );
}
