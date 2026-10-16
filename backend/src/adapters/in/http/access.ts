import { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../../domain/errors.js';
import type { User } from '../../../domain/model.js';
import type { Dependencies } from './dependencies.js';
export function createAccess(deps: Pick<Dependencies, 'auth' | 'production'>) {
  const cookieOptions = {
    httpOnly: true,
    secure: deps.production,
    sameSite: 'lax' as const,
    path: '/api',
    maxAge: 7 * 86400000,
  };
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const user = await deps.auth.current(req.cookies.dem_session);
    if (!user) throw new AppError(401, 'Connectez-vous pour continuer.');
    res.locals.user = user;
    next();
  };
  const admin = (_req: Request, res: Response, next: NextFunction) => {
    if ((res.locals.user as User).role !== 'admin')
      throw new AppError(403, 'Action réservée à l’administration.');
    next();
  };
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  });
  return { authenticate, admin, authLimiter, cookieOptions };
}
export type Access = ReturnType<typeof createAccess>;
