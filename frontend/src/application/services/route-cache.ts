import type { ApplicationApi } from '../ports';
import type { Point, RouteTicket } from '../../domain/model';

const maxCachedRoutes = 100;
const routeCache = new Map<string, RouteTicket>();
const pendingRoutes = new Map<string, Promise<RouteTicket>>();

function routeKey(from: Point, to: Point) {
  return `${from[0]},${from[1]}:${to[0]},${to[1]}`;
}

export function getCachedRoute(
  api: Pick<ApplicationApi, 'route'>,
  from: Point,
  to: Point,
): Promise<RouteTicket> {
  const key = routeKey(from, to);
  const cached = routeCache.get(key);
  if (cached) {
    routeCache.delete(key);
    routeCache.set(key, cached);
    return Promise.resolve(cached);
  }

  const pending = pendingRoutes.get(key);
  if (pending) return pending;

  const request = api
    .route(from, to)
    .then((route) => {
      routeCache.set(key, route);
      if (routeCache.size > maxCachedRoutes) {
        const oldest = routeCache.keys().next().value;
        if (oldest) routeCache.delete(oldest);
      }
      return route;
    })
    .finally(() => pendingRoutes.delete(key));
  pendingRoutes.set(key, request);
  return request;
}
