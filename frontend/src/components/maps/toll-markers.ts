import L from 'leaflet';
import type { TollPoint } from '../../domain/model';
import { money } from '../../domain/format';

export const tollIcon = L.divIcon({
  className: 'toll-map-icon-host',
  html: '<span class="toll-map-icon" aria-hidden="true">₣</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export function addTollMarkers(map: L.Map, points: TollPoint[]): L.LayerGroup {
  const layer = L.layerGroup().addTo(map);
  for (const point of points) {
    if (point.latitude === null || point.longitude === null) continue;
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = point.name;
    const detail = document.createElement('div');
    detail.textContent = `${point.operator} · Poids lourd : ${money(point.heavyPrice)} / passage`;
    popup.append(title, detail);
    L.marker([point.latitude, point.longitude], { icon: tollIcon, alt: `Péage ${point.name}` })
      .bindPopup(popup)
      .addTo(layer);
  }
  return layer;
}
