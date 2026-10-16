import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useBookingForm } from '../application/useBookingForm';
import { BookingSummary } from '../components/booking/BookingSummary';
import { CustomerDetails } from '../components/booking/CustomerDetails';
import { ScheduleOptions } from '../components/booking/ScheduleOptions';
import { VehicleSelector } from '../components/booking/VehicleSelector';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { money } from '../domain/format';
const RouteMap = lazy(() => import('../components/RouteMap'));
export function Home() {
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
  } = state;
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
          <div className="hero-visual">
            <img src={selected.image} alt={selected.name} fetchPriority="high" />
          </div>
        )}
      </section>
      <section id="reserver" className="booking-section">
        <div className="container">
          <div className="section-heading">
            <h2>{messages.reserver2}</h2>
          </div>
          {catalogue?.settings.bookingsEnabled === false && (
            <p className="alert" role="status">
              {messages.lesReservationsSontTemporairementFermeesContactezNousPour}
            </p>
          )}
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
                />
                <CustomerDetails draft={draft} setDraft={setDraft} />
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
              />
            </form>
          ) : null}
        </div>
      </section>
      {!done && catalogue && (
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
