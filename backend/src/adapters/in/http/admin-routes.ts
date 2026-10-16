import type { Express } from 'express';
import { z } from 'zod';
import type { Access } from './access.js';
import type { Dependencies } from './dependencies.js';
import { catalogueSchema } from './schemas.js';
export function registerAdminRoutes(
  app: Express,
  deps: Pick<Dependencies, 'administration' | 'catalogue'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  const accountSchema = z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().min(9).max(25),
    role: z.enum(['client', 'admin']),
    active: z.boolean(),
  });
  app.get('/api/admin/users', authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listUsers(res.locals.user)),
  );
  app.post('/api/admin/users', authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.administration.createUser(
          res.locals.user,
          accountSchema.extend({ password: z.string().min(10).max(128) }).parse(req.body),
        ),
      ),
  );
  app.put('/api/admin/users/:id', authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.updateUser(res.locals.user, {
        ...accountSchema.parse(req.body),
        id: z.uuid().parse(req.params.id),
      }),
    ),
  );
  app.put('/api/catalogue', authenticate, admin, async (req, res) => {
    const p = catalogueSchema.parse(req.body);
    await deps.catalogue.update(p.vehicles, p.settings);
    res.json(await deps.catalogue.get());
  });
}
