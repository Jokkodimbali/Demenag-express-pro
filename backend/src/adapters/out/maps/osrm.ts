import type { RoutingProvider } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Point, Route } from '../../../domain/model.js';

const MAX_ROUTE_WAITERS = 32;
const MAX_PENDING_ADDRESS_REQUESTS = 10;

export class OpenStreetMaps implements RoutingProvider {
  private addressQueue = Promise.resolve();
  private pendingAddressRequests = 0;
  private lastAddressRequest = 0;
  private cache = new Map<string, { at: number; items: { label: string; point: Point }[] }>();
  private reverseCache = new Map<string, { at: number; label: string }>();
  private reverseQueue = new Map<string, Promise<string>>();
  private routeCache = new Map<string, { at: number; route: Route }>();
  private routeQueue = new Map<string, Promise<Route>>();
  private activeRouteRequests = 0;
  private routeWaiters: (() => void)[] = [];
  constructor(
    private osrm: string,
    private nominatim: string,
    private userAgent: string,
  ) {}
  async route(from: Point, to: Point) {
    const key = `${from[0]},${from[1]}:${to[0]},${to[1]}`;
    const cached = this.routeCache.get(key);
    if (cached && Date.now() - cached.at < 15 * 60_000) return cached.route;
    if (cached) this.routeCache.delete(key);
    const pending = this.routeQueue.get(key);
    if (pending) return pending;

    const request = this.withRouteSlot(() => this.fetchRoute(from, to)).then((route) => {
      if (this.routeCache.size >= 500) this.routeCache.delete(this.routeCache.keys().next().value!);
      this.routeCache.set(key, { at: Date.now(), route });
      return route;
    });
    this.routeQueue.set(key, request);
    try {
      return await request;
    } finally {
      this.routeQueue.delete(key);
    }
  }

  private async fetchRoute(from: Point, to: Point): Promise<Route> {
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
        messages.leCalculDuTrajetEstIndisponibleReessayezDans,
        'ROUTING_UNAVAILABLE',
      );
    }
  }

  private async withRouteSlot<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeRouteRequests >= 8) {
      if (this.routeWaiters.length >= MAX_ROUTE_WAITERS)
        throw new AppError(503, messages.leServiceCartographiqueEstSurcharge, 'MAP_PROVIDER_BUSY');
      await new Promise<void>((resolve) => this.routeWaiters.push(resolve));
    } else this.activeRouteRequests++;
    try {
      return await operation();
    } finally {
      const next = this.routeWaiters.shift();
      if (next) next();
      else this.activeRouteRequests--;
    }
  }

  private async withAddressLimit<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pendingAddressRequests >= MAX_PENDING_ADDRESS_REQUESTS)
      throw new AppError(503, messages.leServiceCartographiqueEstSurcharge, 'MAP_PROVIDER_BUSY');
    this.pendingAddressRequests++;
    const previous = this.addressQueue;
    let release!: () => void;
    this.addressQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const delay = Math.max(0, 1100 - (Date.now() - this.lastAddressRequest));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.lastAddressRequest = Date.now();
      return await operation();
    } finally {
      this.pendingAddressRequests--;
      release();
    }
  }
  async search(query: string) {
    const key = query.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 3600000) return cached.items;
    try {
      return await this.withAddressLimit(async () => {
        const newlyCached = this.cache.get(key);
        if (newlyCached && Date.now() - newlyCached.at < 3600000) return newlyCached.items;
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
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, messages.laRechercheDAdresseEstIndisponibleVousPouvez);
    }
  }
  async reverse(point: Point) {
    const key = `${point[0]},${point[1]}`;
    const cached = this.reverseCache.get(key);
    if (cached && Date.now() - cached.at < 3600000) return cached.label;
    if (cached) this.reverseCache.delete(key);
    const pending = this.reverseQueue.get(key);
    if (pending) return pending;

    const request = this.withAddressLimit(async () => {
      const newlyCached = this.reverseCache.get(key);
      if (newlyCached && Date.now() - newlyCached.at < 3600000) return newlyCached.label;
      try {
        const response = await fetch(
          `${this.nominatim}/reverse?format=jsonv2&lat=${point[0]}&lon=${point[1]}&zoom=18`,
          {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'fr' },
          },
        );
        if (!response.ok) throw new Error('HTTP');
        const result = (await response.json()) as { display_name?: string };
        if (!result.display_name) throw new Error('Address');
        if (this.reverseCache.size >= 500)
          this.reverseCache.delete(this.reverseCache.keys().next().value!);
        this.reverseCache.set(key, { at: Date.now(), label: result.display_name });
        return result.display_name;
      } catch {
        throw new AppError(503, messages.laRechercheDAdresseEstIndisponibleVousPouvez);
      }
    });
    this.reverseQueue.set(key, request);
    try {
      return await request;
    } finally {
      this.reverseQueue.delete(key);
    }
  }
}
