import L from 'leaflet';
import type { TollPoint } from '../../domain/model';
import type { TollExtraLine } from '../../domain/toll-selection';
import { tollPrice } from '../../domain/toll-prices';

const referenceAxisColors = [
  '#F6D73C',
  '#3DDC84',
  '#5AB0FF',
  '#2EC4B6',
  '#FF9F5A',
  '#B58CFF',
  '#FF6B8B',
  '#C9D36A',
];
export function addReferenceTollMarkers(
  map: L.Map,
  points: TollPoint[],
  lines: TollExtraLine[],
  vehicleId: string,
  onQuantityChange: (point: TollPoint, quantity: number) => void,
): L.LayerGroup {
  const layer = L.layerGroup().addTo(map);
  const axes = [...new Set(points.map((point) => point.axis || 'Autre route'))];
  for (const point of points) {
    if (point.latitude == null || point.longitude == null) continue;
    const quantity = lines.find((line) => line.id === point.id)?.quantity ?? 0;
    const color =
      referenceAxisColors[axes.indexOf(point.axis || 'Autre route') % referenceAxisColors.length];
    const iconContent = document.createElement('div');
    iconContent.className = quantity ? 'reference-toll-point selected' : 'reference-toll-point';
    iconContent.style.setProperty('--toll-color', color);
    if (quantity) {
      const count = document.createElement('span');
      count.className = 'reference-toll-point-count';
      count.textContent = `×${quantity}`;
      iconContent.append(count);
    }
    const dot = document.createElement('span');
    dot.className = 'reference-toll-point-dot';
    iconContent.append(dot);
    const marker = L.marker([point.latitude, point.longitude], {
      icon: L.divIcon({
        className: 'reference-toll-point-host',
        html: iconContent,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      alt: point.name,
      bubblingMouseEvents: false,
      zIndexOffset: quantity ? 1000 : 0,
    }).addTo(layer);
    const popup = document.createElement('div');
    popup.className = 'reference-toll-popup';
    const heading = document.createElement('div');
    heading.className = 'reference-toll-popup-heading';
    const headingDot = document.createElement('span');
    headingDot.style.background = color;
    const title = document.createElement('strong');
    title.textContent = point.name;
    heading.append(headingDot, title);
    const place = document.createElement('small');
    place.textContent = [point.axis || 'Autre route', point.region].filter(Boolean).join(' · ');
    const unitPrice = tollPrice(point, vehicleId);
    const price = document.createElement('div');
    price.className = 'reference-toll-popup-price';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = 'PAR PASSAGE';
    const priceValue = document.createElement('strong');
    priceValue.textContent = `${unitPrice.toLocaleString('fr-FR')} FCFA`;
    price.append(priceLabel, priceValue);
    const controls = document.createElement('div');
    controls.className = 'reference-toll-popup-controls';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.disabled = quantity === 0;
    minus.setAttribute('aria-label', `Retirer un passage à ${point.name}`);
    minus.onclick = (event) => {
      event.stopPropagation();
      onQuantityChange(point, Math.max(0, quantity - 1));
    };
    const count = document.createElement('div');
    count.className = 'reference-toll-popup-count';
    const countValue = document.createElement('strong');
    countValue.textContent = String(quantity);
    const countLabel = document.createElement('span');
    countLabel.textContent = `passage${quantity > 1 ? 's' : ''}`;
    count.append(countValue, countLabel);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', `Ajouter un passage à ${point.name}`);
    plus.onclick = (event) => {
      event.stopPropagation();
      onQuantityChange(point, Math.min(99, quantity + 1));
    };
    controls.append(minus, count, plus);
    const total = document.createElement('div');
    total.className = 'reference-toll-popup-total';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total';
    const totalValue = document.createElement('strong');
    totalValue.textContent = `${(unitPrice * quantity).toLocaleString('fr-FR')} FCFA`;
    total.append(totalLabel, totalValue);
    popup.append(heading, place, price, controls, total);
    const popupLayer = L.popup({
      closeButton: true,
      minWidth: 240,
      offset: [0, -8],
      className: 'reference-toll-leaflet-popup',
    })
      .setLatLng([point.latitude, point.longitude])
      .setContent(popup);
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const keepOpen = () => clearTimeout(closeTimer);
    const closeSoon = () => {
      keepOpen();
      closeTimer = setTimeout(() => map.closePopup(popupLayer), 450);
    };
    popup.onmouseenter = keepOpen;
    popup.onmouseleave = closeSoon;
    popupLayer.on('remove', keepOpen);
    marker.on('mouseover', () => {
      keepOpen();
      popupLayer.openOn(map);
    });
    marker.on('mouseout', closeSoon);
    marker.on('click', () => onQuantityChange(point, Math.min(99, quantity + 1)));
  }
  return layer;
}

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
