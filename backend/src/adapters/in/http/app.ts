import express from 'express';
import { messages } from '../../../domain/messages/fr.js';
import { createAccess } from './access.js';
import { getActor } from './actor.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerBookingRoutes } from './booking-routes.js';
import { registerDriverRoutes } from './driver-routes.js';
import { registerVehicleReportRoutes } from './vehicle-report-routes.js';
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
  app.get(apiRoutes.tollPoints, async (_req, res) => res.json(await deps.catalogue.listTollPoints()));
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
    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(': ping\n\n');
    }, 25000);
    const unsubscribe = deps.notifications?.subscribe(actor, (notification) =>
      res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`),
    );
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe?.();
    });
  });
  app.get('/api/notifications', access.authenticate, async (_req, res) =>
    res.json(await deps.notificationService.list(getActor(res))),
  );
  app.patch('/api/notifications/read-all', access.authenticate, async (_req, res) => {
    await deps.notificationService.markAllRead(getActor(res));
    res.status(204).end();
  });
  app.patch('/api/notifications/:id/read', access.authenticate, async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id))
      return res.status(400).json({ message: 'Notification invalide.' });
    await deps.notificationService.markRead(getActor(res), id);
    res.status(204).end();
  });
  app.post(
    '/api/admin/notifications/announce',
    access.authenticate,
    access.admin,
    async (req, res) => {
      const body = req.body as { title?: unknown; message?: unknown };
      if (
        typeof body.title !== 'string' ||
        !body.title.trim() ||
        body.title.length > 100 ||
        typeof body.message !== 'string' ||
        !body.message.trim() ||
        body.message.length > 1000
      )
        return res.status(400).json({
          message: 'Le titre et le message sont requis (100 et 1 000 caractères maximum).',
        });
      await deps.notificationService.announce(
        getActor(res),
        body.title.trim(),
        body.message.trim(),
      );
      res.status(201).json({ sent: true });
    },
  );
  registerBookingRoutes(app, deps, access, deps.notifications);
  registerAdminRoutes(app, deps, access);
  registerDriverRoutes(app, deps, access);
  registerVehicleReportRoutes(app, deps, access);
  app.use((_req, res) => res.status(404).json({ message: 'Route introuvable.' }));
  registerErrorHandler(app);
  return app;
}
