import type { Clock, RouteTicketCodec, RoutingProvider } from '../../ports/index.js';
import type { Point } from '../../../domain/shared/model.js';

export async function createRouteTicket(
  routing: RoutingProvider,
  routeTickets: RouteTicketCodec,
  clock: Clock,
  from: Point,
  to: Point,
) {
  const route = await routing.route(from, to);
  const expiresAt = new Date(+clock.now() + 30 * 60000).toISOString();
  return routeTickets.issue(route, expiresAt);
}
