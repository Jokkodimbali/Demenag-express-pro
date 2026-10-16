import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import { catalogueSchema } from './schemas.js';
import { apiRoutes } from './routes.js';
import { accountSchema, createAccountSchema, userIdSchema } from './validation/administration.js';
export function registerAdminRoutes(
  app: Express,
  deps: Pick<Dependencies, 'administration' | 'catalogue'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  app.get(apiRoutes.administration.users, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listUsers(getActor(res))),
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
  app.put(apiRoutes.catalogue, authenticate, admin, async (req, res) => {
    const p = catalogueSchema.parse(req.body);
    await deps.catalogue.update(getActor(res), p.vehicles, p.settings);
    res.json(await deps.catalogue.get());
  });
}
