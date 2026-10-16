import type { Express } from 'express';
import { z } from 'zod';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import {
  bookingSchema,
  driverAssignmentSchema,
  estimateSchema,
  quoteSchema,
  statusSchema,
} from './schemas.js';
import { apiRoutes } from './routes.js';
export function registerBookingRoutes(
  app: Express,
  deps: Pick<Dependencies, 'moving'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  app.post(apiRoutes.estimates, async (req, res) => {
    const p = estimateSchema.parse(req.body);
    res.json(await deps.moving.estimate(p.vehicleId, p.routeId, p.options));
  });
  app.get(apiRoutes.bookings, authenticate, async (_req, res) =>
    res.json(await deps.moving.list(getActor(res))),
  );
  app.post(apiRoutes.bookings, authenticate, async (req, res) =>
    res.status(201).json(await deps.moving.create(getActor(res), bookingSchema.parse(req.body))),
  );
  app.get(`${apiRoutes.bookings}/:id`, authenticate, async (req, res) =>
    res.json(await deps.moving.get(getActor(res), z.uuid().parse(req.params.id))),
  );
  app.patch(`${apiRoutes.bookings}/:id/status`, authenticate, async (req, res) => {
    const p = statusSchema.parse(req.body);
    res.json(
      await deps.moving.status(getActor(res), z.uuid().parse(req.params.id), p.status, p.version),
    );
  });
  app.patch(`${apiRoutes.bookings}/:id/driver`, authenticate, admin, async (req, res) => {
    const p = driverAssignmentSchema.parse(req.body);
    res.json(
      await deps.moving.assignDriver(
        getActor(res),
        z.uuid().parse(req.params.id),
        p.driverId,
        p.version,
      ),
    );
  });
  app.post(`${apiRoutes.bookings}/:id/quotes`, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.moving.quote(
          getActor(res),
          z.uuid().parse(req.params.id),
          quoteSchema.parse(req.body),
        ),
      ),
  );
}
