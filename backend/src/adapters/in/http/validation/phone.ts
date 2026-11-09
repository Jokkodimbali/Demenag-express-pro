import { z } from 'zod';
import { messages } from '../../../../domain/messages/fr.js';
import { normalizePhoneNumber } from '../../../../domain/phone-number.js';

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(8)
  .max(30)
  .refine((phone) => normalizePhoneNumber(phone) !== null, {
    message: messages.saisissezUnNumeroInternationalValide,
  });
