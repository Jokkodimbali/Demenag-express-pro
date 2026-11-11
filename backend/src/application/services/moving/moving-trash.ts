import { AppError } from '../../../domain/shared/errors.js';
import { messages } from '../../../domain/shared/messages/fr.js';
import { requireAdministrator } from '../../../domain/security/access-policy.js';
import type { User } from '../../../domain/shared/model.js';
import type { BookingRepository } from '../../ports/index.js';

export async function deleteBooking(bookings: BookingRepository, user: User, id: string) {
  requireAdministrator(user);
  const booking = await bookings.find(id);
  if (!booking) throw new AppError(404, messages.reservationIntrouvable);
  if (!bookings.delete)
    throw new AppError(501, 'La suppression des réservations est indisponible.');
  await bookings.delete(id);
}

export async function listTrashedBookings(bookings: BookingRepository, user: User) {
  requireAdministrator(user);
  if (!bookings.trashed) throw new AppError(501, 'La corbeille est indisponible.');
  return bookings.trashed();
}

export async function restoreTrashedBooking(bookings: BookingRepository, user: User, id: string) {
  requireAdministrator(user);
  if (!bookings.restore) throw new AppError(501, 'La restauration est indisponible.');
  if (!(await bookings.restore(id)))
    throw new AppError(404, 'Réservation introuvable dans la corbeille.');
}

export async function purgeTrashedBooking(bookings: BookingRepository, user: User, id: string) {
  requireAdministrator(user);
  if (!bookings.purge) throw new AppError(501, 'La suppression définitive est indisponible.');
  if (!(await bookings.purge(id)))
    throw new AppError(404, 'Réservation introuvable dans la corbeille.');
}
