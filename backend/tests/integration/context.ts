import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPrisma } from '../../src/adapters/out/prisma/client.js';
import { compose } from '../../src/composition.js';
import { createApp } from '../../src/adapters/in/http/app.js';
import type { RoutingProvider } from '../../src/application/ports/index.js';

export const integrationHeader = {
  'X-Requested-With': 'DemenagExpress',
  Origin: 'http://localhost:5173',
};
export const integrationPassword = 'Integration-test-2026!';

export function createIntegrationContext(url: string) {
  const db = createPrisma(url);
  const prefix = 'Test ' + randomUUID();
  const routing: RoutingProvider = {
    route: async (from, to) => ({
      from,
      to,
      distanceKm: 20,
      durationMinutes: 35,
      geometry: [from, to],
    }),
    search: async () => [],
    reverse: async () => 'Adresse de test',
  };
  const app = createApp({
    ...compose(db, routing),
    origin: 'http://localhost:5173',
    production: false,
  });
  const seed = Math.floor(Math.random() * 8_000_000) + 1_000_000;

  return {
    db,
    app,
    prefix,
    testUserIds: [] as string[],
    testPhones: [] as string[],
    phone: (n: number) => '77' + String(seed + n).padStart(7, '0'),
    clients: {
      first: request.agent(app),
      second: request.agent(app),
      admin: request.agent(app),
      driver: request.agent(app),
    },
    driverId: null as string | null,
  };
}

export type IntegrationContext = ReturnType<typeof createIntegrationContext>;

export interface OriginalConfiguration {
  settings: Awaited<ReturnType<PrismaClient['parametreApplication']['findUniqueOrThrow']>>;
  vehicle: Awaited<ReturnType<PrismaClient['vehicule']['findUniqueOrThrow']>>;
}

export async function captureOriginalConfiguration(
  db: PrismaClient,
): Promise<OriginalConfiguration> {
  const [settings, vehicle] = await Promise.all([
    db.parametreApplication.findUniqueOrThrow({ where: { id: 'main' } }),
    db.vehicule.findUniqueOrThrow({ where: { id: 'sprinter' } }),
  ]);
  return { settings, vehicle };
}
