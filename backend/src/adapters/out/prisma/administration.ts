import type {
  AdministrationRepository,
  AdministrationTransaction,
} from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, safeUser } from './helpers.js';
import { fromUser } from './mapping.js';
function transactionRepository(tx: Prisma.TransactionClient): AdministrationTransaction {
  return {
    async findUser(id) {
      const row = await tx.utilisateur.findUnique({ where: { id } });
      return row ? safeUser(fromUser(row)) : null;
    },
    countActiveAdministrators: () =>
      tx.utilisateur.count({ where: { role: 'administrateur', actif: true } }),
    async saveUser(user) {
      const row = await tx.utilisateur.update({
        where: { id: user.id },
        data: {
          nom: user.name,
          telephone: user.phone,
          role: user.role === 'admin' ? 'administrateur' : 'client',
          actif: user.active,
        },
      });
      return safeUser(fromUser(row));
    },
    async revokeSessions(userId) {
      await tx.sessionConnexion.deleteMany({ where: { utilisateurId: userId } });
    },
  };
}
export class PrismaAdministration implements AdministrationRepository {
  constructor(private db: PrismaClient) {}
  async listUsers() {
    const rows = await this.db.utilisateur.findMany({ orderBy: { creeLe: 'desc' } });
    return rows.map((row) => safeUser(fromUser(row)));
  }
  async transaction<T>(work: (repository: AdministrationTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.db.$transaction((tx) => work(transactionRepository(tx)), {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new AppError(409, messages.unAutreAdministrateurAModifieCesComptesActualisez);
      conflict(error);
    }
  }
}
