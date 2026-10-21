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
import type { Vehicle } from '../domain/model';
import type { VehicleTransition } from '../domain/vehicle-transition';
const RouteMap = lazy(() => import('../components/RouteMap'));

const simulatedVehicleViews: Record<string, string[]> = {
  'sprinter-profil.png': ['/assets/sprinter-3d-angle.png', '/assets/sprinter-3d-rear.png'],
  'trafic-profil.png': ['/assets/trafic-3d-angle.png', '/assets/trafic-3d-rear.png'],
  'master-profil.png': ['/assets/master-3d-angle.png', '/assets/master-3d-rear.png'],
};
const vehicleAnnouncementImages: Record<string, string> = {
  trafic: '/assets/annonce-trafic.png',
  master: '/assets/annonce-master.png',
  sprinter: '/assets/annonce-sprinter.png',
};

function VehicleShowcase({
  vehicle,
  outgoingVehicle,
  transitionSequence,
  announcementImage,
}: {
  vehicle: Vehicle;
  outgoingVehicle: Vehicle | undefined;
  transitionSequence: number | null;
  announcementImage: string | undefined;
}) {
  const [rotation, setRotation] = useState({ vehicleId: vehicle.id, index: 0 });
  const filename = vehicle.image.split('/').pop()?.split('?')[0] ?? '';
  const views = [vehicle.image, ...(simulatedVehicleViews[filename] ?? [])];
  const activeView = rotation.vehicleId === vehicle.id ? rotation.index : 0;

  useEffect(() => {
    setRotation({ vehicleId: vehicle.id, index: 0 });
    if (views.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(
      () =>
        setRotation((current) => ({
          vehicleId: vehicle.id,
          index: ((current.vehicleId === vehicle.id ? current.index : 0) + 1) % views.length,
        })),
      2300,
    );
    return () => window.clearInterval(timer);
  }, [vehicle.id, vehicle.image, views.length]);

  return (
    <div className="hero-visual">
      <div className="hero-vehicle-display">
        {outgoingVehicle && transitionSequence !== null && (
          <img
            key={transitionSequence}
            className="hero-vehicle-leaving"
            src={outgoingVehicle.image}
            alt=""
            aria-hidden="true"
          />
        )}
        <div
          className={`hero-vehicle-stage${transitionSequence !== null ? ' rolling-in' : ''}`}
          role="img"
          aria-label={vehicle.name}
        >
          {views.map((src, index) => (
            <img
              key={src}
              className={index === activeView ? 'active' : ''}
              data-view={index}
              src={src}
              alt={index === 0 ? vehicle.name : ''}
              aria-hidden={index !== 0}
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />
          ))}
        </div>
      </div>
      {announcementImage && (
        <a
          className="hero-announcement-preview"
          href={announcementImage}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ouvrir l'annonce complète du ${vehicle.name}`}
        >
          <img src={announcementImage} alt={`Annonce du ${vehicle.name}`} loading="lazy" />
        </a>
      )}
    </div>
  );
}

export function Home() {
  const [vehicleTransition, setVehicleTransition] = useState<VehicleTransition | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const transitionSequence = useRef(0);
  useEffect(
    () => () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    },
    [],
  );

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
    administrativeQuote,
    tollLines,
    setTollLines,
    clientRecognition,
    recognizingClient,
    recognizeClient,
  } = state;
  const bookingsClosed = catalogue?.settings.bookingsEnabled === false && !administrativeQuote;
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">{messages.proMthDakarSenegal}</p>
          <h1>
            {messages.demenagement}
            <br />
            <span>{messages.rapide}</span>
          </h1>
          <p className="hero-description">
            {messages.choisissezVotreVehiculeIndiquezLeTrajetEtRecevez}
          </p>
        </div>
        {selected && (
          <VehicleShowcase
            vehicle={selected}
            outgoingVehicle={
              vehicleTransition?.toVehicleId === selected.id
                ? catalogue?.vehicles.find(
                    (vehicle) => vehicle.id === vehicleTransition.fromVehicleId,
                  )
                : undefined
            }
            transitionSequence={
              vehicleTransition?.toVehicleId === selected.id ? vehicleTransition.sequence : null
            }
            announcementImage={vehicleAnnouncementImages[selected.id]}
          />
        )}
      </section>
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
            <form id="booking-form" onSubmit={submit} className="booking-layout">
              <div className="booking-fields">
                <VehicleSelector
                  catalogue={catalogue}
                  selected={selected}
                  draft={draft}
                  setDraft={setDraft}
                  tiers={tiers}
                  transition={vehicleTransition}
                  onVehicleTransition={startVehicleTransition}
                />
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
                <ScheduleOptions
                  catalogue={catalogue}
                  draft={draft}
                  setDraft={setDraft}
                  extras={extras}
                  option={option}
                  administrativeQuote={administrativeQuote}
                  tollLines={tollLines}
                  setTollLines={setTollLines}
                />
                <CustomerDetails
                  draft={draft}
                  setDraft={setDraft}
                  onPhoneBlur={recognizeClient}
                  recognition={
                    clientRecognition &&
                    clientRecognition.phone === normalizedClientPhone(draft.customerPhone)
                      ? clientRecognition
                      : null
                  }
                  recognizingClient={recognizingClient}
                />
              </div>
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
                selectedTolls={tollLines}
                allowWhenBookingsClosed={administrativeQuote}
              />
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
        </div>
      )}
    </>
  );
}
