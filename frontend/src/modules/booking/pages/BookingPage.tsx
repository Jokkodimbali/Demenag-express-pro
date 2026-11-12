import { uiText } from '../../shared/content/reference-ui-text';
import { visibleUiText } from '../../shared/content/visible-ui-text';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBookingForm } from '../application/controllers/useBookingForm';
import { BookingSummary } from '../components/BookingSummary';
import { BookingConfirmation } from '../components/BookingConfirmation';
import { CallInventory } from '../components/CallInventory';
import { CustomerDetails } from '../components/CustomerDetails';
import { normalizedClientPhone } from '../../shared/domain/client-identity';
import { ScheduleOptions } from '../components/ScheduleOptions';
import { VehicleSelector } from '../components/VehicleSelector';
import { messages } from '../../shared/content/fr';
import { money } from '../../shared/application/presentation/format';
import { routes } from '../../shared/navigation/config/routes';
import {
  bookingInventorySnapshot,
  estimateMovingWork,
} from '../../moving/domain/estimate/moving-estimate';
import type { VehicleTransition } from '../../moving/domain/vehicle-transition';
const RouteMap = lazy(() => import('../../moving/maps/RouteMap'));
export function BookingPage() {
  const [mobileBookingStep, setMobileBookingStep] = useState(1);
  const [mobileBookingError, setMobileBookingError] = useState('');
  const [isMobileBooking, setIsMobileBooking] = useState(false);
  const [vehicleTransition, setVehicleTransition] = useState<VehicleTransition | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const transitionSequence = useRef(0);
  useEffect(
    () => () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    },
    [],
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 759px)');
    const update = () => setIsMobileBooking(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const startVehicleTransition = (fromVehicleId: string, toVehicleId: string) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    const sequence = ++transitionSequence.current;
    setVehicleTransition({ fromVehicleId, toVehicleId, sequence });
    transitionTimer.current = window.setTimeout(() => {
      setVehicleTransition(null);
      transitionTimer.current = null;
    }, 720);
  };

  const state = useBookingForm();
  const {
    catalogue,
    loading,
    error,
    reload,
    user,
    draft,
    setDraft,
    price,
    estimating,
    estimateError,
    submitError,
    submitting,
    fieldErrors,
    validateSchedule,
    clearFieldError,
    done,
    tiers,
    selected,
    submit,
    option,
    extras,
    clientRecognition,
    recognizingClient,
    editingBooking,
    editLoading,
    editError,
  } = state;
  const bookingsClosed = catalogue?.settings.bookingsEnabled === false && !editingBooking;
  const quoteTrips = Math.max(
    1,
    Math.min(catalogue?.settings.maxTrips ?? 20, draft.estimatedTrips),
  );
  const movingEstimate = selected
    ? estimateMovingWork(draft.inventory, selected, draft.route, {
        trips: quoteTrips,
        crew: draft.inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning: catalogue?.settings.movingLaborPlanning,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        date: draft.date,
        month: draft.month,
      })
    : null;
  const submitBooking = (event: React.FormEvent<HTMLFormElement>) =>
    void submit(
      event,
      '',
      [],
      movingEstimate?.volume
        ? bookingInventorySnapshot(draft.inventory, movingEstimate)
        : undefined,
    );
  return (
    <>
      <section id="reserver" className={done ? 'booking-section sent-screen' : 'booking-section'}>
        <div className="container">
          {!done && (
            <div className="section-heading">
              <h2>
                {editingBooking
                  ? `VOS INFORMATIONS · ${editingBooking.reference}`
                  : messages.reserver2}
              </h2>
              {editingBooking && (
                <Link className="button secondary small" to={routes.account}>
                  {uiText['retourAMonEspace']}
                </Link>
              )}
            </div>
          )}
          {loading || editLoading ? (
            <div className="panel loading" role="status">
              {messages.chargementDesVehiculesEtDesTarifs}
            </div>
          ) : editError ? (
            <div className="alert error" role="alert">
              <p>{editError}</p>
              <Link className="button secondary" to={routes.account}>
                {uiText['retourAMonEspace']}
              </Link>
            </div>
          ) : error ? (
            <div className="alert error" role="alert">
              <p>{error}</p>
              <button className="button secondary" onClick={reload}>
                {messages.reessayer}
              </button>
            </div>
          ) : bookingsClosed ? (
            <section className="booking-closed" role="status" aria-live="polite">
              <p className="eyebrow">{messages.formulaireDeReservation}</p>
              <h3>{messages.reservationsTemporairementFermees}</h3>
              <p>{messages.lesReservationsSontTemporairementFermeesContactezNousPour}</p>
            </section>
          ) : done && catalogue ? (
            <BookingConfirmation
              booking={done}
              settings={catalogue.settings}
              isClient={user?.role === 'client'}
            />
          ) : catalogue && selected ? (
            <form
              id="booking-form"
              noValidate
              onSubmit={submitBooking}
              className="booking-layout"
              data-mobile-step={mobileBookingStep}
            >
              <div className="booking-mobile-progress" aria-live="polite">
                <span>
                  {uiText['etape']}
                  {mobileBookingStep} {uiText['4']}
                </span>
                <strong>
                  {
                    (editingBooking
                      ? [
                          'Choisissez le véhicule',
                          'Placez le trajet',
                          'Date et options',
                          'Vos informations',
                        ]
                      : [
                          'Choisissez le véhicule',
                          'Placez le trajet',
                          'Date et options',
                          'Vos coordonnées',
                        ])[mobileBookingStep - 1]
                  }
                </strong>
                <div>
                  <span style={{ width: `${mobileBookingStep * 25}%` }} />
                </div>
              </div>
              <div className="booking-fields">
                <div className="booking-mobile-step" data-booking-step="1">
                  {editingBooking && selected.active === false && (
                    <p className="alert error" role="status">
                      {uiText['ceVehiculeNEstPlusDisponibleChoisissezUnAutreVehiculeA']}
                    </p>
                  )}
                  <VehicleSelector
                    catalogue={catalogue}
                    selected={selected}
                    draft={draft}
                    setDraft={setDraft}
                    tiers={tiers}
                    transition={vehicleTransition}
                    onVehicleTransition={startVehicleTransition}
                  />
                </div>
                <div className="booking-mobile-step" data-booking-step="2">
                  <section className="panel">
                    <div className="step-title">
                      <span>{messages.text2}</span>
                      <div>
                        <h3>{editingBooking ? 'TRAJET · CARTE' : messages.trajet}</h3>
                        {!editingBooking && (
                          <p>{messages.recherchezVosAdressesOuPlacezLesReperesSur}</p>
                        )}
                      </div>
                    </div>
                    <Suspense
                      fallback={<div className="map loading">{messages.chargementDeLaCarte}</div>}
                    >
                      <RouteMap
                        draft={draft}
                        setDraft={(update) =>
                          setDraft((current) => ({ ...current, ...update(current) }))
                        }
                      />
                    </Suspense>
                  </section>
                </div>
                <div className="booking-mobile-step" data-booking-step="3">
                  {!editingBooking && (
                    <CallInventory
                      audience="client"
                      draft={draft}
                      setDraft={setDraft}
                      maxOptions={catalogue.settings.maxOptions}
                      vehicles={catalogue.vehicles}
                      selectedVehicleId={draft.vehicleId}
                      quoteTrips={quoteTrips}
                      maxTrips={catalogue.settings.maxTrips}
                      laborPlanning={catalogue.settings.movingLaborPlanning}
                      onApplyEstimate={(vehicleId, trips) => {
                        setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
                      }}
                    />
                  )}
                  {!editingBooking && (
                    <section className="panel booking-trip-count">
                      <div>
                        <h3>{uiText['nombreDAllersRetoursEstimes']}</h3>
                        <p className="muted">
                          {uiText['leTransportEstFactureParAllerRetourLEquipeConfirmeraLe']}
                        </p>
                      </div>
                      <div
                        className="stepper"
                        role="group"
                        aria-label={uiText['nombreDAllersRetoursEstimes']}
                      >
                        <button
                          type="button"
                          aria-label={uiText['retirerUnAllerRetour']}
                          disabled={quoteTrips <= 1}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              estimatedTrips: Math.max(1, current.estimatedTrips - 1),
                            }))
                          }
                        >
                          −
                        </button>
                        <output>{quoteTrips}</output>
                        <button
                          type="button"
                          aria-label={uiText['ajouterUnAllerRetour']}
                          disabled={quoteTrips >= catalogue.settings.maxTrips}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              estimatedTrips: Math.min(
                                catalogue.settings.maxTrips,
                                current.estimatedTrips + 1,
                              ),
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </section>
                  )}
                  <ScheduleOptions
                    catalogue={catalogue}
                    draft={draft}
                    setDraft={setDraft}
                    extras={extras}
                    option={option}
                    fieldErrors={fieldErrors}
                    clearFieldError={clearFieldError}
                    referenceMode={Boolean(editingBooking)}
                  />
                </div>
                <div className="booking-mobile-step" data-booking-step="4">
                  <CustomerDetails
                    draft={draft}
                    setDraft={setDraft}
                    recognition={
                      clientRecognition &&
                      clientRecognition.phone === normalizedClientPhone(draft.customerPhone)
                        ? clientRecognition
                        : null
                    }
                    recognizingClient={recognizingClient}
                    fieldErrors={fieldErrors}
                    clearFieldError={clearFieldError}
                    referenceMode={Boolean(editingBooking)}
                  />
                </div>
              </div>
              <div className="booking-mobile-step booking-mobile-summary" data-booking-step="5">
                <BookingSummary
                  catalogue={catalogue}
                  selected={selected}
                  draft={draft}
                  price={price}
                  tiers={tiers}
                  estimating={estimating}
                  estimateError={estimateError}
                  submitError={submitError}
                  submitting={submitting}
                  user={user}
                  isEditing={Boolean(editingBooking)}
                />
              </div>
            </form>
          ) : null}
        </div>
      </section>
      {!done && catalogue && !bookingsClosed && (
        <div className="mobile-booking-bar">
          {mobileBookingError && (
            <small className="mobile-booking-error" role="alert">
              {mobileBookingError}
            </small>
          )}
          <div>
            <small>{visibleUiText.bookingProvisionalEstimateLabel}</small>
            <strong>{price ? money(price.total) : messages.aCalculer}</strong>
          </div>
          {isMobileBooking && mobileBookingStep > 1 && (
            <button
              type="button"
              className="button secondary"
              aria-label={uiText['retour']}
              onClick={() => {
                setMobileBookingError('');
                setMobileBookingStep((step) => step - 1);
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          {isMobileBooking && mobileBookingStep < 4 ? (
            <button
              type="button"
              className="button primary"
              onClick={() => {
                if (mobileBookingStep === 2 && !draft.route) {
                  setMobileBookingError("Placez le départ (A) et l'arrivée (B) sur la carte.");
                  return;
                }
                if (mobileBookingStep === 3) {
                  if (!validateSchedule()) {
                    setMobileBookingError('');
                    return;
                  }
                }
                setMobileBookingError('');
                setMobileBookingStep((step) => step + 1);
                window.scrollTo({ top: document.getElementById('reserver')?.offsetTop ?? 0 });
              }}
            >
              {uiText['continuer']}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              form="booking-form"
              className="button primary"
              type="submit"
              disabled={
                !price ||
                submitting ||
                estimating ||
                selected?.active === false ||
                (catalogue.settings.bookingsEnabled === false && !editingBooking)
              }
            >
              {editingBooking ? 'Envoyer ma demande' : 'Envoyer'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
