import { AppError, requireValue } from './errors.js';
import { messages } from './messages/fr.js';
import type { BookingRules, BookingStatus, Role } from './model.js';
export function validateDate(date: string, now: Date, rules: BookingRules, timeSlot: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(+parsed) &&
      parsed.toISOString().slice(0, 10) === date,
    messages.dateInvalide,
  );
  const today = now.toISOString().slice(0, 10); // Dakar = UTC toute l’année.
  requireValue(date >= today, messages.choisissezUneDateAVenir);
  requireValue(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeSlot), messages.creneauInvalide);
  requireValue(
    +parsed <= +now + rules.maxAdvanceDays * 86400000,
    messages.maximumAdvanceNotice(rules.maxAdvanceDays),
  );
  const appointment = new Date(`${date}T${timeSlot}:00Z`);
  const minimumTime = +now + rules.minNoticeHours * 3600000;
  requireValue(
    +appointment >= minimumTime,
    rules.minNoticeHours > 0
      ? messages.minimumAdvanceNotice(rules.minNoticeHours)
      : messages.heureReservationPassee,
  );
}
export function isAvailableBookingSlot(timeSlot: string, rules: BookingRules) {
  const slots = rules.enabledSlots.length ? rules.enabledSlots : [{ label: 'Matin', startHour: 8 }];
  return slots.some((slot) => `${String(slot.startHour).padStart(2, '0')}:00` === timeSlot);
}
export function transition(current: BookingStatus, next: BookingStatus, role: Role) {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
    completed: [],
    cancelled: [],
  };
  if (role === 'driver')
    throw new AppError(403, 'Le chauffeur ne peut pas modifier la réservation.');
  if (role === 'client' && next !== 'cancelled')
    throw new AppError(403, messages.actionReserveeALAdministration);
  if (!allowed[current].includes(next))
    throw new AppError(409, messages.ceChangementDeStatutNEstPlusPossible);
}
