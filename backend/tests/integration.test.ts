import test from 'node:test';
import { runIntegrationScenario } from './integration/scenario.js';

test(
  'Parcours API → Prisma → PostgreSQL : comptes, droits, réservation, devis et sessions',
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120_000 },
  runIntegrationScenario,
);
