import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createAccess } from './access.js';
import { registerAdminRoutes } from './admin-routes.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerBookingRoutes } from './booking-routes.js';
import type { Dependencies } from './dependencies.js';
import { registerErrorHandler } from './error-handler.js';
import { registerMapRoutes } from './map-routes.js';
export function createApp(deps: Dependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const origins = [deps.origin];
  if (!deps.production && new URL(deps.origin).hostname === 'localhost')
    origins.push(deps.origin.replace('localhost', '127.0.0.1'));
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Trop de requêtes. Réessayez dans une minute.' },
    }),
  );
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('X-Requested-With') !== 'DemenagExpress' ||
        (req.get('Origin') && !origins.includes(req.get('Origin')!)))
    ) {
      res.status(403).json({ message: 'Origine de la requête refusée.' });
      return;
    }
    next();
  });
  const access = createAccess(deps);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/ready', async (_req, res) => {
    try {
      await deps.ready();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ message: 'Base de données indisponible.' });
    }
  });
  app.get('/api/catalogue', async (_req, res) => res.json(await deps.catalogue.get()));
  registerAuthRoutes(app, deps, access);
  registerMapRoutes(app, deps);
  registerBookingRoutes(app, deps, access);
  registerAdminRoutes(app, deps, access);
  app.use((_req, res) => res.status(404).json({ message: 'Route introuvable.' }));
  registerErrorHandler(app);
  return app;
}
