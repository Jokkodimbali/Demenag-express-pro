import { z } from 'zod';
import { phoneNumberSchema } from './phone.js';
export const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneNumberSchema,
  role: z.enum(['client', 'admin']),
  active: z.boolean(),
});
export const createAccountSchema = accountSchema.extend({ password: z.string().min(10).max(128) });
export const userIdSchema = z.uuid();
export const vehicleIdSchema = z.string().regex(/^[a-z0-9-]{1,30}$/);
