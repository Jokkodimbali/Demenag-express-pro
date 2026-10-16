import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useBookingForm } from '../application/useBookingForm';
import { BookingSummary } from '../components/booking/BookingSummary';
import { CustomerDetails } from '../components/booking/CustomerDetails';
import { ScheduleOptions } from '../components/booking/ScheduleOptions';
import { VehicleSelector } from '../components/booking/VehicleSelector';
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
          <p className="eyebrow">PRO · MTH · DAKAR, SÉNÉGAL</p>
          <h1>
            DÉMÉNAGEMENT
            <br />
            <span>RAPIDE</span>
          </h1>
          <p className="hero-description">
            Choisissez votre véhicule, indiquez le trajet et recevez une estimation immédiate.
            Réservation en moins de deux minutes.
          </p>
        </div>
        <div className="hero-visual">
          <img
            src="/assets/sprinter-profil.png"
            alt="Mercedes Sprinter Demenag Express avec ses dimensions"
            fetchPriority="high"
          />
        </div>
      </section>
      <section id="reserver" className="booking-section">
        <div className="container">
          <div className="section-heading">
            <h2>RÉSERVER</h2>
          </div>
          {catalogue?.settings.bookingsEnabled === false && (
            <p className="alert" role="status">
              Les réservations sont temporairement fermées. Contactez-nous pour toute demande.
            </p>
          )}
          {loading ? (
            <div className="panel loading" role="status">
              Chargement des véhicules et des tarifs…
            </div>
          ) : error ? (
            <div className="alert error" role="alert">
              <p>{error}</p>
              <button className="button secondary" onClick={reload}>
                Réessayer
              </button>
            </div>
          ) : done ? (
            <div className="success-panel">
              <CheckCircle2 size={44} />
              <p className="eyebrow">DEMANDE ENREGISTRÉE</p>
              <h2>ON PRÉPARE LA SUITE.</h2>
              <p>
                Votre demande <strong>{done.reference}</strong> est enregistrée. L’équipe confirmera
                la disponibilité du véhicule et du créneau.
              </p>
              <Link className="button primary" to="/mon-espace">
                Suivre ma réservation <ArrowRight size={18} />
              </Link>
              <button className="button secondary" onClick={() => setDone(null)}>
                Nouvelle demande
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
                    <span>2 ·</span>
                    <div>
                      <h3>TRAJET</h3>
                      <p>Recherchez vos adresses ou placez les repères sur la carte.</p>
                    </div>
                  </div>
                  <Suspense fallback={<div className="map loading">Chargement de la carte…</div>}>
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
                <CustomerDetails user={user} draft={draft} setDraft={setDraft} />
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
            <small>ESTIMATION</small>
            <strong>{price ? money(price.total) : 'À calculer'}</strong>
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
            {user ? 'Envoyer' : 'Réserver'}
          </button>
        </div>
      )}
    </>
  );
}
