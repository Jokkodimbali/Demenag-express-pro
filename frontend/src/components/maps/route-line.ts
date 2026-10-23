import L from 'leaflet';
import type { Point } from '../../domain/model';

export function addRouteLine(map: L.Map, points: Point[], dashed = false) {
  return L.featureGroup([
    L.polyline(points, { color: '#0d47a1', weight: 9, opacity: 0.35, interactive: false }),
    L.polyline(points, {
      color: '#1a73e8',
      weight: 6,
      opacity: 1,
      dashArray: dashed ? '8 10' : undefined,
      interactive: false,
    }),
  ]).addTo(map);
}
