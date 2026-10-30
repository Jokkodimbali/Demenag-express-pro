import { uiText } from '../content/reference-ui-text';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { liveTrafficTileUrl, mapConfiguration } from '../config/maps';
import type { TollPoint } from '../domain/model';
import { addAdminTollMarkers } from './maps/admin-toll-markers';

export function TollPointEditorMap({
  points,
  selectedId,
  focusId,
  vehicleId,
  axisFilter,
  query,
  onSelect,
  onAdd,
  onMove,
}: {
  points: TollPoint[];
  selectedId: string | null;
  focusId: string | null;
  vehicleId: string;
  axisFilter: string | null;
  query: string;
  onSelect: (point: TollPoint) => void;
  onAdd: (latitude: number, longitude: number) => void;
  onMove: (point: TollPoint, latitude: number, longitude: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;

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
    const tileLayer = L.tileLayer(liveTrafficTileUrl(), mapConfiguration.tileOptions).addTo(
      instance,
    );
    const trafficRefresh = window.setInterval(() => {
      tileLayer.setUrl(liveTrafficTileUrl());
    }, 300000);
    instance.on('click', (event) => onAddRef.current(event.latlng.lat, event.latlng.lng));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      window.clearInterval(trafficRefresh);
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const layer = addAdminTollMarkers(
      map.current,
      points,
      vehicleId,
      selectedId,
      axisFilter,
      query,
      onSelect,
      onMove,
    );
    return () => {
      layer.remove();
    };
  }, [points, selectedId, vehicleId, axisFilter, query, onSelect, onMove]);

  useEffect(() => {
    if (!focusId || !map.current) return;
    const point = points.find((item) => item.id === focusId);
    if (point?.latitude !== null && point?.latitude !== undefined && point.longitude !== null)
      map.current.setView([point.latitude, point.longitude], 13, { animate: false });
  }, [points, focusId]);

  return (
    <div className="toll-admin-map-frame">
      <div
        ref={host}
        className="toll-editor-map toll-admin-reference-map"
        role="region"
        aria-label={uiText['carteDesPeagesCliquezPourDefinirLaPositionDuPointSelec']}
      />
      <div className="toll-admin-map-instruction">{uiText['clicCarteAjouterGlisserDeplacer']}</div>
    </div>
  );
}
