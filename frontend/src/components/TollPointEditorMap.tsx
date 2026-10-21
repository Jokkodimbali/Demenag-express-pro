import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { mapConfiguration } from '../config/maps';
import type { TollPoint } from '../domain/model';
import { addTollMarkers, tollIcon } from './maps/toll-markers';

export function TollPointEditorMap({
  points,
  latitude,
  longitude,
  onSelect,
}: {
  points: TollPoint[];
  latitude: number | null;
  longitude: number | null;
  onSelect: (latitude: number, longitude: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const selectedMarker = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { scrollWheelZoom: false, minZoom: 7 }).setView(
      [14.6928, -17.4467],
      8,
    );
    map.current = instance;
    L.tileLayer(mapConfiguration.tileUrl, {
      attribution: mapConfiguration.attribution,
      maxZoom: 19,
    }).addTo(instance);
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
    const layer = addTollMarkers(map.current, points);
    return () => {
      layer.remove();
    };
  }, [points]);

  useEffect(() => {
    if (!map.current) return;
    selectedMarker.current?.remove();
    selectedMarker.current = null;
    if (latitude === null || longitude === null) return;
    const marker = L.marker([latitude, longitude], {
      icon: tollIcon,
      draggable: true,
      alt: 'Emplacement du péage en cours de modification',
    }).addTo(map.current);
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onSelectRef.current(position.lat, position.lng);
    });
    selectedMarker.current = marker;
    map.current.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div
      ref={host}
      className="toll-editor-map"
      role="region"
      aria-label="Carte des péages. Cliquez pour définir la position du point sélectionné."
    />
  );
}
