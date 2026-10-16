import '../src/config/env.js';
import { spawnSync } from 'node:child_process';
// Les tests modifient les tarifs temporairement : utilisation explicite d’une branche dédiée.
if (process.env.ALLOW_INTEGRATION_TESTS !== 'true')
  throw new Error(
    'Utilisez une branche de test, puis ALLOW_INTEGRATION_TESTS=true npm run test:integration.',
  );
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-isolation=none', 'tests/integration.test.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
);
process.exitCode = result.status ?? 1;
