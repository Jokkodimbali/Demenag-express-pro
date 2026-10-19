import type { Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { security } from '../../../config/security.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Dependencies } from './dependencies.js';
import { routeSchema } from './schemas.js';
import { apiRoutes } from './routes.js';
export function registerMapRoutes(app: Express, deps: Pick<Dependencies, 'moving'>) {
  app.use(
    apiRoutes.maps.base,
    rateLimit({
      ...security.limits.maps,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: messages.tropDeRecherchesPatientezUneMinute },
    }),
  );
  app.post(apiRoutes.maps.route, async (req, res) => {
    const p = routeSchema.parse(req.body);
    res.json(await deps.moving.route(p.from, p.to));
  });
  app.get(apiRoutes.maps.search, async (req, res) =>
    res.json(await deps.moving.search(z.string().trim().min(3).max(200).parse(req.query.q))),
  );
  app.get(`${apiRoutes.maps.base}/reverse`, async (req, res) => {
    const point = z
      .tuple([z.coerce.number().min(-90).max(90), z.coerce.number().min(-180).max(180)])
      .parse([req.query.lat, req.query.lon]);
    res.json({ label: await deps.moving.reverse(point) });
  });
}
