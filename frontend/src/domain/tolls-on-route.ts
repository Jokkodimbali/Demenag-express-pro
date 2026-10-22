import type { Point, TollPoint } from './model';

// Une petite marge couvre les voies opposées et les positions approximatives des gares.
const MAX_DISTANCE_METERS = 150;
const METERS_PER_DEGREE = 111_195;

function distanceToSegmentMeters(
  point: Point,
  start: Point,
  end: Point,
): { distance: number; fraction: number } {
  const latitude = ((point[0] + start[0] + end[0]) / 3) * (Math.PI / 180);
  const longitudeScale = Math.cos(latitude);
  const x = (point[1] - start[1]) * METERS_PER_DEGREE * longitudeScale;
  const y = (point[0] - start[0]) * METERS_PER_DEGREE;
  const segmentX = (end[1] - start[1]) * METERS_PER_DEGREE * longitudeScale;
  const segmentY = (end[0] - start[0]) * METERS_PER_DEGREE;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const fraction = lengthSquared
    ? Math.max(0, Math.min(1, (x * segmentX + y * segmentY) / lengthSquared))
    : 0;
  return { distance: Math.hypot(x - fraction * segmentX, y - fraction * segmentY), fraction };
}

export function tollsOnRoute(geometry: Point[], points: TollPoint[]): TollPoint[] {
  if (geometry.length < 2) return [];
  return points
    .flatMap((point) => {
      if (point.latitude === null || point.longitude === null) return [];
      const location: Point = [point.latitude, point.longitude];
      let closest = { distance: Infinity, order: Infinity };
      for (let index = 1; index < geometry.length; index += 1) {
        const result = distanceToSegmentMeters(location, geometry[index - 1], geometry[index]);
        if (result.distance < closest.distance)
          closest = { distance: result.distance, order: index - 1 + result.fraction };
      }
      return closest.distance <= MAX_DISTANCE_METERS ? [{ point, order: closest.order }] : [];
    })
    .sort((first, second) => first.order - second.order)
    .map(({ point }) => point);
}
