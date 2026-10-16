import { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AuthUseCases } from '../../../application/ports/use-cases.js';
import { security } from '../../../config/security.js';
import { messages } from '../../../domain/messages/fr.js';
import { requireActiveUser, requireAdministrator } from '../../../domain/policies/access.js';
import { getActor } from './actor.js';
import { readSessionCookie } from './session-cookie.js';
export function createAccess(deps: { auth: Pick<AuthUseCases, 'current'>; production: boolean }) {
  const cookieOptions = {
    httpOnly: true,
    secure: deps.production,
    sameSite: 'lax' as const,
    path: security.session.path,
    maxAge: security.session.durationMs,
  };
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const user = await deps.auth.current(readSessionCookie(req));
    requireActiveUser(user);
    res.locals.user = user;
    next();
  };
  const admin = (_req: Request, res: Response, next: NextFunction) => {
    requireAdministrator(getActor(res));
    next();
  };
  const authLimiter = rateLimit({
    ...security.limits.authentication,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: messages.tropDeTentativesReessayezDans15Minutes },
  });
  return { authenticate, admin, authLimiter, cookieOptions };
}
export type Access = ReturnType<typeof createAccess>;
