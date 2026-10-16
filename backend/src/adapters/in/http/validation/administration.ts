import { z } from 'zod';
export const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().min(9).max(25),
  role: z.enum(['client', 'admin']),
  active: z.boolean(),
});
export const createAccountSchema = accountSchema.extend({ password: z.string().min(10).max(128) });
export const userIdSchema = z.uuid();
