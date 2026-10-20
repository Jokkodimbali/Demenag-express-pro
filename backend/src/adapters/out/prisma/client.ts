import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
export function createPrisma(connectionString: string, poolMax = 5) {
  const adapter = new PrismaPg({
    connectionString,
    max: poolMax,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  });
  return new PrismaClient({ adapter });
}
