import express from 'express';
import { messages } from '../../../domain/messages/fr.js';
import { createAccess } from './access.js';
import { getActor } from './actor.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerBookingRoutes } from './booking-routes.js';
import { registerDriverRoutes } from './driver-routes.js';
import type { Dependencies } from './dependencies.js';
import { registerErrorHandler } from './error-handler.js';
import { registerMapRoutes } from './map-routes.js';
import { registerSecurityMiddleware } from './security-middleware.js';
import { apiRoutes } from './routes.js';
export function createApp(deps: Dependencies) {
  const app = express();
  registerSecurityMiddleware(app, deps);
  const access = createAccess(deps);
  app.get(apiRoutes.health, (_req, res) => res.json({ status: 'ok' }));
  app.get(apiRoutes.ready, async (_req, res) => {
    try {
      await deps.ready();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ message: messages.baseDeDonneesIndisponible });
    }
  });
  app.get(apiRoutes.catalogue, async (_req, res) => res.json(await deps.catalogue.get()));
  registerAuthRoutes(app, deps, access);
  registerMapRoutes(app, deps);
  app.get('/api/notifications/stream', access.authenticate, (req, res) => {
    const actor = getActor(res);
    res.writeHead(200, {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    });
    res.write(': connected\n\n');
    const unsubscribe = deps.notifications?.subscribe(actor, (notification) =>
      res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`),
    );
    if (unsubscribe) req.on('close', unsubscribe);
  });
  registerBookingRoutes(app, deps, access, deps.notifications);
  registerAdminRoutes(app, deps, access);
  registerDriverRoutes(app, deps, access);
  app.use((_req, res) => res.status(404).json({ message: 'Route introuvable.' }));
  registerErrorHandler(app);
  return app;
}
