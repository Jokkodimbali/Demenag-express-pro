import { AppError, requireValue } from './errors.js';
import { messages } from './messages/fr.js';
import type { BookingRules, BookingStatus, Role } from './model.js';
export function validateDate(date: string, now: Date, rules: BookingRules) {
  const parsed = new Date(`${date}T00:00:00Z`);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(+parsed) &&
      parsed.toISOString().slice(0, 10) === date,
    messages.dateInvalide,
  );
  const today = now.toISOString().slice(0, 10); // Dakar = UTC toute l’année.
  requireValue(date >= today, messages.choisissezUneDateAVenir);
  requireValue(
    +parsed <= +now + rules.maxAdvanceDays * 86400000,
    messages.maximumAdvanceNotice(rules.maxAdvanceDays),
  );
}
export function transition(current: BookingStatus, next: BookingStatus, role: Role) {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
    completed: [],
    cancelled: [],
  };
  const driverTransition =
    (current === 'confirmed' && next === 'in_progress') ||
    (current === 'in_progress' && next === 'completed');
  if (role === 'driver' && !driverTransition)
    throw new AppError(403, messages.actionReserveeALAdministration);
  if (role === 'client' && next !== 'cancelled')
    throw new AppError(403, messages.actionReserveeALAdministration);
  if (!allowed[current].includes(next))
    throw new AppError(409, messages.ceChangementDeStatutNEstPlusPossible);
}
