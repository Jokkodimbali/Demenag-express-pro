import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../../shared/application/context';
import { mapConfiguration } from '../../../shared/config/maps';
import type { Point } from '../../../shared/domain/model';

type AddressResult = { label: string; point: Point };

function companyLocationIcon() {
  return L.divIcon({
    className: 'company-location-marker-host',
    html: '<span class="company-location-marker" aria-hidden="true"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function CompanyLocationPicker({
  latitude,
  longitude,
  address,
  onSave,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  address: string;
  onSave: (latitude: number, longitude: number) => Promise<void>;
}) {
  const { api } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const locationRef = useRef<Point | null>(
    latitude == null || longitude == null ? null : [latitude, longitude],
  );
  locationRef.current = latitude == null || longitude == null ? null : [latitude, longitude];
  const savePointRef = useRef<(point: Point) => void>(() => undefined);
  const [query, setQuery] = useState(address);
  const [label, setLabel] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(
    latitude == null || longitude == null ? null : [latitude, longitude],
  );

  useEffect(() => {
    if (!host.current) return;
    const initial: Point = locationRef.current ?? [14.7167, -17.4677];
    const instance = L.map(host.current, {
      scrollWheelZoom: true,
      minZoom: 7,
      maxZoom: 20,
    }).setView(initial, locationRef.current ? 14 : 10);
    L.tileLayer(mapConfiguration.tileUrl, mapConfiguration.tileOptions).addTo(instance);
    map.current = instance;
    instance.on('click', (event: L.LeafletMouseEvent) => {
      savePointRef.current([event.latlng.lat, event.latlng.lng]);
    });
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || latitude == null || longitude == null) return;
    const point: Point = [latitude, longitude];
    if (marker.current) marker.current.setLatLng(point);
    else marker.current = L.marker(point, { icon: companyLocationIcon() }).addTo(map.current);
    map.current.setView(point, 14, { animate: false });
    setSelectedPoint((current) =>
      current?.[0] === latitude && current?.[1] === longitude ? current : point,
    );
  }, [latitude, longitude]);

  const savePoint = useCallback(
    async (point: Point, addressLabel = '') => {
      setSelectedPoint(point);
      setError('');
      if (map.current) {
        if (marker.current) marker.current.setLatLng(point);
        else marker.current = L.marker(point, { icon: companyLocationIcon() }).addTo(map.current);
        map.current.setView(point, Math.max(map.current.getZoom(), 14), { animate: true });
      }
      setLabel(addressLabel);
      setSaving(true);
      try {
        await onSaveRef.current(point[0], point[1]);
        if (!addressLabel) {
          const resolved = await api.reverse(point).catch(() => '');
          if (resolved && typeof resolved !== 'string') setLabel(resolved.label);
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'La localisation n’a pas été enregistrée.',
        );
      } finally {
        setSaving(false);
      }
    },
    [api],
  );
  savePointRef.current = (point) => {
    void savePoint(point);
  };

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void savePoint([position.coords.latitude, position.coords.longitude]);
      },
      (cause) => {
        setLocating(false);
        setError(
          cause.code === cause.PERMISSION_DENIED
            ? 'Autorisez la géolocalisation du navigateur pour utiliser la position actuelle.'
            : cause.code === cause.TIMEOUT
              ? 'La recherche de la position a expiré. Réessayez.'
              : 'La position actuelle n’a pas pu être déterminée.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  async function searchAddress() {
    const value = query.trim();
    if (value.length < 3) {
      setError('Saisissez au moins trois caractères pour rechercher l’adresse.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setResults(await api.search(value));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La recherche d’adresse a échoué.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="company-location-picker" aria-busy={busy || saving}>
      <div className="company-location-heading">
        <strong>Localisation des locaux de l’entreprise</strong>
        <span>
          Recherchez l’adresse ou cliquez sur la carte. Cette position sert à calculer la distance
          routière jusqu’au départ du client.
        </span>
      </div>
      <div className="company-location-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void searchAddress();
            }
          }}
          placeholder="Rechercher l’adresse des locaux"
          aria-label="Rechercher l’adresse des locaux de l’entreprise"
        />
        <button type="button" onClick={() => void searchAddress()} disabled={busy}>
          {busy ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>
      <button
        type="button"
        className="company-location-current"
        onClick={useCurrentLocation}
        disabled={locating || saving}
      >
        {locating ? 'Localisation en cours…' : 'Utiliser la position actuelle'}
      </button>
      {results.length > 0 && (
        <div className="company-location-results" role="listbox" aria-label="Adresses trouvées">
          {results.map((result) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={`${result.point[0]}-${result.point[1]}-${result.label}`}
              onClick={() => {
                setQuery(result.label);
                setResults([]);
                void savePoint(result.point, result.label);
              }}
            >
              {result.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={host}
        className="company-location-map"
        role="region"
        aria-label="Carte pour définir la localisation des locaux de l’entreprise"
      />
      <div className="company-location-status">
        {saving ? (
          <span role="status">Enregistrement de la localisation…</span>
        ) : selectedPoint ? (
          <span>
            {label || 'Position sélectionnée'} · {selectedPoint[0].toFixed(5)},{' '}
            {selectedPoint[1].toFixed(5)}
          </span>
        ) : (
          <span>Aucune position enregistrée. Placez le repère sur les locaux de l’entreprise.</span>
        )}
        {error && <small role="alert">{error}</small>}
      </div>
    </section>
  );
}
