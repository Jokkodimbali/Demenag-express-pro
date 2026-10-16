import { createApp } from './adapters/in/http/app.js';
import { OpenStreetMaps } from './adapters/out/maps/osrm.js';
import { createPrisma } from './adapters/out/prisma/client.js';
import { compose } from './composition.js';
import { readEnv } from './config/env.js';
async function main() {
  const env = readEnv();
  const db = createPrisma(env.DATABASE_URL);
  try {
    await db.parametreApplication.findUniqueOrThrow({ where: { id: 'main' } });
  } catch {
    await db.$disconnect();
    throw new Error(
      'Connexion ou schéma PostgreSQL indisponible. Vérifiez backend/.env puis exécutez npm run db:migrate et npm run db:seed.',
    );
  }
  const services = compose(
    db,
    new OpenStreetMaps(env.OSRM_URL, env.NOMINATIM_URL, env.MAPS_USER_AGENT),
  );
  const server = createApp({
    ...services,
    origin: env.FRONTEND_ORIGIN,
    production: env.NODE_ENV === 'production',
  }).listen(env.PORT, () => console.log(`API Demenag Express : http://localhost:${env.PORT}`));
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
