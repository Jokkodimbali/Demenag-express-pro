import { AppError, requireValue } from './errors.js';
import type { BookingRules, BookingStatus } from './model.js';
export const timeSlots = ['Matin (8h – 12h)', 'Après-midi (13h – 17h)', 'Soir (17h – 20h)'];
export function validateDate(date: string, slot: string, now: Date, rules: BookingRules = {}) {
  const parsed = new Date(`${date}T00:00:00Z`);
  requireValue(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(+parsed) &&
      parsed.toISOString().slice(0, 10) === date,
    'Date invalide.',
  );
  const today = now.toISOString().slice(0, 10); // Dakar = UTC toute l’année.
  requireValue(date >= today, 'Choisissez une date à venir.');
  requireValue(
    +parsed <= +now + (rules.maxAdvanceDays ?? 366) * 86400000,
    `Réservez au maximum ${rules.maxAdvanceDays ?? 366} jours à l’avance.`,
  );
  requireValue((rules.enabledSlots ?? timeSlots).includes(slot), 'Créneau invalide.');
  requireValue(
    +parsed + [8, 13, 17][timeSlots.indexOf(slot)] * 3600000 >=
      +now + (rules.minNoticeHours ?? 0) * 3600000,
    'Le délai minimum avant réservation n’est pas respecté.',
  );
  if (date === today)
    requireValue(
      now.getUTCHours() < [8, 13, 17][timeSlots.indexOf(slot)],
      'Ce créneau a déjà commencé.',
    );
}
export function transition(current: BookingStatus, next: BookingStatus, admin: boolean) {
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: [],
    completed: [],
    cancelled: [],
  };
  if (!admin && next !== 'cancelled')
    throw new AppError(403, 'Action réservée à l’administration.');
  if (!allowed[current].includes(next))
    throw new AppError(409, 'Ce changement de statut n’est plus possible.');
}
