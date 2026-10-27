import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import {
  adminProfileSchema,
  catalogueSchema,
  createDriverSchema,
  driverSchema,
  tollPointCreateSchema,
  tollPointSchema,
} from './schemas.js';
import { apiRoutes } from './routes.js';
import { adminPasswordResetSchema } from './validation/auth.js';
import { accountSchema, createAccountSchema, userIdSchema } from './validation/administration.js';
import { z } from 'zod';
const clientPhoneSchema = z.string().regex(/^\d{9}$/);
const clientUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().min(9).max(25),
});
const accountingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const accountingEntrySchema = z.object({
  type: z.enum(['charge', 'revenu']),
  category: z.string().trim().min(2).max(100),
  label: z.string().trim().min(2).max(200),
  amount: z.number().int().positive().max(1_000_000_000),
  date: z.iso.date(),
});
export function registerAdminRoutes(
  app: Express,
  deps: Pick<Dependencies, 'administration' | 'catalogue' | 'drivers' | 'accounting'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  app.get(apiRoutes.administration.accounting, authenticate, admin, async (req, res) => {
    const month =
      req.query.month === undefined ? undefined : accountingMonthSchema.parse(req.query.month);
    res.json(await deps.accounting.list(getActor(res), month));
  });
  app.post(apiRoutes.administration.accounting, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(await deps.accounting.create(getActor(res), accountingEntrySchema.parse(req.body))),
  );
  app.delete(
    `${apiRoutes.administration.accounting}/:id`,
    authenticate,
    admin,
    async (req, res) => {
      await deps.accounting.void(getActor(res), userIdSchema.parse(req.params.id));
      res.status(204).end();
    },
  );
  app.get(apiRoutes.administration.profile, authenticate, admin, async (_req, res) =>
    res.json(getActor(res)),
  );
  app.put(apiRoutes.administration.profile, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.updateProfile(getActor(res), adminProfileSchema.parse(req.body)),
    ),
  );
  app.get(apiRoutes.administration.users, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listUsers(getActor(res))),
  );
  app.get(`${apiRoutes.administration.clients}/hidden`, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listHiddenClients(getActor(res))),
  );
  app.patch(`${apiRoutes.administration.clients}/:phone`, authenticate, admin, async (req, res) => {
    const input = clientUpdateSchema.parse(req.body);
    await deps.administration.updateClient(
      getActor(res),
      clientPhoneSchema.parse(req.params.phone),
      input.name,
      input.phone,
    );
    res.status(204).end();
  });
  app.delete(`${apiRoutes.administration.clients}/:phone`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.hideClient(
        getActor(res),
        clientPhoneSchema.parse(req.params.phone),
      ),
    ),
  );
  app.post(apiRoutes.administration.users, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.administration.createUser(getActor(res), createAccountSchema.parse(req.body)),
      ),
  );
  app.put(`${apiRoutes.administration.users}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.updateUser(getActor(res), {
        ...accountSchema.parse(req.body),
        id: userIdSchema.parse(req.params.id),
      }),
    ),
  );
  app.post(apiRoutes.administration.userPasswordReset, authenticate, admin, async (req, res) => {
    const { password } = adminPasswordResetSchema.parse(req.body);
    await deps.administration.resetClientPassword(
      getActor(res),
      userIdSchema.parse(req.params.id),
      password,
    );
    res.status(204).end();
  });
  app.put(apiRoutes.catalogue, authenticate, admin, async (req, res) => {
    const p = catalogueSchema.parse(req.body);
    await deps.catalogue.update(getActor(res), p.vehicles, p.settings);
    res.json(await deps.catalogue.get());
  });
  app.post(apiRoutes.tollPoints, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.catalogue.createTollPoint(getActor(res), tollPointCreateSchema.parse(req.body)),
      ),
  );
  app.put(`${apiRoutes.tollPoints}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.catalogue.updateTollPoint(
        getActor(res),
        userIdSchema.parse(req.params.id),
        tollPointSchema.parse(req.body),
      ),
    ),
  );
  app.delete(`${apiRoutes.tollPoints}/:id`, authenticate, admin, async (req, res) => {
    await deps.catalogue.deleteTollPoint(getActor(res), userIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  app.get(apiRoutes.administration.drivers, authenticate, admin, async (_req, res) =>
    res.json(await deps.drivers.list(getActor(res))),
  );
  app.post(apiRoutes.administration.drivers, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(await deps.drivers.create(getActor(res), createDriverSchema.parse(req.body))),
  );
  app.put(`${apiRoutes.administration.drivers}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.drivers.update(getActor(res), {
        ...driverSchema.parse(req.body),
        id: userIdSchema.parse(req.params.id),
      }),
    ),
  );
  app.delete(`${apiRoutes.administration.drivers}/:id`, authenticate, admin, async (req, res) =>
    res.json(await deps.drivers.remove(getActor(res), userIdSchema.parse(req.params.id))),
  );
}
