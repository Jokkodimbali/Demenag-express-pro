import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import { driverAvailabilitySchema, driverProfileSchema, employeeProofSchema } from './schemas.js';
import { apiRoutes } from './routes.js';

export function registerDriverRoutes(
  app: Express,
  deps: Pick<Dependencies, 'drivers'>,
  access: Pick<Access, 'authenticate'>,
) {
  app.post(`${apiRoutes.driver.bookings}/:id/proofs`, access.authenticate, async (req, res) => {
    const input = employeeProofSchema.parse(req.body);
    res.json(
      await deps.drivers.addProofs(getActor(res), String(req.params.id), input.kind, input.photos),
    );
  });
  app.get(apiRoutes.driver.profile, access.authenticate, async (_req, res) =>
    res.json(await deps.drivers.profile(getActor(res))),
  );
  app.put(apiRoutes.driver.profile, access.authenticate, async (req, res) =>
    res.json(await deps.drivers.updateProfile(getActor(res), driverProfileSchema.parse(req.body))),
  );
  app.put(apiRoutes.driver.availability, access.authenticate, async (req, res) =>
    res.json(
      await deps.drivers.updateAvailability(
        getActor(res),
        driverAvailabilitySchema.parse(req.body),
      ),
    ),
  );
  app.get(apiRoutes.driver.bookings, access.authenticate, async (_req, res) =>
    res.json(await deps.drivers.bookings(getActor(res))),
  );
}
