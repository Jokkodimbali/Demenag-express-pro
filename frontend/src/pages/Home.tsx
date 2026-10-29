import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../application/context';
import { money, tierLabels } from '../domain/format';
import { routes } from '../routing/routes';

export function Home() {
  const { catalogue, draft, setDraft, loading, error, reload } = useApp();
  const navigate = useNavigate();
  const vehicle = catalogue?.vehicles.find((item) => item.id === draft.vehicleId);
  const tiers = tierLabels(catalogue?.settings.distanceBounds);

  return (
    <>
      <section className="reference-hero" aria-label="Accueil">
        <div className="reference-hero-copy">
          <span>DAKAR · SÉNÉGAL</span>
          <h1>
            DÉMÉNAGEMENT
            <br />
            <em>RAPIDE</em>
          </h1>
          <p>
            Choisissez votre véhicule, indiquez le trajet et recevez une estimation immédiate.
            Réservation en moins de deux minutes.
          </p>
        </div>
        <div className="reference-hero-vehicle">
          <img src="/assets/sprinter-profil.png" alt="Mercedes Sprinter" />
          <div className="reference-hero-length">
            <span>LONGUEUR</span>
            <strong>4,30 m</strong>
          </div>
        </div>
      </section>
      <section id="reserver" className="reference-booking" aria-label="Réservation">
        <div className="reference-booking-inner">
          <h2>RÉSERVER</h2>
          {loading ? (
            <p role="status">Chargement des véhicules et des tarifs…</p>
          ) : error ? (
            <div className="alert error" role="alert">
              <p>{error}</p>
              <button type="button" className="button secondary" onClick={reload}>
                Réessayer
              </button>
            </div>
          ) : catalogue?.settings.bookingsEnabled === false ? (
            <p role="status">Les réservations sont temporairement fermées.</p>
          ) : catalogue && vehicle ? (
            <>
              <div className="reference-vehicle-heading">1 · VÉHICULE</div>
              <div className="reference-vehicle-list">
                {catalogue.vehicles
                  .filter((item) => item.active !== false)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={item.id === vehicle.id}
                      className={item.id === vehicle.id ? 'selected' : ''}
                      onClick={() => setDraft((current) => ({ ...current, vehicleId: item.id }))}
                    >
                      <img src={item.image} alt="" />
                      <span>
                        <strong>
                          {item.shortName || item.name.replace(/\s+(?:III|IV)$/i, '')}
                        </strong>
                        <small>
                          {item.volume} · dès {money(item.prices[0])}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
              <div className="reference-vehicle-detail">
                <div className="reference-vehicle-images">
                  <img src={vehicle.image} alt={`Profil du ${vehicle.name}`} />
                  <img src={vehicle.interior} alt={`Intérieur du ${vehicle.name}`} />
                </div>
                <strong>{vehicle.name.toUpperCase()}</strong>
                <div className="reference-vehicle-facts">
                  <span className="volume">{vehicle.volume}</span>
                  <span>Longueur {vehicle.length}</span>
                  <span>Hauteur {vehicle.height}</span>
                  <span>Largeur {vehicle.width}</span>
                  <span>Passages de roue {vehicle.wheelWidth}</span>
                </div>
                <div className="reference-prices">
                  {vehicle.prices.map((price, index) => (
                    <span key={index}>
                      {tiers[index]} : <strong>{money(price)}</strong>
                    </span>
                  ))}
                  <span>
                    Manœuvre : <strong>{money(catalogue.settings.labourPrice)}</strong> / pers.
                  </span>
                  <span>
                    Menuisier : <strong>{money(catalogue.settings.assemblyPrice)}</strong> / meuble
                  </span>
                </div>
              </div>
              <div className="reference-continue">
                <div>
                  <strong>2 · Trajet, inventaire et devis</strong>
                  <p>
                    Indiquez vos adresses et ce que vous déménagez : le devis provisoire se calcule
                    en direct. Demenag Express le confirme ensuite.
                  </p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate(routes.booking, { state: { newRequest: true } })}
                >
                  Continuer ma réservation
                </button>
              </div>
            </>
          ) : (
            <p role="status">Aucun véhicule disponible.</p>
          )}
        </div>
      </section>
      {catalogue?.settings.bookingsEnabled !== false && vehicle && (
        <div className="reference-mobile-action">
          <Link className="button primary" to={routes.booking} state={{ newRequest: true }}>
            Continuer ma réservation
          </Link>
        </div>
      )}
    </>
  );
}
