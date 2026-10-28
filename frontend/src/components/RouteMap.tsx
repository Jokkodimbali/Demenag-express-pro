import 'leaflet/dist/leaflet.css';
import { Expand, LocateFixed, Search, X } from 'lucide-react';
import { useRouteMap } from '../application/controllers/useRouteMap';
import { messages } from '../content/fr';
import type { TollExtraLine } from '../domain/toll-selection';
const EMPTY_TOLL_LINES: TollExtraLine[] = [];
export default function RouteMap({
  tollLines = EMPTY_TOLL_LINES,
  onTollToggle,
  fromNote,
  toNote,
  onNoteChange,
  adminQuote = false,
}: {
  tollLines?: TollExtraLine[];
  onTollToggle?: (line: TollExtraLine, selected: boolean) => void;
  fromNote?: string;
  toNote?: string;
  onNoteChange?: (side: 'from' | 'to', value: string) => void;
  adminQuote?: boolean;
}) {
  const {
    draft,
    routeTolls,
    canChooseTolls,
    tollLines: selectedTolls,
    toggleToll,
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
    geocode,
    route,
    clear,
    locate,
  } = useRouteMap(tollLines, onTollToggle);

  const addressField = (side: 'from' | 'to') => (
    <div key={side}>
      <label
        className={adminQuote ? 'route-accessible-label' : undefined}
        htmlFor={'address-' + side}
      >
        {side === 'from' ? messages.adresseDeDepart : messages.adresseDArrivee}
      </label>
      <div className={'address-field' + (adminQuote && active === side ? ' active' : '')}>
        <span className={'point-badge ' + side}>{side === 'from' ? 'A' : 'B'}</span>
        <input
          id={'address-' + side}
          value={draft[(side + 'Address') as 'fromAddress' | 'toAddress']}
          onChange={(event) => address(side, event.target.value)}
          onFocus={() => setActive(side)}
          onBlur={adminQuote ? () => void geocode(side) : undefined}
          placeholder={
            adminQuote
              ? side === 'from'
                ? 'Départ'
                : 'Arrivée'
              : side === 'from'
                ? messages.exOuakamDakar
                : messages.exAlmadiesDakar
          }
          maxLength={300}
        />
        {!adminQuote && (
          <button
            type="button"
            className="icon-button"
            aria-label={'Rechercher ' + (side === 'from' ? messages.leDepart : messages.lArrivee)}
            disabled={searching !== null}
            onClick={() => search(side)}
          >
            <Search size={18} />
          </button>
        )}
      </div>
    </div>
  );
  const noteField = (side: 'from' | 'to') =>
    onNoteChange && (
      <label key={side} className="route-address-note" htmlFor={'address-note-' + side}>
        <span className={adminQuote ? 'route-accessible-label' : undefined}>
          {side === 'from' ? 'Repère de départ' : 'Repère d’arrivée'}
        </span>
        <input
          id={'address-note-' + side}
          value={side === 'from' ? (fromNote ?? '') : (toNote ?? '')}
          onChange={(event) => onNoteChange(side, event.target.value)}
          placeholder={
            adminQuote
              ? side === 'from'
                ? 'Note départ (repère, bâtiment, porte…)'
                : 'Note arrivée (repère, bâtiment, porte…)'
              : 'Bâtiment, porte, lieu connu…'
          }
          maxLength={300}
        />
      </label>
    );

  return (
    <div className="route-picker">
      <div className={'field-pair' + (adminQuote ? ' admin-quote-route-grid' : '')}>
        {adminQuote ? (
          <>
            <div className="admin-quote-route-column">
              {addressField('from')}
              {addressField('to')}
            </div>
            <div className="admin-quote-route-column">
              {noteField('from')}
              {noteField('to')}
            </div>
          </>
        ) : (
          (['from', 'to'] as const).map((side) => (
            <div key={side}>
              {addressField(side)}
              {noteField(side)}
            </div>
          ))
        )}
      </div>
      {searching && (
        <p className="muted" role="status">
          {messages.rechercheDeLAdresse}
        </p>
      )}
      {!adminQuote && results && results.items.length > 0 && (
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
          {adminQuote ? `Touchez la carte pour placer ${active === 'from' ? 'le départ (A)' : "l'arrivée (B)"}` : <>{messages.placez}{active === 'from' ? messages.leDepartA : messages.lArriveeB}{messages.surLaCarte}</>}
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
        {!adminQuote && (
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
        )}
        {adminQuote && full && (
          <div className="admin-quote-map-full-summary">
            <span>
              Distance :{' '}
              <strong>{draft.distanceKmOverride ?? draft.route?.distanceKm ?? '—'} km</strong>
            </span>
            <button type="button" onClick={() => setFull(false)}>
              Valider
            </button>
          </div>
        )}
      </div>
      {adminQuote && (
        <div className="admin-quote-pin-actions">
          <button
            type="button"
            className={active === 'from' ? 'active' : ''}
            aria-pressed={active === 'from'}
            onClick={() => setActive('from')}
          >
            Placer le départ (A)
          </button>
          <button
            type="button"
            className={active === 'to' ? 'active' : ''}
            aria-pressed={active === 'to'}
            onClick={() => setActive('to')}
          >
            Placer l’arrivée (B)
          </button>
          <button type="button" className="admin-quote-clear-route" onClick={clear}>
            Effacer
          </button>
        </div>
      )}
      {!adminQuote && (
        <button type="button" className="admin-quote-clear-route" onClick={clear}>
          Effacer
        </button>
      )}
      {!adminQuote && (
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
      )}
      {!adminQuote && draft.route && (
        <div className="route-tolls" role="status" aria-live="polite">
          <strong>
            {routeTolls.length === 0
              ? 'Aucun péage géolocalisé repéré sur le tracé'
              : routeTolls.length === 1
                ? 'Un péage repéré sur le trajet'
                : `${routeTolls.length} péages repérés sur le trajet`}
          </strong>
          <ul>
            {routeTolls.map((point) => {
              const selected = selectedTolls.some((line) => line.id === point.id);
              return (
                <li key={point.id}>
                  <span>{point.name}</span>
                  {canChooseTolls && (
                    <button
                      type="button"
                      className="button secondary small"
                      aria-pressed={selected}
                      onClick={() => toggleToll(point)}
                    >
                      {selected ? 'Inclus dans le devis' : 'Ajouter au devis'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p>
            Repérage indicatif à partir du tracé et des positions enregistrées. L’équipe confirme
            les péages réellement empruntés.
          </p>
        </div>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {!adminQuote && (
        <p className="caption">{messages.rechercheEtCarteOpenstreetmapItineraireRoutierOsrmVous}</p>
      )}
    </div>
  );
}
