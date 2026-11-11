import type { Clock, IdGenerator, RouteRepository, RoutingProvider } from '../../ports/index.js';
import type { Point } from '../../../domain/shared/model.js';

export async function createRouteTicket(
  routing: RoutingProvider,
  routes: RouteRepository,
  clock: Clock,
  ids: IdGenerator,
  from: Point,
  to: Point,
) {
  const route = await routing.route(from, to);
  const ticket = {
    ...route,
    id: ids.next(),
    expiresAt: new Date(+clock.now() + 30 * 60000).toISOString(),
  };
  await routes.save(ticket);
  return ticket;
}
