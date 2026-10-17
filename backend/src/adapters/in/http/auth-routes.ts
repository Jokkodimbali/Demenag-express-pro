import type { Express, Response } from 'express';
import { security } from '../../../config/security.js';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import { loginSchema, passwordSchema, registerSchema } from './validation/auth.js';
import { apiRoutes } from './routes.js';
import { readSessionCookie } from './session-cookie.js';
export function registerAuthRoutes(
  app: Express,
  deps: Pick<Dependencies, 'auth'>,
  access: Pick<Access, 'authenticate' | 'authLimiter' | 'cookieOptions'>,
) {
  const { authenticate, authLimiter, cookieOptions } = access;
  const clearLegacySessionCookie = (res: Response) =>
    res.clearCookie(security.session.cookieName, {
      ...cookieOptions,
      path: '/',
      maxAge: undefined,
    });
  app.post(apiRoutes.auth.register, authLimiter, async (req, res) => {
    const p = registerSchema.parse(req.body);
    const session = await deps.auth.register(p.name, p.phone, p.password);
    clearLegacySessionCookie(res)
      .cookie(security.session.cookieName, session.token, cookieOptions)
      .status(201)
      .json(session.user);
  });
  app.post(apiRoutes.auth.login, authLimiter, async (req, res) => {
    const p = loginSchema.parse(req.body);
    const session = await deps.auth.login(p.phone, p.password);
    clearLegacySessionCookie(res)
      .cookie(security.session.cookieName, session.token, cookieOptions)
      .json(session.user);
  });
  app.post(apiRoutes.auth.password, authLimiter, authenticate, async (req, res) => {
    const p = passwordSchema.parse(req.body);
    const session = await deps.auth.changePassword(getActor(res), p.oldPassword, p.newPassword);
    clearLegacySessionCookie(res)
      .cookie(security.session.cookieName, session.token, cookieOptions)
      .json(session.user);
  });
  app.get(apiRoutes.auth.current, async (req, res) =>
    res.json(await deps.auth.current(readSessionCookie(req))),
  );
  app.post(apiRoutes.auth.logout, async (req, res) => {
    await deps.auth.logout(readSessionCookie(req));
    clearLegacySessionCookie(res)
      .clearCookie(security.session.cookieName, { ...cookieOptions, maxAge: undefined })
      .status(204)
      .end();
  });
}
