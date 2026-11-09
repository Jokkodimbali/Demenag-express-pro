import { z } from 'zod';
import { phoneNumberSchema } from './phone.js';
const passwordStrengthMessage =
  'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.';
const loginFields = z.object({
  identifier: z.string().trim().min(3).max(254).optional(),
  phone: phoneNumberSchema.optional(),
  password: z.string().max(128).optional(),
});
export const loginSchema = loginFields.refine((input) => Boolean(input.identifier || input.phone), {
  path: ['identifier'],
  message: 'Saisissez votre numéro de téléphone ou votre email administrateur.',
});
export const registerSchema = z
  .object({
    role: z.literal('client').default('client'),
    phone: phoneNumberSchema,
    name: z.string().trim().min(2).max(100).optional(),
    password: z.string().max(128).optional(),
  })
  .superRefine((input, context) => {
    if (!input.name)
      context.addIssue({ code: 'custom', path: ['name'], message: 'Saisissez votre nom complet.' });
    if (
      !input.password ||
      input.password.length < 8 ||
      !/[a-zA-Z]/.test(input.password) ||
      !/\d/.test(input.password)
    )
      context.addIssue({ code: 'custom', path: ['password'], message: passwordStrengthMessage });
  });
export const passwordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});
export const passwordResetRequestSchema = z.object({ phone: phoneNumberSchema });
export const adminPasswordResetSchema = z
  .object({
    password: z.string().min(10).max(128),
  })
  .refine((input) => /[a-zA-Z]/.test(input.password) && /\d/.test(input.password), {
    path: ['password'],
    message: 'Mot de passe trop faible : 10 caractères minimum, avec une lettre et un chiffre.',
  });
