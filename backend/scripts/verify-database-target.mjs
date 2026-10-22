import 'dotenv/config';

const pooled = process.env.DATABASE_URL;
const direct = process.env.DATABASE_URL_UNPOOLED;
if (!pooled || !direct) {
  console.error('DATABASE_URL et DATABASE_URL_UNPOOLED sont requises avant une migration.');
  process.exit(1);
}

try {
  const application = new URL(pooled);
  const migration = new URL(direct);
  const applicationHost = application.hostname.replace(/-pooler(?=\.)/, '');
  const sameDatabase = application.pathname === migration.pathname;
  if (
    !['postgres:', 'postgresql:'].includes(application.protocol) ||
    !['postgres:', 'postgresql:'].includes(migration.protocol) ||
    applicationHost !== migration.hostname ||
    migration.hostname.includes('-pooler.') ||
    !sameDatabase
  ) {
    console.error(
      'Migration refusée : la connexion directe ne pointe pas vers la même base que l’application.',
    );
    process.exit(1);
  }
} catch {
  console.error('Migration refusée : URL PostgreSQL invalide.');
  process.exit(1);
}
