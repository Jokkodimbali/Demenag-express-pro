import type { BookingRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Booking } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, json } from './helpers.js';
import { toStatus } from './mapping.js';
export class PrismaBookings implements BookingRepository {
  constructor(private db: PrismaClient) {}
  private withTrips(row: {
    donnees: unknown;
    courses: {
      id: string;
      sequence: number;
      loadingPhotos: unknown;
      unloadingPhotos: unknown;
      startedAt: Date;
      finishedAt: Date | null;
    }[];
  }): Booking {
    return {
      ...(row.donnees as Booking),
      trips: row.courses.map((trip) => ({
        id: trip.id,
        sequence: trip.sequence,
        loadingPhotos: trip.loadingPhotos as string[],
        unloadingPhotos: trip.unloadingPhotos as string[] | null,
        startedAt: trip.startedAt.toISOString(),
        finishedAt: trip.finishedAt?.toISOString() ?? null,
      })),
    };
  }
  async list(userId?: string, vehicleId?: string) {
    const rows = await this.db.reservation.findMany({
      where: {
        ...(userId ? { utilisateurId: userId } : {}),
        ...(vehicleId ? { vehiculeId: vehicleId } : {}),
      },
      orderBy: { creeLe: 'desc' },
      take: userId ? 200 : undefined,
      include: { courses: { orderBy: { sequence: 'asc' } } },
    });
    return rows.map((r) => this.withTrips(r));
  }
  async find(id: string) {
    const row = await this.db.reservation.findUnique({
      where: { id },
      include: { courses: { orderBy: { sequence: 'asc' } } },
    });
    return row ? this.withTrips(row) : null;
  }
  async startTrip(bookingId: string, photos: string[]) {
    try {
      await this.db.$transaction(async (tx) => {
        const open = await tx.course.findFirst({
          where: { reservationId: bookingId, finishedAt: null },
        });
        if (open)
          throw new AppError(409, 'Terminez la course en cours avant d’en démarrer une autre.');
        const sequence = (await tx.course.count({ where: { reservationId: bookingId } })) + 1;
        await tx.course.create({
          data: { reservationId: bookingId, sequence, loadingPhotos: photos },
        });
      });
    } catch (error) {
      conflict(error);
    }
  }
  async finishTrip(bookingId: string, photos: string[]) {
    const trip = await this.db.course.findFirst({
      where: { reservationId: bookingId, finishedAt: null },
      orderBy: { sequence: 'desc' },
    });
    if (!trip) throw new AppError(409, 'Aucune course en cours à terminer.');
    const result = await this.db.course.updateMany({
      where: { id: trip.id, finishedAt: null },
      data: { unloadingPhotos: photos, finishedAt: new Date() },
    });
    if (!result.count)
      throw new AppError(409, 'Cette course a déjà été terminée. Actualisez la page.');
  }
  async delete(id: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "demenag"."bookings" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const finalQuotes = await tx.devis.count({
        where: { reservationId: id, nature: 'definitif' },
      });
      if (finalQuotes)
        throw new AppError(
          409,
          'Cette réservation possède un devis final et une écriture comptable : suppression impossible.',
        );
      await tx.notification.deleteMany({ where: { reservationId: id } });
      await tx.reservation.delete({ where: { id } });
    });
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
          date: booking.date ? new Date(booking.date + 'T00:00:00Z') : null,
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
