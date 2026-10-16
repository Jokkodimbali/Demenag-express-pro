import type { PrismaClient } from '../../../generated/prisma/client.js';
export class PrismaReadiness {
  constructor(private db: PrismaClient) {}
  async check(): Promise<void> {
    await this.db.parametreApplication.findUniqueOrThrow({
      where: { id: 'main' },
      select: { id: true },
    });
  }
}
