import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { mapConfiguration } from '../../config/maps';
import { messages } from '../../content/fr';
import type { Point } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
type Side = 'from' | 'to';
const pin = (side: Side) =>
  L.divIcon({
    className: 'map-pin-host',
    html: `<span class="map-pin ${side}"><span>${side === 'from' ? 'A' : 'B'}</span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
  });
export function useRouteMap() {
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
    L.tileLayer(mapConfiguration.tileUrl, {
      attribution: mapConfiguration.attribution,
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
        alt: side === 'from' ? messages.pointDeDepart : messages.pointDArrivee,
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
      setError(messages.saisissezAuMoinsTroisCaracteres);
      return;
    }
    const id = ++searchRequest.current;
    setSearching(side);
    setError('');
    try {
      const items = await api.search(q);
      if (id === searchRequest.current) {
        setResults({ side, items });
        if (!items.length) setError(messages.aucuneAdresseTrouveePlacezLePointSurLa);
      }
    } catch (e) {
      if (id === searchRequest.current) setError(errorMessage(e));
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
      if (id === routeRequest.current) setError(errorMessage(e));
    } finally {
      if (id === routeRequest.current) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(messages.laGeolocalisationEstIndisponible);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPointRef.current(
          'from',
          [p.coords.latitude, p.coords.longitude],
          'Ma position actuelle',
        ),
      () => setError(messages.positionIndisponibleAutorisezLaGeolocalisationOuUtilisezLa),
      { timeout: 10000, enableHighAccuracy: true },
    );
  }
  return {
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
    map,
    setPointRef,
    from,
    to,
    address,
    search,
    route,
    locate,
  };
}
