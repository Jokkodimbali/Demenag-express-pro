import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import { driverProfileSchema } from './schemas.js';
import { apiRoutes } from './routes.js';

export function registerDriverRoutes(
  app: Express,
  deps: Pick<Dependencies, 'drivers'>,
  access: Pick<Access, 'authenticate'>,
) {
  app.get(apiRoutes.driver.profile, access.authenticate, async (_req, res) =>
    res.json(await deps.drivers.profile(getActor(res))),
  );
  app.put(apiRoutes.driver.profile, access.authenticate, async (req, res) =>
    res.json(await deps.drivers.updateProfile(getActor(res), driverProfileSchema.parse(req.body))),
  );
  app.get(apiRoutes.driver.bookings, access.authenticate, async (_req, res) =>
    res.json(await deps.drivers.bookings(getActor(res))),
  );
}
