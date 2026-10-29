import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { liveTrafficTileUrl, mapConfiguration } from '../../config/maps';
import { addReferenceTollMarkers, addTollMarkers } from '../../components/maps/toll-markers';
import { addRouteLine } from '../../components/maps/route-line';
import { messages } from '../../content/fr';
import type { Point, TollPoint } from '../../domain/model';
import { tollLine, type TollExtraLine } from '../../domain/toll-selection';
import { tollsOnRoute } from '../../domain/tolls-on-route';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
type Side = 'from' | 'to';
const EMPTY_TOLL_LINES: TollExtraLine[] = [];
const pin = (side: Side) =>
  L.divIcon({
    className: 'map-pin-host',
    html: `<span class="map-pin ${side}"><span>${side === 'from' ? 'A' : 'B'}</span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
export function useRouteMap(
  tollLines: TollExtraLine[] = EMPTY_TOLL_LINES,
  onTollToggle?: (line: TollExtraLine, selected: boolean) => void,
  referenceQuoteMap = false,
) {
  const { api, draft, setDraft, tollPoints } = useApp();
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
    line = useRef<L.FeatureGroup | null>(null);
  const tollLayer = useRef<L.LayerGroup | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const canChooseTolls = Boolean(onTollToggle);
  const tollStateRef = useRef({ tollLines, onTollToggle });
  tollStateRef.current = { tollLines, onTollToggle };
  const routeRequest = useRef(0),
    searchRequest = useRef(0),
    addressRequests = useRef<Record<Side, number>>({ from: 0, to: 0 });
  const { from, to } = draft;
  const routeTolls = useMemo(
    () => tollsOnRoute(draft.route?.geometry ?? [], tollPoints),
    [draft.route, tollPoints],
  );
  const toggleToll = useCallback(
    (point: TollPoint) => {
      const { tollLines: current, onTollToggle: toggle } = tollStateRef.current;
      if (!toggle) return;
      const existing = current.find((line) => line.id === point.id);
      toggle(existing ?? tollLine(point, draft.vehicleId, 'round-trip', 1), !existing);
    },
    [draft.vehicleId],
  );
  const setPointRef = useRef<(side: Side, point: Point, label?: string) => void>(() => {});
  setPointRef.current = (side, point, label) => {
    routeRequest.current++;
    searchRequest.current++;
    const requestId = ++addressRequests.current[side];
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
    if (!label) {
      void api
        .reverse(point)
        .then(({ label: address }) => {
          if (requestId === addressRequests.current[side]) {
            setDraft((d) => ({ ...d, [side + 'Address']: address }));
          }
        })
        .catch(() => undefined);
    }
    if (side === 'from') setActive('to');
  };
  const calculateRoute = useCallback(
    async (from: Point, to: Point) => {
      const id = ++routeRequest.current;
      setBusy(true);
      setError('');
      setDraft((d) => ({ ...d, route: null, distanceKmOverride: null }));
      try {
        const result = await api.route(from, to);
        if (id === routeRequest.current) setDraft((d) => ({ ...d, route: result }));
      } catch (e) {
        if (id === routeRequest.current) setError(errorMessage(e));
      } finally {
        if (id === routeRequest.current) setBusy(false);
      }
    },
    [api, setDraft],
  );
  useLayoutEffect(() => {
    if (!host.current) return;
    const routeCounter = routeRequest;
    const searchCounter = searchRequest;
    const m = L.map(host.current, {
      scrollWheelZoom: false,
      minZoom: 9,
      maxBounds: [
        [12, -18.2],
        [16.8, -11.2],
      ],
    }).setView([14.72, -17.22], 10);
    map.current = m;
    const trafficTiles = L.tileLayer(liveTrafficTileUrl(), mapConfiguration.tileOptions).addTo(m);
    const refreshTrafficTiles = window.setInterval(() => {
      trafficTiles.setUrl(liveTrafficTileUrl());
    }, 300000);
    m.on('click', (event) =>
      setPointRef.current(activeRef.current, [event.latlng.lat, event.latlng.lng]),
    );
    m.on('focus', () => m.scrollWheelZoom.enable());
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => {
      window.clearInterval(refreshTrafficTiles);
      observer.disconnect();
      m.remove();
      map.current = null;
      markers.current = {};
      line.current = null;
      tollLayer.current = null;
      routeCounter.current++;
      searchCounter.current++;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    map.current.eachLayer((layer) => {
      if (
        layer instanceof L.Popup &&
        layer.options.className?.includes('reference-toll-leaflet-popup')
      )
        layer.remove();
    });
    tollLayer.current?.eachLayer((layer) => {
      if (layer instanceof L.Marker) layer.closePopup();
    });
    tollLayer.current?.remove();
    tollLayer.current =
      referenceQuoteMap && canChooseTolls
        ? addReferenceTollMarkers(
            map.current,
            tollPoints,
            tollLines,
            draft.vehicleId,
            (point, quantity) => {
              map.current?.closePopup();
              const toggle = tollStateRef.current.onTollToggle;
              if (!toggle) return;
              if (quantity === 0) {
                const previous = tollLines.find((line) => line.id === point.id);
                if (previous) toggle(previous, false);
                return;
              }
              toggle(tollLine(point, draft.vehicleId, 'one-way', quantity), true);
            },
          )
        : addTollMarkers(
            map.current,
            tollPoints,
            canChooseTolls ? toggleToll : undefined,
            new Set(tollLines.map((item) => item.id)),
            undefined,
            new Set(routeTolls.map((point) => point.id)),
          );
    return () => {
      tollLayer.current?.eachLayer((layer) => {
        if (layer instanceof L.Marker) layer.closePopup();
      });
      tollLayer.current?.remove();
      tollLayer.current = null;
    };
  }, [
    tollPoints,
    canChooseTolls,
    tollLines,
    routeTolls,
    toggleToll,
    referenceQuoteMap,
    draft.vehicleId,
  ]);
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
        zIndexOffset: 2000,
      }).addTo(map.current);
      marker.on('click', () => setActive(side));
      marker.on('dragstart', () => setActive(side));
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
      line.current = addRouteLine(map.current, draft.route.geometry, draft.route.fallback);
      map.current.fitBounds(line.current.getBounds(), { padding: [50, 50] });
    }
  }, [draft.route]);
  useEffect(() => {
    if (from && to) void calculateRoute(from, to);
  }, [calculateRoute, from, to]);
  useEffect(() => {
    const resize = window.setTimeout(() => {
      const currentMap = map.current;
      if (!currentMap) return;
      currentMap.invalidateSize();
      if (line.current) currentMap.fitBounds(line.current.getBounds(), { padding: [60, 60] });
    }, 60);
    return () => window.clearTimeout(resize);
  }, [full]);
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
    addressRequests.current[side]++;
    setBusy(false);
    setSearching(null);
    setResults(null);
    setDraft((d) => ({
      ...d,
      [side + 'Address']: value,
      [side]: null,
      route: null,
      distanceKmOverride: null,
    }));
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
  async function geocode(side: Side) {
    const query = draft[(side + 'Address') as 'fromAddress' | 'toAddress'].trim();
    if (query.length < 3 || draft[side]) return;
    const id = ++searchRequest.current;
    setSearching(side);
    setError('');
    try {
      const items = await api.search(query);
      if (id !== searchRequest.current) return;
      if (items.length) setPointRef.current(side, items[0].point, query);
      else setError(messages.aucuneAdresseTrouveePlacezLePointSurLa);
    } catch (error) {
      if (id === searchRequest.current) setError(errorMessage(error));
    } finally {
      if (id === searchRequest.current) setSearching(null);
    }
  }
  function route() {
    if (draft.from && draft.to) void calculateRoute(draft.from, draft.to);
  }
  function clear() {
    routeRequest.current++;
    searchRequest.current++;
    addressRequests.current.from++;
    addressRequests.current.to++;
    setResults(null);
    setBusy(false);
    setSearching(null);
    setError('');
    setActive('from');
    setDraft((current) => ({
      ...current,
      from: null,
      to: null,
      fromAddress: '',
      toAddress: '',
      fromNote: '',
      toNote: '',
      route: null,
      distanceKmOverride: null,
    }));
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
    routeTolls,
    canChooseTolls,
    tollLines,
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
    map,
    setPointRef,
    from,
    to,
    address,
    search,
    geocode,
    route,
    clear,
    locate,
  };
}
