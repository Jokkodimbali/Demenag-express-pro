import { uiText } from '../content/reference-ui-text';
import { messages } from '../content/fr';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../application/context';
import { useTollPointCommands } from '../application/controllers/useTollPointCommands';
import { errorMessage } from '../application/error-message';
import { TollPointEditorMap } from '../components/TollPointEditorMap';
import type { TollPoint, TollPointInput, Vehicle } from '../domain/model';
import { tollPrice } from '../domain/toll-prices';
import { tollAxisColor } from '../components/maps/admin-toll-markers';
import '../styles/admin-tolls.css';

const blankPoint = (latitude: number, longitude: number, vehicles: Vehicle[]): TollPointInput => ({
  name: 'Nouveau péage',
  region: '',
  axis: '',
  heavyPrice: 0,
  vehiclePrices: Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, 0])),
  latitude,
  longitude,
});

const shortPrice = (amount: number) => amount.toLocaleString('fr-FR');
const referenceVehicleOrder = (vehicle: Vehicle) => {
  const name = `${vehicle.shortName ?? ''} ${vehicle.name}`.toLocaleLowerCase('fr');
  if (name.includes('sprinter')) return 0;
  if (name.includes('trafic')) return 1;
  if (name.includes('master')) return 2;
  return 3;
};
const referenceVehicleTag = (vehicle: Vehicle) => {
  const name = vehicle.shortName || vehicle.name;
  return name
    .replace(/^(?:mercedes|renault)\s+/i, '')
    .replace(/\s+(?:iii|iv)(?:\s+phase\s+\d+)?$/i, '');
};
const referenceVehicleName = (vehicle: Vehicle) =>
  (vehicle.shortName || vehicle.name).replace(/\s+(?:iii|iv)(?:\s+phase\s+\d+)?$/i, '');

export function AdminTollPoints() {
  const { catalogue, tollPoints, setTollPoints, requestConfirmation } = useApp();
  const commands = useTollPointCommands();
  const vehicles = useMemo(
    () =>
      [...(catalogue?.vehicles ?? [])].sort(
        (first, second) => referenceVehicleOrder(first) - referenceVehicleOrder(second),
      ),
    [catalogue?.vehicles],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState(() => vehicles[0]?.id ?? '');
  const [axisFilter, setAxisFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const updateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const revisions = useRef(new Map<string, number>());
  const writesInFlight = useRef(new Set<string>());
  const currentPoints = useRef(tollPoints);
  currentPoints.current = tollPoints;

  useEffect(
    () => () => {
      updateTimers.current.forEach((timer) => clearTimeout(timer));
      updateTimers.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!vehicles.some((vehicle) => vehicle.id === vehicleId) && vehicles[0])
      setVehicleId(vehicles[0].id);
  }, [vehicleId, vehicles]);

  const axes = useMemo(() => {
    const names = [...new Set(tollPoints.map((point) => point.axis || 'Autre route'))];
    return names.map((name) => {
      const points = tollPoints.filter((point) => (point.axis || 'Autre route') === name);
      const regions = [...new Set(points.map((point) => point.region).filter(Boolean))];
      return {
        name,
        color: tollAxisColor(name, tollPoints),
        description: `${points.length} péage${points.length > 1 ? 's' : ''}${regions.length ? ` · ${regions.join(', ')}` : ''}`,
      };
    });
  }, [tollPoints]);

  const filteredPoints = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return tollPoints.filter((point) => {
      const axis = point.axis || 'Autre route';
      const matchesAxis = !axisFilter || axis === axisFilter;
      const searchable = `${point.name} ${point.axis} ${point.region}`.toLocaleLowerCase('fr');
      return matchesAxis && (!needle || searchable.includes(needle));
    });
  }, [axisFilter, query, tollPoints]);

  const selectedPoint = tollPoints.find((point) => point.id === selectedId) ?? null;
  const focusPoint = useCallback((point: TollPoint) => {
    setSelectedId(point.id);
    setFocusId(point.id);
  }, []);

  const addAt = useCallback(
    async (latitude: number, longitude: number) => {
      const input = blankPoint(latitude, longitude, vehicles);
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const point = await commands.createTollPoint(input);
        setTollPoints((current) => [...current.filter((item) => item.id !== point.id), point]);
        setSelectedId(point.id);
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [commands, setTollPoints, vehicles],
  );

  const updatePoint = useCallback(
    (point: TollPoint, patch: Partial<TollPointInput>, delay = 350) => {
      const next = { ...point, ...patch };
      currentPoints.current = currentPoints.current.map((item) =>
        item.id === point.id ? next : item,
      );
      setTollPoints((current) => current.map((item) => (item.id === point.id ? next : item)));
      setError('');
      setNotice('');
      const revision = (revisions.current.get(point.id) ?? 0) + 1;
      revisions.current.set(point.id, revision);
      const previousTimer = updateTimers.current.get(point.id);
      if (previousTimer) clearTimeout(previousTimer);
      const timer = setTimeout(() => {
        updateTimers.current.delete(point.id);
        if (writesInFlight.current.has(point.id)) return;
        writesInFlight.current.add(point.id);
        void (async () => {
          let persistedRevision = revision - 1;
          try {
            while (persistedRevision !== revisions.current.get(point.id)) {
              const currentRevision = revisions.current.get(point.id) ?? revision;
              const latest = currentPoints.current.find((item) => item.id === point.id);
              if (!latest) return;
              if (latest.name.trim().length < 2) {
                setError('Le nom du péage doit contenir au moins deux caractères.');
                return;
              }
              if (latest.heavyPrice < 0) {
                setError('Le tarif du péage ne peut pas être négatif.');
                return;
              }
              const savedPoint = await commands.updateTollPoint(point.id, latest);
              persistedRevision = currentRevision;
              if (revisions.current.get(point.id) === currentRevision) {
                currentPoints.current = currentPoints.current.map((item) =>
                  item.id === point.id ? savedPoint : item,
                );
                setTollPoints((current) =>
                  current.map((item) => (item.id === point.id ? savedPoint : item)),
                );
                setNotice('Modifications enregistrées.');
              }
            }
          } catch (reason) {
            setError(errorMessage(reason));
          } finally {
            writesInFlight.current.delete(point.id);
          }
        })();
      }, delay);
      updateTimers.current.set(point.id, timer);
    },
    [commands, setTollPoints],
  );

  const movePoint = useCallback(
    (point: TollPoint, latitude: number, longitude: number) => {
      updatePoint(point, { latitude, longitude }, 0);
    },
    [updatePoint],
  );

  const removePoint = useCallback(
    async (point: TollPoint) => {
      const confirmed = await requestConfirmation({
        titleId: 'delete-toll-point-title',
        eyebrow: messages.confirmationRequise,
        title: messages.supprimerPeageTitre,
        description: messages.suppressionPeageDescription,
        confirmLabel: uiText['supprimer'],
      });
      if (!confirmed) return;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await commands.deleteTollPoint(point.id);
        setTollPoints((current) => current.filter((item) => item.id !== point.id));
        setSelectedId((current) => (current === point.id ? null : current));
        setNotice('Péage supprimé.');
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        setBusy(false);
      }
    },
    [commands, requestConfirmation, setTollPoints],
  );

  const mapMovePoint = useCallback(
    (point: TollPoint, latitude: number, longitude: number) =>
      movePoint(point, latitude, longitude),
    [movePoint],
  );
  const selectMapPoint = useCallback((point: TollPoint) => setSelectedId(point.id), []);

  return (
    <div className="toll-reference-page">
      <div className="toll-reference-toolbar">
        <span>{uiText['tarifAfficheSurLaCarte']}</span>
        <div className="toll-reference-vehicle-tabs" role="group" aria-label={uiText['vehicule']}>
          {vehicles.map((vehicle) => (
            <button
              type="button"
              key={vehicle.id}
              className={vehicleId === vehicle.id ? 'active' : ''}
              aria-pressed={vehicleId === vehicle.id}
              onClick={() => setVehicleId(vehicle.id)}
            >
              {referenceVehicleTag(vehicle)}
            </button>
          ))}
        </div>
      </div>

      {(error || notice) && (
        <p className={error ? 'alert error' : 'alert success'} role={error ? 'alert' : 'status'}>
          {error || notice}
        </p>
      )}

      {busy && (
        <p className="toll-reference-saving" role="status">
          {uiText['enregistrement']}
        </p>
      )}

      <div className="toll-reference-grid">
        <section className="toll-reference-map-panel" aria-label={uiText['carteDesPointsDePeage']}>
          <TollPointEditorMap
            points={tollPoints}
            selectedId={selectedId}
            focusId={focusId}
            vehicleId={vehicleId}
            axisFilter={axisFilter}
            query={query}
            onSelect={selectMapPoint}
            onAdd={(latitude, longitude) => void addAt(latitude, longitude)}
            onMove={mapMovePoint}
          />
        </section>

        <div className="toll-reference-side">
          <section className="toll-reference-card">
            <div className="toll-reference-card-heading">
              <span>{uiText['legende']}</span>
              {axisFilter && (
                <button type="button" onClick={() => setAxisFilter(null)}>
                  {uiText['toutAfficher']}
                </button>
              )}
            </div>
            <div className="toll-reference-axis-list">
              {axes.map((axis) => (
                <button
                  type="button"
                  key={axis.name}
                  className={axisFilter === axis.name ? 'active' : ''}
                  style={
                    {
                      '--axis-color': axis.color,
                      opacity: axisFilter && axisFilter !== axis.name ? 0.4 : 1,
                    } as CSSProperties
                  }
                  onClick={() =>
                    setAxisFilter((current) => (current === axis.name ? null : axis.name))
                  }
                >
                  <i />
                  <strong>{axis.name}</strong>
                  <span>{axis.description}</span>
                </button>
              ))}
              {!axes.length && <span>{uiText['aucunPeageCliquezSurLaCartePourEnPlacerUn']}</span>}
            </div>
          </section>

          <section className="toll-reference-card toll-reference-list-card">
            <div className="toll-reference-card-heading">
              <span>{uiText['peages']}</span>
              <small>
                {tollPoints.length} {uiText['peageS']}
              </small>
            </div>
            <label className="toll-reference-search">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={uiText['rechercherUnPeageUneVille']}
                aria-label={uiText['rechercherUnPeageUneVille']}
              />
            </label>
            {filteredPoints.length === 0 && tollPoints.length > 0 && (
              <p className="toll-reference-empty">{uiText['aucunResultat']}</p>
            )}
            {tollPoints.length === 0 && (
              <p className="toll-reference-empty">
                {uiText['aucunPeageCliquezSurLaCartePourEnPlacerUn']}
              </p>
            )}
            <div className="toll-reference-results">
              {filteredPoints.map((point) =>
                selectedId === point.id ? (
                  <TollPointEditor
                    key={point.id}
                    point={selectedPoint ?? point}
                    vehicles={vehicles}
                    allPoints={tollPoints}
                    busy={busy}
                    onChange={(patch) => updatePoint(selectedPoint ?? point, patch)}
                    onClose={() => {
                      setSelectedId(null);
                      setFocusId(null);
                    }}
                    onDelete={() => void removePoint(selectedPoint ?? point)}
                  />
                ) : (
                  <button
                    type="button"
                    className="toll-reference-result"
                    key={point.id}
                    onClick={() => focusPoint(point)}
                  >
                    <i style={{ background: tollAxisColor(point.axis, tollPoints) }} />
                    <strong>{point.name}</strong>
                    <b>{shortPrice(tollPrice(point, vehicleId))}</b>
                    <span />
                    <small>
                      {point.axis || uiText['autreRoute']}
                      {point.region ? ` · ${point.region}` : ''}
                    </small>
                  </button>
                ),
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TollPointEditor({
  point,
  vehicles,
  allPoints,
  busy,
  onChange,
  onClose,
  onDelete,
}: {
  point: TollPoint;
  vehicles: Vehicle[];
  allPoints: TollPoint[];
  busy: boolean;
  onChange: (patch: Partial<TollPointInput>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const axes = [...new Set(allPoints.map((item) => item.axis).filter(Boolean))];
  const regions = [...new Set(allPoints.map((item) => item.region).filter(Boolean))];
  const coordinateText =
    point.latitude === null || point.longitude === null
      ? '—'
      : `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
  const mapsHref =
    point.latitude === null || point.longitude === null
      ? '#'
      : `https://www.google.com/maps/search/?api=1&query=${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

  return (
    <article
      className="toll-reference-editor"
      style={{ '--axis-color': tollAxisColor(point.axis, allPoints) } as React.CSSProperties}
    >
      <header>
        <i />
        <input
          value={point.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={uiText['nomDuPeage']}
          aria-label={uiText['nomDuPeage']}
          maxLength={100}
        />
        <button
          type="button"
          title={uiText['fermer']}
          aria-label={uiText['fermer']}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="toll-reference-price-summary">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id}>
            <span>{referenceVehicleName(vehicle)}</span>
            <strong>
              {shortPrice(tollPrice(point, vehicle.id))} {uiText['fcfa']}
            </strong>
            <small>
              {uiText['allerRetour']} {shortPrice(2 * tollPrice(point, vehicle.id))}{' '}
              {uiText['fcfa']}
            </small>
          </div>
        ))}
      </div>
      <div className="toll-reference-price-fields">
        {vehicles.map((vehicle) => (
          <label key={vehicle.id}>
            <span>
              {uiText['prix']} {referenceVehicleTag(vehicle).toLocaleUpperCase('fr')}
            </span>
            <input
              type="number"
              min={0}
              max={10000000}
              step={1}
              value={point.vehiclePrices[vehicle.id] ?? point.heavyPrice}
              onChange={(event) =>
                onChange({
                  vehiclePrices: {
                    ...point.vehiclePrices,
                    [vehicle.id]: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="toll-reference-location-fields">
        <input
          list={`toll-axes-${point.id}`}
          value={point.axis}
          onChange={(event) => onChange({ axis: event.target.value })}
          placeholder={uiText['autoroute']}
          aria-label={uiText['axeRoutier']}
          maxLength={120}
        />
        <datalist id={`toll-axes-${point.id}`}>
          {axes.map((axis) => (
            <option key={axis} value={axis} />
          ))}
          <option value="Autoroute de l'Avenir (Dakar–Diamniadio)" />
          <option value="Autoroute Diamniadio–AIBD–Mbour" />
          <option value="Autoroute Ila Touba" />
          <option value="Autoroute Mbour–Kaolack" />
        </datalist>
        <input
          list={`toll-regions-${point.id}`}
          value={point.region}
          onChange={(event) => onChange({ region: event.target.value })}
          placeholder={uiText['region']}
          aria-label={uiText['region']}
          maxLength={80}
        />
        <datalist id={`toll-regions-${point.id}`}>
          {regions.map((region) => (
            <option key={region} value={region} />
          ))}
          {['Dakar', 'Thiès', 'Diourbel', 'Fatick', 'Kaolack'].map((region) => (
            <option key={region} value={region} />
          ))}
        </datalist>
      </div>
      <footer>
        <span>
          {uiText['position']} {coordinateText}
        </span>
        <div>
          <a href={mapsHref} target="_blank" rel="noreferrer">
            {uiText['googleMaps']}
          </a>
          <button type="button" disabled={busy} onClick={onDelete}>
            {uiText['supprimer']}
          </button>
        </div>
      </footer>
    </article>
  );
}
