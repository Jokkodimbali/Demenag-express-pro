import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { Dependencies } from './dependencies.js';
import { routeSchema } from './schemas.js';
export function registerMapRoutes(app: Express, deps: Pick<Dependencies, 'moving'>) {
  app.use(
    '/api/maps',
    rateLimit({
      windowMs: 60000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Trop de recherches. Patientez une minute.' },
    }),
  );
  app.post('/api/maps/route', async (req, res) => {
    const p = routeSchema.parse(req.body);
    res.json(await deps.moving.route(p.from, p.to));
  });
  app.get('/api/maps/search', async (req, res) =>
    res.json(await deps.moving.search(z.string().trim().min(3).max(200).parse(req.query.q))),
  );
}
