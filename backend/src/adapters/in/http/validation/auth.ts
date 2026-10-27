import { z } from 'zod';
const passwordStrengthMessage =
  'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.';
export const loginSchema = z.object({
  phone: z.string().min(9).max(25),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema
  .extend({
    name: z.string().trim().min(2).max(100),
    password: z.string().min(8, passwordStrengthMessage).max(128),
  })
  .refine((input) => /[a-zA-Z]/.test(input.password) && /\d/.test(input.password), {
    path: ['password'],
    message: passwordStrengthMessage,
  });
export const passwordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});
export const passwordResetRequestSchema = z.object({ phone: z.string().min(1).max(25) });
export const adminPasswordResetSchema = z
  .object({
    password: z.string().min(10).max(128),
  })
  .refine((input) => /[a-zA-Z]/.test(input.password) && /\d/.test(input.password), {
    path: ['password'],
    message: 'Mot de passe trop faible : 10 caractères minimum, avec une lettre et un chiffre.',
  });
