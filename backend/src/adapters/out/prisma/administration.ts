import type {
  AdministrationRepository,
  AdministrationTransaction,
} from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Booking } from '../../../domain/model.js';
import { conflict, json, safeUser } from './helpers.js';
import { fromUser } from './mapping.js';
function phoneKey(phone: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('221')) digits = digits.slice(3);
  return digits;
}
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
  async listHiddenClients() {
    const rows = await this.db.clientMasque.findMany();
    return rows.map((row) => ({
      phone: row.telephoneNormalise,
      hiddenAt: row.masqueLe.toISOString(),
    }));
  }
  async hideClient(phone: string) {
    const bookings = await this.db.reservation.findMany({ select: { donnees: true } });
    if (!bookings.some((row) => phoneKey((row.donnees as Booking).phone) === phone))
      throw new AppError(404, 'Client introuvable.');
    const row = await this.db.clientMasque.upsert({
      where: { telephoneNormalise: phone },
      create: { telephoneNormalise: phone },
      update: { masqueLe: new Date() },
    });
    return { phone: row.telephoneNormalise, hiddenAt: row.masqueLe.toISOString() };
  }
  async updateClient(phone: string, name: string, nextPhone: string) {
    const nextKey = phoneKey(nextPhone);
    try {
      await this.db.$transaction(
        async (tx) => {
          const rows = await tx.reservation.findMany({
            select: { id: true, version: true, donnees: true },
          });
          const matches = rows.filter((row) => phoneKey((row.donnees as Booking).phone) === phone);
          if (!matches.length) throw new AppError(404, 'Client introuvable.');
          if (
            nextKey !== phone &&
            rows.some((row) => phoneKey((row.donnees as Booking).phone) === nextKey)
          )
            throw new AppError(409, 'Ce numéro appartient déjà à un autre client.');
          const account = await tx.utilisateur.findFirst({
            where: { role: 'client', telephone: { in: [`+221${phone}`, phone] } },
          });
          if (account) {
            await tx.utilisateur.update({
              where: { id: account.id },
              data: { nom: name, telephone: nextPhone },
            });
          }
          for (const row of matches) {
            const booking = row.donnees as Booking;
            const result = await tx.reservation.updateMany({
              where: { id: row.id, version: row.version },
              data: {
                donnees: json({
                  ...booking,
                  customerName: name,
                  phone: nextPhone,
                  version: row.version + 1,
                }),
                version: { increment: 1 },
              },
            });
            if (result.count !== 1)
              throw new AppError(409, 'La réservation a été modifiée. Actualisez la page.');
          }
          await tx.clientMasque.deleteMany({ where: { telephoneNormalise: nextKey } });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new AppError(409, 'Une modification concurrente a eu lieu. Actualisez la page.');
      conflict(error);
    }
  }
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
