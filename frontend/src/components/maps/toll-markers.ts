import L from 'leaflet';
import type { TollPoint } from '../../domain/model';

export function tollIcon(name: string, selected = false, onRoute = false): L.DivIcon {
  const marker = document.createElement('div');
  marker.className = `toll-map-label${selected ? ' selected' : ''}${onRoute ? ' on-route' : ''}`;
  const badge = document.createElement('span');
  badge.className = 'toll-map-label-text';
  badge.textContent = name;
  const stem = document.createElement('span');
  stem.className = 'toll-map-label-stem';
  const dot = document.createElement('span');
  dot.className = 'toll-map-label-dot';
  marker.append(badge, stem, dot);
  return L.divIcon({
    className: 'toll-map-icon-host',
    html: marker,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function addTollMarkers(
  map: L.Map,
  points: TollPoint[],
  onSelect?: (point: TollPoint) => void,
  selectedIds: ReadonlySet<string> = new Set(),
  onDragEnd?: (point: TollPoint, latitude: number, longitude: number) => void,
  routeIds: ReadonlySet<string> = new Set(),
): L.LayerGroup {
  const layer = L.layerGroup().addTo(map);
  for (const point of points) {
    if (point.latitude === null || point.longitude === null) continue;
    const selected = selectedIds.has(point.id);
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = point.name;
    const detail = document.createElement('div');
    detail.textContent = point.region || point.axis || 'Point de péage';
    popup.append(title, detail);
    const marker = L.marker([point.latitude, point.longitude], {
      icon: tollIcon(point.name, selected, routeIds.has(point.id)),
      alt: `Péage ${point.name}`,
      draggable: selected && Boolean(onDragEnd),
      zIndexOffset: selected ? 1000 : routeIds.has(point.id) ? 500 : 0,
      bubblingMouseEvents: false,
    })
      .bindPopup(popup)
      .addTo(layer);
    if (onSelect) marker.on('click', () => onSelect(point));
    if (selected && onDragEnd)
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onDragEnd(point, position.lat, position.lng);
      });
  }
  return layer;
}
