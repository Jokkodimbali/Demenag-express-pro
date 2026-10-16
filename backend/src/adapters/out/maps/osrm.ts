import type { RoutingProvider } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import type { Point } from '../../../domain/model.js';
export class OpenStreetMaps implements RoutingProvider {
  private searchQueue = Promise.resolve();
  private lastSearch = 0;
  private cache = new Map<string, { at: number; items: { label: string; point: Point }[] }>();
  constructor(
    private osrm: string,
    private nominatim: string,
    private userAgent: string,
  ) {}
  async route(from: Point, to: Point) {
    try {
      const response = await fetch(
        `${this.osrm}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,
        { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': this.userAgent } },
      );
      if (!response.ok) throw new Error('HTTP');
      const data = (await response.json()) as {
        routes?: { distance: number; duration: number; geometry: { coordinates: Point[] } }[];
      };
      const route = data.routes?.[0];
      if (
        !route ||
        !Number.isFinite(route.distance) ||
        route.distance < 100 ||
        route.distance > 1500000
      )
        throw new Error('Route');
      return {
        from,
        to,
        distanceKm: Math.round(route.distance / 100) / 10,
        durationMinutes: Math.ceil(route.duration / 60),
        geometry: route.geometry.coordinates.map(([lng, lat]): Point => [lat, lng]),
      };
    } catch {
      throw new AppError(
        503,
        'Le calcul du trajet est indisponible. Réessayez dans un instant.',
        'ROUTING_UNAVAILABLE',
      );
    }
  }
  async search(query: string) {
    const key = query.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 3600000) return cached.items;
    const previous = this.searchQueue;
    let release!: () => void;
    this.searchQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const delay = Math.max(0, 1100 - (Date.now() - this.lastSearch));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.lastSearch = Date.now();
      const response = await fetch(
        `${this.nominatim}/search?format=jsonv2&countrycodes=sn&limit=5&q=${encodeURIComponent(query)}`,
        {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'fr' },
        },
      );
      if (!response.ok) throw new Error('HTTP');
      const results = (await response.json()) as {
        display_name: string;
        lat: string;
        lon: string;
      }[];
      const items = results.map((r) => ({
        label: r.display_name,
        point: [+r.lat, +r.lon] as Point,
      }));
      if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { at: Date.now(), items });
      return items;
    } catch {
      throw new AppError(
        503,
        'La recherche d’adresse est indisponible. Vous pouvez placer les points sur la carte.',
      );
    } finally {
      release();
    }
  }
}
