import { AppError } from '../shared/errors.js';
import { messages } from '../shared/messages/fr.js';
import type { Booking, User } from '../shared/model.js';
export function requireActiveUser(user: User | null | undefined): asserts user is User {
  if (!user || user.active === false) throw new AppError(401, messages.connectezVousPourContinuer);
}
export function requireAdministrator(user: User | null | undefined): asserts user is User {
  requireActiveUser(user);
  if (user.role !== 'admin') throw new AppError(403, messages.actionReserveeALAdministration);
}
export function requireNotDriver(user: User): void {
  if (user.role === 'driver')
    throw new AppError(403, 'Le chauffeur ne peut pas modifier la réservation.');
}
export function canReadBooking(user: User, ownerId: string): boolean {
  return user.active !== false && (user.role === 'admin' || user.id === ownerId);
}

export function isAssignedToBooking(booking: Booking, driverId: string): boolean {
  const crew = booking.crew;
  return (
    booking.driverId === driverId ||
    Boolean(crew?.chauffeur.includes(driverId)) ||
    Boolean(crew?.menuisier.includes(driverId)) ||
    Boolean(crew?.manoeuvre.includes(driverId))
  );
}
