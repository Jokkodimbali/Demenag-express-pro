import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBookingForm } from '../application/useBookingForm';
import { BookingSummary } from '../components/booking/BookingSummary';
import { CustomerDetails } from '../components/booking/CustomerDetails';
import { normalizedClientPhone } from '../application/services/client-summary';
import { ScheduleOptions } from '../components/booking/ScheduleOptions';
import { VehicleSelector } from '../components/booking/VehicleSelector';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { money } from '../domain/format';
import type { VehicleTransition } from '../domain/vehicle-transition';
const RouteMap = lazy(() => import('../components/RouteMap'));
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
    const query = window.matchMedia('(max-width: 600px)');
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
    done,
    setDone,
    tiers,
    selected,
    submit,
    option,
    extras,
    clientRecognition,
    recognizingClient,
  } = state;
  const bookingsClosed = catalogue?.settings.bookingsEnabled === false;
  return (
    <>
      <section id="reserver" className="booking-section">
        <div className="container">
          <div className="section-heading">
            <h2>{messages.reserver2}</h2>
          </div>
          {loading ? (
            <div className="panel loading" role="status">
              {messages.chargementDesVehiculesEtDesTarifs}
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
          ) : done ? (
            <div className="success-panel">
              <CheckCircle2 size={44} />
              <p className="eyebrow">{messages.demandeEnregistree}</p>
              <h2>{messages.onPrepareLaSuite}</h2>
              <p>
                {messages.votreDemande}
                <strong>{done.reference}</strong>
                {messages.estEnregistreeLEquipeConfirmeraLaDisponibiliteDu}
              </p>
              <Link className="button primary" to={routes.account}>
                {messages.suivreMaReservation}
                <ArrowRight size={18} />
              </Link>
              <button className="button secondary" onClick={() => setDone(null)}>
                {messages.nouvelleDemande}
              </button>
            </div>
          ) : catalogue && selected ? (
            <form
              id="booking-form"
              onSubmit={submit}
              className="booking-layout"
              data-mobile-step={mobileBookingStep}
            >
              <div className="booking-mobile-progress" aria-live="polite">
                <span>ÉTAPE {mobileBookingStep} / 4</span>
                <strong>
                  {
                    [
                      'Choisissez le véhicule',
                      'Placez le trajet',
                      'Date et options',
                      'Vos coordonnées',
                    ][mobileBookingStep - 1]
                  }
                </strong>
                <div>
                  <span style={{ width: `${mobileBookingStep * 25}%` }} />
                </div>
                {mobileBookingError && <small role="alert">{mobileBookingError}</small>}
              </div>
              <div className="booking-fields">
                <div className="booking-mobile-step" data-booking-step="1">
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
                        <h3>{messages.trajet}</h3>
                        <p>{messages.recherchezVosAdressesOuPlacezLesReperesSur}</p>
                      </div>
                    </div>
                    <Suspense
                      fallback={<div className="map loading">{messages.chargementDeLaCarte}</div>}
                    >
                      <RouteMap />
                    </Suspense>
                  </section>
                </div>
                <div className="booking-mobile-step" data-booking-step="3">
                  <ScheduleOptions
                    catalogue={catalogue}
                    draft={draft}
                    setDraft={setDraft}
                    extras={extras}
                    option={option}
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
                />
              </div>
            </form>
          ) : null}
        </div>
      </section>
      {!done && catalogue && !bookingsClosed && (
        <div className="mobile-booking-bar">
          <div>
            <small>{messages.estimation}</small>
            <strong>{price ? money(price.total) : messages.aCalculer}</strong>
          </div>
          {isMobileBooking && mobileBookingStep > 1 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setMobileBookingError('');
                setMobileBookingStep((step) => step - 1);
              }}
            >
              Retour
            </button>
          )}
          {isMobileBooking && mobileBookingStep < 4 ? (
            <button
              type="button"
              className="button primary"
              onClick={() => {
                if (mobileBookingStep === 3) {
                  const dateInput = document.getElementById(
                    'booking-date',
                  ) as HTMLInputElement | null;
                  const timeInput = document.getElementById(
                    'booking-slot',
                  ) as HTMLInputElement | null;
                  if (dateInput && !dateInput.checkValidity()) {
                    dateInput.reportValidity();
                    return;
                  }
                  if (timeInput && !timeInput.checkValidity()) {
                    timeInput.reportValidity();
                    return;
                  }
                }
                setMobileBookingError('');
                setMobileBookingStep((step) => step + 1);
                window.scrollTo({ top: document.getElementById('reserver')?.offsetTop ?? 0 });
              }}
            >
              Continuer <ArrowRight size={16} />
            </button>
          ) : (
            <button
              form="booking-form"
              className="button primary"
              disabled={
                !price ||
                submitting ||
                estimating ||
                selected?.active === false ||
                catalogue.settings.bookingsEnabled === false
              }
            >
              {user ? 'Envoyer' : messages.reserver3}
            </button>
          )}
        </div>
      )}
    </>
  );
}
