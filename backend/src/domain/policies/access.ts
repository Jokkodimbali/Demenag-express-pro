import { AppError } from '../errors.js';
import { messages } from '../messages/fr.js';
import type { User } from '../model.js';
export function requireActiveUser(user: User | null | undefined): asserts user is User {
  if (!user || user.active === false) throw new AppError(401, messages.connectezVousPourContinuer);
}
export function requireAdministrator(user: User | null | undefined): asserts user is User {
  requireActiveUser(user);
  if (user.role !== 'admin') throw new AppError(403, messages.actionReserveeALAdministration);
}
export function canReadBooking(user: User, ownerId: string): boolean {
  return user.active !== false && (user.role === 'admin' || user.id === ownerId);
}
