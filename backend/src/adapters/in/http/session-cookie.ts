import type { Request } from 'express';
import { security } from '../../../config/security.js';
export function readSessionCookie(request: Request): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null || !(security.session.cookieName in cookies))
    return undefined;
  const value: unknown = Reflect.get(cookies, security.session.cookieName);
  return typeof value === 'string' ? value : undefined;
}
