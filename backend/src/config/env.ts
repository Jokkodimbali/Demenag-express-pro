import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export function readEnv() {
  const result = z
    .object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      DATABASE_URL: z.string().min(1),
      FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
      OSRM_URL: z.url().default('https://router.project-osrm.org'),
      NOMINATIM_URL: z.url().default('https://nominatim.openstreetmap.org'),
      MAPS_USER_AGENT: z.string().default('DemenagExpress/1.0'),
    })
    .safeParse(process.env);
  if (!result.success)
    throw new Error(
      'Configuration manquante ou invalide : ' +
        result.error.issues.map((i) => i.path.join('.')).join(', ') +
        '. Consultez backend/.env.example.',
    );
  return result.data;
}
