import type { Express } from 'express';
import { z } from 'zod';
import type { Access } from './access.js';
import type { Dependencies } from './dependencies.js';
import { bookingSchema, estimateSchema, quoteSchema, statusSchema } from './schemas.js';
export function registerBookingRoutes(
  app: Express,
  deps: Pick<Dependencies, 'moving'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  app.post('/api/estimates', async (req, res) => {
    const p = estimateSchema.parse(req.body);
    res.json(await deps.moving.estimate(p.vehicleId, p.routeId, p.options));
  });
  app.get('/api/bookings', authenticate, async (_req, res) =>
    res.json(await deps.moving.list(res.locals.user)),
  );
  app.post('/api/bookings', authenticate, async (req, res) =>
    res.status(201).json(await deps.moving.create(res.locals.user, bookingSchema.parse(req.body))),
  );
  app.get('/api/bookings/:id', authenticate, async (req, res) =>
    res.json(await deps.moving.get(res.locals.user, z.uuid().parse(req.params.id))),
  );
  app.patch('/api/bookings/:id/status', authenticate, async (req, res) => {
    const p = statusSchema.parse(req.body);
    res.json(
      await deps.moving.status(res.locals.user, z.uuid().parse(req.params.id), p.status, p.version),
    );
  });
  app.post('/api/bookings/:id/quotes', authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.moving.quote(
          res.locals.user,
          z.uuid().parse(req.params.id),
          quoteSchema.parse(req.body),
        ),
      ),
  );
}
