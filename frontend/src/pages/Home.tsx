import { uiText } from '../content/reference-ui-text';
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
      <section className="reference-hero" aria-label={uiText['accueil']}>
        <div className="reference-hero-copy">
          <span>{uiText['dakarSENEGAL']}</span>
          <h1>
            {uiText['demenagement2']}
            <br />
            <em>{uiText['rapide']}</em>
          </h1>
          <p>{uiText['choisissezVotreVehiculeIndiquezLeTrajetEtRecevezUneEst']}</p>
        </div>
        <div className="reference-hero-vehicle">
          <img src="/assets/sprinter-profil.png" alt={uiText['mercedesSprinter']} />
          <div className="reference-hero-length">
            <span>{uiText['longueur2']}</span>
            <strong>{uiText['430M']}</strong>
          </div>
        </div>
      </section>
      <section id="reserver" className="reference-booking" aria-label={uiText['reservation2']}>
        <div className="reference-booking-inner">
          <h2>{uiText['reserver']}</h2>
          {loading ? (
            <p role="status">{uiText['chargementDesVehiculesEtDesTarifs']}</p>
          ) : error ? (
            <div className="alert error" role="alert">
              <p>{error}</p>
              <button type="button" className="button secondary" onClick={reload}>
                {uiText['reessayer']}
              </button>
            </div>
          ) : catalogue?.settings.bookingsEnabled === false ? (
            <p role="status">{uiText['lesReservationsSontTemporairementFermees']}</p>
          ) : catalogue && vehicle ? (
            <>
              <div className="reference-vehicle-heading">{uiText['1VEHICULE']}</div>
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
                          {item.volume} {uiText['des']}
                          {money(item.prices[0])}
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
                  <span>
                    {uiText['longueur']}
                    {vehicle.length}
                  </span>
                  <span>
                    {uiText['hauteur']}
                    {vehicle.height}
                  </span>
                  <span>
                    {uiText['largeur']}
                    {vehicle.width}
                  </span>
                  <span>
                    {uiText['passagesDeRoue']}
                    {vehicle.wheelWidth}
                  </span>
                </div>
                <div className="reference-prices">
                  {vehicle.prices.map((price, index) => (
                    <span key={index}>
                      {tiers[index]} : <strong>{money(price)}</strong>
                    </span>
                  ))}
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
              <div className="reference-continue">
                <div>
                  <strong>{uiText['2TrajetInventaireEtDevis']}</strong>
                  <p>{uiText['indiquezVosAdressesEtCeQueVousDemenagezLeDevisProvisoi']}</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate(routes.booking, { state: { newRequest: true } })}
                >
                  {uiText['continuerMaReservation']}
                </button>
              </div>
            </>
          ) : (
            <p role="status">{uiText['aucunVehiculeDisponible']}</p>
          )}
        </div>
      </section>
      {catalogue?.settings.bookingsEnabled !== false && vehicle && (
        <div className="reference-mobile-action">
          <Link className="button primary" to={routes.booking} state={{ newRequest: true }}>
            {uiText['continuerMaReservation']}
          </Link>
        </div>
      )}
    </>
  );
}
