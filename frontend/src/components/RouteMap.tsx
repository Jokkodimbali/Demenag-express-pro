import 'leaflet/dist/leaflet.css';
import { Expand, LocateFixed, Search, X } from 'lucide-react';
import { useRouteMap } from '../application/controllers/useRouteMap';
import { messages } from '../content/fr';
export default function RouteMap() {
  const {
    draft,
    active,
    setActive,
    full,
    setFull,
    error,
    busy,
    searching,
    results,
    host,
    setPointRef,
    address,
    search,
    route,
    locate,
  } = useRouteMap();

  return (
    <div className="route-picker">
      <div className="field-pair">
        {(['from', 'to'] as const).map((side) => (
          <div key={side}>
            <label htmlFor={'address-' + side}>
              {side === 'from' ? messages.adresseDeDepart : messages.adresseDArrivee}
            </label>
            <div className="address-field">
              <span className={'point-badge ' + side}>{side === 'from' ? 'A' : 'B'}</span>
              <input
                id={'address-' + side}
                value={draft[(side + 'Address') as 'fromAddress' | 'toAddress']}
                onChange={(e) => address(side, e.target.value)}
                onFocus={() => setActive(side)}
                placeholder={side === 'from' ? messages.exOuakamDakar : messages.exAlmadiesDakar}
                maxLength={300}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={
                  'Rechercher ' + (side === 'from' ? messages.leDepart : messages.lArrivee)
                }
                disabled={searching !== null}
                onClick={() => search(side)}
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {searching && (
        <p className="muted" role="status">
          {messages.rechercheDeLAdresse}
        </p>
      )}
      {results && results.items.length > 0 && (
        <div className="search-results" aria-label={messages.resultatsDeRecherche}>
          {results.items.map((item, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setPointRef.current(results.side, item.point, item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className={'map-shell ' + (full ? 'fullscreen' : '')}>
        <div className="map" ref={host} />
        <span className="map-hint">
          {messages.placez}
          {active === 'from' ? messages.leDepartA : messages.lArriveeB}
          {messages.surLaCarte}
        </span>
        <button
          type="button"
          className="map-expand"
          aria-label={full ? messages.quitterLePleinEcran : messages.agrandirLaCarte}
          aria-expanded={full}
          onClick={() => setFull((f) => !f)}
        >
          {full ? <X size={19} /> : <Expand size={19} />}
        </button>
        <div className="map-actions">
          <button
            type="button"
            className={'button small ' + (active === 'from' ? 'primary' : 'secondary')}
            onClick={() => setActive('from')}
          >
            {messages.aDepart}
          </button>
          <button
            type="button"
            className={'button small ' + (active === 'to' ? 'primary' : 'secondary')}
            onClick={() => setActive('to')}
          >
            {messages.bArrivee}
          </button>
          <button
            type="button"
            className="button secondary small"
            onClick={locate}
            aria-label={messages.utiliserMaPosition}
          >
            <LocateFixed size={18} />
          </button>
        </div>
      </div>
      <div className="route-bottom">
        <span className="muted">
          {draft.route ? (
            <>
              <strong>
                {draft.route.distanceKm}
                {messages.km}
              </strong>
              {messages.environ}
              {draft.route.durationMinutes} {messages.min}
            </>
          ) : (
            messages.choisissezLesDeuxPointsPourCalculerLeTrajet
          )}
        </span>
        <button
          type="button"
          className="button secondary small"
          onClick={route}
          disabled={busy || !draft.from || !draft.to}
        >
          {busy
            ? messages.calculEnCours
            : draft.route
              ? messages.recalculerLeTrajet
              : messages.calculerMonTrajet}
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <p className="caption">{messages.rechercheEtCarteOpenstreetmapItineraireRoutierOsrmVous}</p>
    </div>
  );
}
