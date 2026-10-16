import type { BookingRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Booking } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, json } from './helpers.js';
import { toStatus } from './mapping.js';
export class PrismaBookings implements BookingRepository {
  constructor(private db: PrismaClient) {}
  async list(userId?: string) {
    const rows = await this.db.reservation.findMany({
      where: userId ? { utilisateurId: userId } : undefined,
      orderBy: { creeLe: 'desc' },
      take: userId ? 200 : undefined,
      select: { donnees: true },
    });
    return rows.map((r) => r.donnees as unknown as Booking);
  }
  async listForDriver(driverId: string) {
    const rows = await this.db.reservation.findMany({
      where: { chauffeurId: driverId },
      orderBy: { creeLe: 'desc' },
      take: 200,
      select: { donnees: true },
    });
    return rows.map((row) => row.donnees as unknown as Booking);
  }
  async find(id: string) {
    const row = await this.db.reservation.findUnique({ where: { id }, select: { donnees: true } });
    return row ? (row.donnees as unknown as Booking) : null;
  }
  async create(booking: Booking, requestId: string) {
    try {
      const row = await this.db.reservation.upsert({
        where: {
          utilisateurId_identifiantDemande: {
            utilisateurId: booking.userId,
            identifiantDemande: requestId,
          },
        },
        update: { identifiantDemande: requestId },
        create: {
          id: booking.id,
          utilisateurId: booking.userId,
          identifiantDemande: requestId,
          reference: booking.reference,
          vehiculeId: booking.vehicle.id,
          date: new Date(booking.date + 'T00:00:00Z'),
          creneau: booking.timeSlot,
          statut: toStatus[booking.status],
          donnees: json(booking),
        },
      });
      return row.donnees as unknown as Booking;
    } catch (error) {
      conflict(error);
    }
  }
  async update(booking: Booking, expectedVersion: number) {
    const next = { ...booking, version: expectedVersion + 1 };
    try {
      return await this.db.$transaction(async (tx) => {
        const result = await tx.reservation.updateMany({
          where: { id: booking.id, version: expectedVersion },
          data: {
            donnees: json(next),
            statut: toStatus[next.status],
            chauffeurId: next.driverId ?? null,
            version: { increment: 1 },
          },
        });
        if (!result.count)
          throw new AppError(409, messages.cetteReservationAChangeActualisezLaPage);
        for (const quote of next.quotes)
          await tx.devis.upsert({
            where: { id: quote.id },
            update: {},
            create: {
              id: quote.id,
              reservationId: next.id,
              reference: quote.reference,
              nature: quote.kind === 'final' ? 'definitif' : 'provisoire',
              montantTotal: quote.price.total,
              remise: quote.price.discount,
              nombreTrajets: quote.price.trips,
              tranche: quote.price.tier,
              notes: quote.notes,
              creeLe: new Date(quote.createdAt),
              lignes: {
                create: quote.price.lines.map((line, position) => ({
                  libelle: line.label,
                  quantite: line.quantity,
                  prixUnitaire: line.unitPrice,
                  montant: line.total,
                  position,
                })),
              },
            },
          });
        return next;
      });
    } catch (error) {
      conflict(error);
    }
  }
}
