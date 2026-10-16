import type { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { User } from '../../../domain/model.js';
const actorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  role: z.enum(['client', 'admin']),
  active: z.boolean().optional(),
});
export function getActor(response: Response): User {
  const value: unknown = response.locals.user;
  const result = actorSchema.safeParse(value);
  if (!result.success) throw new AppError(401, messages.connectezVousPourContinuer);
  return result.data;
}
