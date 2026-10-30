import L from 'leaflet';
import type { TollPoint } from '../../domain/model';
import { tollPrice } from '../../domain/toll-prices';

const axisColors = [
  '#F6D73C',
  '#3DDC84',
  '#5AB0FF',
  '#2EC4B6',
  '#FF9F5A',
  '#B58CFF',
  '#FF6B8B',
  '#C9D36A',
];

export function addAdminTollMarkers(
  map: L.Map,
  points: TollPoint[],
  vehicleId: string,
  selectedId: string | null,
  axisFilter: string | null,
  query: string,
  onSelect: (point: TollPoint) => void,
  onMove: (point: TollPoint, latitude: number, longitude: number) => void,
): L.LayerGroup {
  const layer = L.layerGroup().addTo(map);
  const axes = [...new Set(points.map((point) => point.axis || 'Autre route'))];
  const needle = query.trim().toLocaleLowerCase('fr');

  for (const point of points) {
    if (point.latitude === null || point.longitude === null) continue;
    if (axisFilter && (point.axis || 'Autre route') !== axisFilter) continue;
    if (
      needle &&
      !`${point.name} ${point.axis} ${point.region}`.toLocaleLowerCase('fr').includes(needle)
    )
      continue;

    const color = axisColors[axes.indexOf(point.axis || 'Autre route') % axisColors.length];
    const selected = selectedId === point.id;
    const markerContent = document.createElement('div');
    markerContent.className = `toll-admin-marker${selected ? ' selected' : ''}`;
    markerContent.style.setProperty('--toll-marker-color', color);

    const priceBadge = document.createElement('span');
    priceBadge.className = 'toll-admin-marker-price';
    priceBadge.textContent = tollPrice(point, vehicleId).toLocaleString('fr-FR');
    const dot = document.createElement('span');
    dot.className = 'toll-admin-marker-dot';
    markerContent.append(priceBadge, dot);

    const marker = L.marker([point.latitude, point.longitude], {
      icon: L.divIcon({
        className: 'toll-admin-marker-host',
        html: markerContent,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      title: point.name,
      alt: point.name,
      draggable: true,
      zIndexOffset: selected ? 1000 : 0,
      bubblingMouseEvents: false,
    }).addTo(layer);
    marker.on('click', () => onSelect(point));
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onMove(point, position.lat, position.lng);
    });
  }

  return layer;
}

export function tollAxisColor(axis: string, points: TollPoint[]): string {
  const axes = [...new Set(points.map((point) => point.axis || 'Autre route'))];
  const index = axes.indexOf(axis || 'Autre route');
  return axisColors[(index < 0 ? 0 : index) % axisColors.length];
}
