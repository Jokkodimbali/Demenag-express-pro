import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { messages } from '../domain/messages/fr.js';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export function readEnv() {
  const result = z
    .object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      DATABASE_URL: z.string().min(1),
      FRONTEND_ORIGIN: z
        .string()
        .default(
          process.env.NODE_ENV === 'production'
            ? 'https://demenag-express-pro.vercel.app,https://www.demenagexpresspro.com'
            : 'http://localhost:5173',
        )
        .transform((value) => value.split(',').map((origin) => origin.trim()))
        .pipe(
          z.array(
            z.url().refine((value) => {
              const url = new URL(value);
              return (
                ['http:', 'https:'].includes(url.protocol) &&
                !url.username &&
                !url.password &&
                url.pathname === '/' &&
                !url.search &&
                !url.hash
              );
            }),
          ).min(1),
        ),
      OSRM_URL: z.url().default('https://router.project-osrm.org'),
      NOMINATIM_URL: z.url().default('https://nominatim.openstreetmap.org'),
      MAPS_USER_AGENT: z.string().default('DemenagExpress/1.0'),
    })
    .refine(
      (value) =>
        value.NODE_ENV !== 'production' ||
        value.FRONTEND_ORIGIN.every((origin) => new URL(origin).protocol === 'https:'),
      { path: ['FRONTEND_ORIGIN'] },
    )
    .safeParse(process.env);
  if (!result.success)
    throw new Error(
      messages.configurationManquanteOuInvalide +
        result.error.issues.map((i) => i.path.join('.')).join(', ') +
        messages.labelConsultezbackendenvexample,
    );
  return result.data;
}
