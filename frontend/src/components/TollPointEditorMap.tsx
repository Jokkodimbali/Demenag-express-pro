import { uiText } from '../content/reference-ui-text';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { mapConfiguration } from '../config/maps';
import type { TollPoint } from '../domain/model';
import { addTollMarkers, tollIcon } from './maps/toll-markers';

export function TollPointEditorMap({
  points,
  selectedId,
  name,
  latitude,
  longitude,
  region,
  focusRequest,
  onSelect,
  onPointClick,
}: {
  points: TollPoint[];
  selectedId: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
  region: string;
  focusRequest: number;
  onSelect: (latitude: number, longitude: number) => void;
  onPointClick: (point: TollPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const selectedMarker = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, {
      scrollWheelZoom: true,
      minZoom: 8,
      maxBounds: [
        [12, -18.2],
        [16.8, -11.2],
      ],
    }).setView([14.72, -17.22], 10);
    map.current = instance;
    L.tileLayer(mapConfiguration.tileUrl, mapConfiguration.tileOptions).addTo(instance);
    instance.on('click', (event) => onSelectRef.current(event.latlng.lat, event.latlng.lng));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      selectedMarker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const displayedPoints = points.map((point) =>
      point.id === selectedId
        ? { ...point, name: name.trim() || point.name, latitude, longitude }
        : point,
    );
    const layer = addTollMarkers(
      map.current,
      displayedPoints,
      (point) => onPointClickRef.current(point),
      selectedId ? new Set([selectedId]) : undefined,
      (_point, latitude, longitude) => onSelectRef.current(latitude, longitude),
    );
    return () => {
      layer.remove();
    };
  }, [points, selectedId, name, latitude, longitude]);

  useEffect(() => {
    if (!map.current) return;
    selectedMarker.current?.remove();
    selectedMarker.current = null;
    if (selectedId || latitude === null || longitude === null) return;
    const marker = L.marker([latitude, longitude], {
      icon: tollIcon(name.trim() || 'Nouveau péage', true),
      draggable: true,
      alt: 'Emplacement du péage en cours de modification',
    }).addTo(map.current);
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onSelectRef.current(position.lat, position.lng);
    });
    selectedMarker.current = marker;
    map.current.panTo([latitude, longitude]);
  }, [selectedId, name, latitude, longitude]);

  useEffect(() => {
    if (!selectedId || !map.current) return;
    if (latitude !== null && longitude !== null) {
      map.current.setView([latitude, longitude], 14, { animate: false });
      return;
    }
    const regionCenters: Record<string, L.LatLngTuple> = {
      Dakar: [14.75, -17.32],
      Thiès: [14.75, -16.95],
      Fatick: [14.13, -16.47],
      Sédhiou: [12.84, -15.98],
    };
    const center = regionCenters[region];
    if (center) map.current.setView(center, 10, { animate: false });
  }, [focusRequest, selectedId, latitude, longitude, region]);

  return (
    <div
      ref={host}
      className="toll-editor-map"
      role="region"
      aria-label={uiText['carteDesPeagesCliquezPourDefinirLaPositionDuPointSelec']}
    />
  );
}
