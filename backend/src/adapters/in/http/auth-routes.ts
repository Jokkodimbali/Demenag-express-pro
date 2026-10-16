import type { Express } from 'express';
import { z } from 'zod';
import type { Access } from './access.js';
import type { Dependencies } from './dependencies.js';
import { loginSchema, registerSchema } from './schemas.js';
export function registerAuthRoutes(
  app: Express,
  deps: Pick<Dependencies, 'auth'>,
  access: Pick<Access, 'authenticate' | 'authLimiter' | 'cookieOptions'>,
) {
  const { authenticate, authLimiter, cookieOptions } = access;
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const p = registerSchema.parse(req.body);
    const session = await deps.auth.register(p.name, p.phone, p.password);
    res.cookie('dem_session', session.token, cookieOptions).status(201).json(session.user);
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const p = loginSchema.parse(req.body);
    const session = await deps.auth.login(p.phone, p.password);
    res.cookie('dem_session', session.token, cookieOptions).json(session.user);
  });
  app.post('/api/auth/password', authLimiter, authenticate, async (req, res) => {
    const p = z
      .object({ oldPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) })
      .parse(req.body);
    const session = await deps.auth.changePassword(res.locals.user, p.oldPassword, p.newPassword);
    res.cookie('dem_session', session.token, cookieOptions).json(session.user);
  });
  app.get('/api/auth/me', async (req, res) =>
    res.json(await deps.auth.current(req.cookies.dem_session)),
  );
  app.post('/api/auth/logout', async (req, res) => {
    await deps.auth.logout(req.cookies.dem_session);
    res
      .clearCookie('dem_session', { ...cookieOptions, maxAge: undefined })
      .status(204)
      .end();
  });
}
