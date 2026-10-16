import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Expand, LocateFixed, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../application/context';
import type { Point } from '../domain/model';
type Side = 'from' | 'to';
const pin = (side: Side) =>
  L.divIcon({
    className: 'map-pin-host',
    html: `<span class="map-pin ${side}"><span>${side === 'from' ? 'A' : 'B'}</span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  });
export default function RouteMap() {
  const { api, draft, setDraft } = useApp();
  const [active, setActive] = useState<Side>('from'),
    [full, setFull] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [searching, setSearching] = useState<Side | null>(null);
  const [results, setResults] = useState<{
    side: Side;
    items: { label: string; point: Point }[];
  } | null>(null);
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<Partial<Record<Side, L.Marker>>>({}),
    line = useRef<L.Polyline | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const routeRequest = useRef(0),
    searchRequest = useRef(0);
  const setPointRef = useRef<(side: Side, point: Point, label?: string) => void>(() => {});
  setPointRef.current = (side, point, label) => {
    routeRequest.current++;
    searchRequest.current++;
    setResults(null);
    setBusy(false);
    setSearching(null);
    setError('');
    setDraft((d) => ({
      ...d,
      [side]: point,
      [side + 'Address']: label || `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`,
      route: null,
    }));
    if (side === 'from') setActive('to');
  };
  useEffect(() => {
    if (!host.current) return;
    const routeCounter = routeRequest;
    const searchCounter = searchRequest;
    const m = L.map(host.current, {
      scrollWheelZoom: false,
      minZoom: 7,
      maxBounds: [
        [12, -18.5],
        [17, -11],
      ],
    }).setView([14.6928, -17.4467], 12);
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    m.on('click', (e) => setPointRef.current(activeRef.current, [e.latlng.lat, e.latlng.lng]));
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      markers.current = {};
      line.current = null;
      routeCounter.current++;
      searchCounter.current++;
    };
  }, []);
  const { from, to } = draft;
  useEffect(() => {
    if (!map.current) return;
    for (const side of ['from', 'to'] as const) {
      const point = side === 'from' ? from : to;
      const current = markers.current[side];
      if (!point) {
        current?.remove();
        delete markers.current[side];
        continue;
      }
      if (current) {
        current.setLatLng(point);
        continue;
      }
      const marker = L.marker(point, {
        icon: pin(side),
        draggable: true,
        alt: side === 'from' ? 'Point de départ' : 'Point d’arrivée',
      }).addTo(map.current);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setPointRef.current(side, [p.lat, p.lng]);
      });
      markers.current[side] = marker;
    }
    if (from && !to) map.current.setView(from, 14);
  }, [from, to]);
  useEffect(() => {
    line.current?.remove();
    line.current = null;
    if (draft.route && map.current) {
      line.current = L.polyline(draft.route.geometry, { color: '#f6d73c', weight: 5 }).addTo(
        map.current,
      );
      map.current.fitBounds(line.current.getBounds(), { padding: [35, 35] });
    }
  }, [draft.route]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = old;
    };
  }, [full]);
  function address(side: Side, value: string) {
    routeRequest.current++;
    searchRequest.current++;
    setBusy(false);
    setSearching(null);
    setResults(null);
    setDraft((d) => ({ ...d, [side + 'Address']: value, [side]: null, route: null }));
  }
  async function search(side: Side) {
    const q = draft[(side + 'Address') as 'fromAddress' | 'toAddress'];
    if (q.trim().length < 3) {
      setError('Saisissez au moins trois caractères.');
      return;
    }
    const id = ++searchRequest.current;
    setSearching(side);
    setError('');
    try {
      const items = await api.search(q);
      if (id === searchRequest.current) {
        setResults({ side, items });
        if (!items.length) setError('Aucune adresse trouvée. Placez le point sur la carte.');
      }
    } catch (e) {
      if (id === searchRequest.current) setError((e as Error).message);
    } finally {
      if (id === searchRequest.current) setSearching(null);
    }
  }
  async function route() {
    if (!draft.from || !draft.to) return;
    const id = ++routeRequest.current;
    setBusy(true);
    setError('');
    setDraft((d) => ({ ...d, route: null }));
    try {
      const result = await api.route(draft.from, draft.to);
      if (id === routeRequest.current) setDraft((d) => ({ ...d, route: result }));
    } catch (e) {
      if (id === routeRequest.current) setError((e as Error).message);
    } finally {
      if (id === routeRequest.current) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError('La géolocalisation est indisponible.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPointRef.current(
          'from',
          [p.coords.latitude, p.coords.longitude],
          'Ma position actuelle',
        ),
      () => setError('Position indisponible. Autorisez la géolocalisation ou utilisez la carte.'),
      { timeout: 10000, enableHighAccuracy: true },
    );
  }
  return (
    <div className="route-picker">
      <div className="field-pair">
        {(['from', 'to'] as const).map((side) => (
          <div key={side}>
            <label htmlFor={'address-' + side}>
              {side === 'from' ? 'Adresse de départ' : 'Adresse d’arrivée'}
            </label>
            <div className="address-field">
              <span className={'point-badge ' + side}>{side === 'from' ? 'A' : 'B'}</span>
              <input
                id={'address-' + side}
                value={draft[(side + 'Address') as 'fromAddress' | 'toAddress']}
                onChange={(e) => address(side, e.target.value)}
                onFocus={() => setActive(side)}
                placeholder={side === 'from' ? 'Ex. Ouakam, Dakar' : 'Ex. Almadies, Dakar'}
                maxLength={300}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={'Rechercher ' + (side === 'from' ? 'le départ' : 'l’arrivée')}
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
          Recherche de l’adresse…
        </p>
      )}
      {results && results.items.length > 0 && (
        <div className="search-results" aria-label="Résultats de recherche">
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
          Placez {active === 'from' ? 'le départ A' : 'l’arrivée B'} sur la carte
        </span>
        <button
          type="button"
          className="map-expand"
          aria-label={full ? 'Quitter le plein écran' : 'Agrandir la carte'}
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
            A · Départ
          </button>
          <button
            type="button"
            className={'button small ' + (active === 'to' ? 'primary' : 'secondary')}
            onClick={() => setActive('to')}
          >
            B · Arrivée
          </button>
          <button
            type="button"
            className="button secondary small"
            onClick={locate}
            aria-label="Utiliser ma position"
          >
            <LocateFixed size={18} />
          </button>
        </div>
      </div>
      <div className="route-bottom">
        <span className="muted">
          {draft.route ? (
            <>
              <strong>{draft.route.distanceKm} km</strong> · environ {draft.route.durationMinutes}{' '}
              min
            </>
          ) : (
            'Choisissez les deux points pour calculer le trajet.'
          )}
        </span>
        <button
          type="button"
          className="button secondary small"
          onClick={route}
          disabled={busy || !draft.from || !draft.to}
        >
          {busy ? 'Calcul en cours…' : draft.route ? 'Recalculer le trajet' : 'Calculer mon trajet'}
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <p className="caption">
        Recherche et carte © OpenStreetMap · Itinéraire routier OSRM. Vous pouvez déplacer les
        repères.
      </p>
    </div>
  );
}
