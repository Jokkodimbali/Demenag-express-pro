import type { AdministrationRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import type { User } from '../../../domain/model.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, safeUser } from './helpers.js';
import { fromUser } from './mapping.js';
export class PrismaAdministration implements AdministrationRepository {
  constructor(private db: PrismaClient) {}
  async listUsers() {
    const rows = await this.db.utilisateur.findMany({ orderBy: { creeLe: 'desc' }, take: 500 });
    return rows.map((row) => safeUser(fromUser(row)));
  }
  async updateUser(actorId: string, user: User) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const actor = await tx.utilisateur.findUnique({ where: { id: actorId } });
          if (!actor?.actif || actor.role !== 'administrateur')
            throw new AppError(403, 'Accès administrateur requis.');
          const target = await tx.utilisateur.findUnique({ where: { id: user.id } });
          if (!target) throw new AppError(404, 'Compte introuvable.');
          if (
            target.role === 'administrateur' &&
            (user.role !== 'admin' || user.active === false) &&
            (await tx.utilisateur.count({ where: { role: 'administrateur', actif: true } })) <= 1
          )
            throw new AppError(400, 'Conservez au moins un administrateur actif.');
          const updated = await tx.utilisateur.update({
            where: { id: user.id },
            data: {
              nom: user.name,
              telephone: user.phone,
              role: user.role === 'admin' ? 'administrateur' : 'client',
              actif: user.active,
            },
          });
          if (!updated.actif || target.role !== updated.role)
            await tx.sessionConnexion.deleteMany({ where: { utilisateurId: user.id } });
          return safeUser(fromUser(updated));
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new AppError(409, 'Un autre administrateur a modifié ces comptes. Actualisez.');
      conflict(error);
    }
  }
}
