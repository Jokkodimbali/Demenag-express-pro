import { z } from 'zod';
import { messages } from '../../../../domain/messages/fr.js';
export const loginSchema = z.object({
  phone: z.string().min(9).max(25),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(10, messages.utilisezAuMoins10Caracteres).max(128),
});
export const passwordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});
