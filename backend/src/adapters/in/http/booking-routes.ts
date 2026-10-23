import type { Express } from 'express';
import { z } from 'zod';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import type { NotificationPublisher } from '../../../application/ports/index.js';
import { messages } from '../../../domain/messages/fr.js';
import {
  bookingSchema,
  bookingRouteUpdateSchema,
  driverAssignmentSchema,
  estimateSchema,
  quoteSchema,
  statusSchema,
  tripPhotosSchema,
  workPlanReviewSchema,
} from './schemas.js';
import { apiRoutes } from './routes.js';
export function registerBookingRoutes(
  app: Express,
  deps: Pick<Dependencies, 'moving'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
  notifications?: NotificationPublisher,
) {
  const { authenticate, admin } = access;
  const notify = async (
    title: string,
    message: string,
    recipients: { userIds?: string[]; roles?: ('client' | 'admin' | 'driver')[] },
    bookingId?: string,
  ) => {
    try {
      await notifications?.publish(
        { id: crypto.randomUUID(), title, message, createdAt: new Date().toISOString(), bookingId },
        recipients,
      );
    } catch (error) {
      console.error('Notification non envoyée après une action de réservation :', error);
    }
  };
  app.post(apiRoutes.estimates, async (req, res) => {
    const p = estimateSchema.parse(req.body);
    res.json(await deps.moving.estimate(p.vehicleId, p.routeId, p.options));
  });
  app.get(apiRoutes.bookings, authenticate, async (_req, res) =>
    res.json(await deps.moving.list(getActor(res))),
  );
  app.post(apiRoutes.bookings, authenticate, async (req, res) => {
    const booking = await deps.moving.create(getActor(res), bookingSchema.parse(req.body));
    await notify(
      'Nouvelle réservation à confirmer',
      messages.notificationNouvelleReservation(
        booking.reference,
        booking.customerName,
        booking.date,
        booking.timeSlot,
      ),
      { roles: ['admin'] },
      booking.id,
    );
    res.status(201).json(booking);
  });
  app.get(`${apiRoutes.bookings}/:id`, authenticate, async (req, res) =>
    res.json(await deps.moving.get(getActor(res), z.uuid().parse(req.params.id))),
  );
  app.delete(`${apiRoutes.bookings}/:id`, authenticate, admin, async (req, res) => {
    await deps.moving.delete(getActor(res), z.uuid().parse(req.params.id));
    res.status(204).end();
  });
  app.patch(`${apiRoutes.bookings}/:id/status`, authenticate, async (req, res) => {
    const p = statusSchema.parse(req.body);
    const booking = await deps.moving.status(
      getActor(res),
      z.uuid().parse(req.params.id),
      p.status,
      p.version,
    );
    await notify(
      'Statut de réservation mis à jour',
      messages.notificationStatutReservation(booking.reference, booking.status),
      { userIds: [booking.userId], roles: ['admin'] },
      booking.id,
    );
    res.json(booking);
  });
  app.post(`${apiRoutes.bookings}/:id/trips/start`, authenticate, async (req, res) => {
    const p = tripPhotosSchema.parse(req.body);
    const actor = getActor(res);
    const booking = await deps.moving.startTrip(actor, z.uuid().parse(req.params.id), p.photos);
    await notify(
      'Course démarrée',
      `${booking.reference} : ${actor.role === 'admin' ? 'l’administration a démarré' : 'le chauffeur a envoyé les preuves et démarré'} la course ${booking.trips?.length ?? 1}.`,
      { roles: ['admin'] },
      booking.id,
    );
    res.status(201).json(booking);
  });
  app.post(`${apiRoutes.bookings}/:id/trips/finish`, authenticate, async (req, res) => {
    const p = tripPhotosSchema.parse(req.body);
    const actor = getActor(res);
    const booking = await deps.moving.finishTrip(actor, z.uuid().parse(req.params.id), p.photos);
    await notify(
      actor.role === 'admin'
        ? 'Course terminée par l’administration'
        : 'Course terminée · preuves reçues',
      `${booking.reference} : ${actor.role === 'admin' ? 'l’administration a terminé' : 'le chauffeur a terminé avec preuves'} la course ${booking.trips?.length ?? 1}.`,
      { roles: ['admin'] },
      booking.id,
    );
    res.json(booking);
  });
  app.post(`${apiRoutes.bookings}/:id/driver-finished`, authenticate, async (req, res) => {
    res.json(await deps.moving.finishDriverWork(getActor(res), z.uuid().parse(req.params.id)));
  });
  app.patch(`${apiRoutes.bookings}/:id/schedule`, authenticate, admin, async (req, res) => {
    const p = z
      .object({
        date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]),
        timeSlot: z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.literal('')]),
        version: z.number().int().positive(),
      })
      .refine((schedule) => !schedule.date || Boolean(schedule.timeSlot), {
        path: ['timeSlot'],
        message: messages.creneauInvalide,
      })
      .parse(req.body);
    res.json(
      await deps.moving.schedule(
        getActor(res),
        z.uuid().parse(req.params.id),
        p.date || null,
        p.timeSlot,
        p.version,
      ),
    );
  });
  app.patch(`${apiRoutes.bookings}/:id/notes`, authenticate, admin, async (req, res) => {
    const p = z
      .object({ notes: z.string().trim().max(2000), version: z.number().int().positive() })
      .parse(req.body);
    res.json(
      await deps.moving.updateNotes(
        getActor(res),
        z.uuid().parse(req.params.id),
        p.notes,
        p.version,
      ),
    );
  });
  app.patch(
    `${apiRoutes.bookings}/:id/work-plan/:stepId/review`,
    authenticate,
    async (req, res) => {
      const p = workPlanReviewSchema.parse(req.body);
      res.json(
        await deps.moving.reviewWorkPlan(
          getActor(res),
          z.uuid().parse(req.params.id),
          z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,80}$/)
            .parse(req.params.stepId),
          p.status,
          p.reason,
          p.version,
        ),
      );
    },
  );
  app.patch(`${apiRoutes.bookings}/:id/route`, authenticate, admin, async (req, res) => {
    const p = bookingRouteUpdateSchema.parse(req.body);
    res.json(
      await deps.moving.updateRoute(
        getActor(res),
        z.uuid().parse(req.params.id),
        p.from,
        p.to,
        p.version,
      ),
    );
  });
  app.patch(`${apiRoutes.bookings}/:id/driver`, authenticate, admin, async (req, res) => {
    const p = driverAssignmentSchema.parse(req.body);
    const booking = await deps.moving.assignDriver(
      getActor(res),
      z.uuid().parse(req.params.id),
      p.driverId,
      p.version,
    );
    res.json(booking);
  });
  app.post(`${apiRoutes.bookings}/:id/quotes`, authenticate, admin, async (req, res) => {
    const booking = await deps.moving.quote(
      getActor(res),
      z.uuid().parse(req.params.id),
      quoteSchema.parse(req.body),
    );
    await notify(
      'Nouveau devis disponible',
      messages.notificationDevisDisponible(booking.reference),
      { userIds: [booking.userId] },
      booking.id,
    );
    res.status(201).json(booking);
  });
}
