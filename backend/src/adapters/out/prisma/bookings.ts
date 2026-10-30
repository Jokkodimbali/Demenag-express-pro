import type { BookingRepository } from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Booking, Quote, WorkPlanReview } from '../../../domain/model.js';
import { type PrismaClient } from '../../../generated/prisma/client.js';
import { conflict, json } from './helpers.js';
import { toStatus } from './mapping.js';
const quoteData = (quote: Quote) => ({
  id: quote.id,
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
});
export class PrismaBookings implements BookingRepository {
  constructor(private db: PrismaClient) {}
  private withTrips(row: {
    donnees: unknown;
    courses: {
      id: string;
      sequence: number;
      loadingPhotos?: unknown;
      unloadingPhotos?: unknown;
      startedAt: Date;
      finishedAt: Date | null;
    }[];
  }): Booking {
    const booking = row.donnees as Booking;
    const workPlan =
      booking.workPlan !== undefined
        ? booking.workPlan.map((step) => {
            const legacyStep = step as typeof step & {
              review?: WorkPlanReview;
              driverReview?: WorkPlanReview;
              adminReview?: WorkPlanReview;
            };
            if (legacyStep.review) return step;
            const reviews = [legacyStep.driverReview, legacyStep.adminReview].filter(
              (review): review is NonNullable<typeof review> => Boolean(review),
            );
            const review = reviews.sort(
              (left, right) =>
                new Date(right.checkedAt ?? 0).getTime() - new Date(left.checkedAt ?? 0).getTime(),
            )[0] ?? {
              status: 'pending' as const,
              reason: '',
              checkedAt: null,
              checkedBy: null,
            };
            return { ...step, review };
          })
        : this.workPlanFromLegacyNotes(booking.notes);
    return {
      ...booking,
      workPlan,
      trips: row.courses.map((trip) => ({
        id: trip.id,
        sequence: trip.sequence,
        loadingPhotos: (trip.loadingPhotos as string[] | undefined) ?? [],
        unloadingPhotos: (trip.unloadingPhotos as string[] | null | undefined) ?? null,
        startedAt: trip.startedAt.toISOString(),
        finishedAt: trip.finishedAt?.toISOString() ?? null,
      })),
    };
  }
  private workPlanFromLegacyNotes(notes: string) {
    const items: NonNullable<Booking['workPlan']> = [];
    for (const line of notes.split('\n')) {
      const match =
        /^(\d{2}:\d{2}) · (.{1,120}?) · (\d+ min|\d+ h(?: \d+)?)\s*(?:\((.*)\))?$/u.exec(
          line.trim(),
        );
      if (!match) continue;
      const duration = match[3] ?? '';
      const hours = /^(\d+) h(?: (\d+))?$/u.exec(duration);
      const minutes = hours
        ? Number(hours[1]) * 60 + Number(hours[2] ?? 0)
        : Number(/^\d+/u.exec(duration)?.[0] ?? 0);
      const pending = { status: 'pending' as const, reason: '', checkedAt: null, checkedBy: null };
      items.push({
        id: `legacy-plan-${items.length + 1}`,
        time: match[1] ?? '08:00',
        title: match[2] ?? 'Étape de mission',
        detail: match[4] ?? '',
        minutes,
        review: pending,
      });
    }
    return items;
  }
  async list(userId?: string, vehicleId?: string, includeTripPhotos = true) {
    const courses = includeTripPhotos
      ? { orderBy: { sequence: 'asc' as const } }
      : {
          orderBy: { sequence: 'asc' as const },
          select: { id: true, sequence: true, startedAt: true, finishedAt: true },
        };
    const rows = await this.db.reservation.findMany({
      where: {
        ...(userId ? { utilisateurId: userId } : {}),
        ...(vehicleId ? { vehiculeId: vehicleId } : {}),
      },
      orderBy: { creeLe: 'desc' },
      take: userId ? 200 : undefined,
      include: { courses },
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
        await tx.$queryRaw`SELECT "id" FROM "demenag"."bookings" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
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
  async addTripLoadingPhotos(bookingId: string, photos: string[]) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "demenag"."bookings" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
      const open = await tx.course.findFirst({
        where: { reservationId: bookingId, finishedAt: null },
        orderBy: { sequence: 'desc' },
      });
      if (!open) throw new AppError(409, 'Aucune course en cours à compléter.');
      if ((open.loadingPhotos as string[]).length)
        throw new AppError(
          409,
          'Les preuves de chargement de cette course sont déjà enregistrées.',
        );
      await tx.course.update({ where: { id: open.id }, data: { loadingPhotos: photos } });
    });
  }
  async finishTrip(bookingId: string, photos: string[]) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "demenag"."bookings" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
      const trip = await tx.course.findFirst({
        where: { reservationId: bookingId, finishedAt: null },
        orderBy: { sequence: 'desc' },
      });
      if (!trip) throw new AppError(409, 'Aucune course en cours à terminer.');
      const result = await tx.course.updateMany({
        where: { id: trip.id, finishedAt: null },
        data: { unloadingPhotos: photos, finishedAt: new Date() },
      });
      if (!result.count)
        throw new AppError(409, 'Cette course a déjà été terminée. Actualisez la page.');
    });
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
          devis: { create: booking.quotes.map(quoteData) },
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
        for (const quote of next.quotes) {
          const previous = booking.quotes.find((item) => item.id === quote.id);
          if (previous && JSON.stringify(previous) === JSON.stringify(quote)) continue;
          const data = quoteData(quote);
          await tx.devis.upsert({
            where: { id: quote.id },
            update: {
              reference: data.reference,
              nature: data.nature,
              montantTotal: data.montantTotal,
              remise: data.remise,
              nombreTrajets: data.nombreTrajets,
              tranche: data.tranche,
              notes: data.notes,
              creeLe: data.creeLe,
              lignes: { deleteMany: {}, create: data.lignes.create },
            },
            create: { ...data, reservationId: next.id },
          });
        }
        return next;
      });
    } catch (error) {
      conflict(error);
    }
  }
}
