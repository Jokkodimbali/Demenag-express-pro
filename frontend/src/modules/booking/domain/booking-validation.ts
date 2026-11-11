import type { Settings } from '../../shared/domain/model';
import { normalizePhoneNumber } from '../../shared/domain/phone-number';

export type BookingField = 'date' | 'timeSlot' | 'customerName' | 'customerPhone';
export type BookingFieldErrors = Partial<Record<BookingField, string>>;

export function bookingNameError(name: string): string | undefined {
  return name.trim().length < 2
    ? 'Saisissez votre nom et votre prénom (au moins 2 caractères).'
    : undefined;
}

export function bookingPhoneError(phone: string): string | undefined {
  if (!phone.trim()) return 'Saisissez votre numéro de téléphone.';
  return normalizePhoneNumber(phone)
    ? undefined
    : 'Format invalide. Ajoutez l’indicatif, par exemple +221 77 123 45 67 ou +33 6 12 34 56 78.';
}

export function bookingDateError(
  date: string,
  settings: Pick<Settings, 'maxAdvanceDays'>,
  now = new Date(),
): string | undefined {
  if (!date) return 'Choisissez une date de déménagement.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Saisissez une date valide.';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date)
    return 'Cette date n’existe pas. Vérifiez le jour, le mois et l’année.';
  const today = now.toISOString().slice(0, 10);
  if (date < today) return 'La date du déménagement ne peut pas être passée.';
  if (+parsed > +now + settings.maxAdvanceDays * 86400000)
    return `Choisissez une date dans les ${settings.maxAdvanceDays} prochains jours.`;
  return undefined;
}

export function bookingTimeError(
  date: string,
  timeSlot: string,
  settings: Pick<Settings, 'enabledSlots' | 'minNoticeHours'>,
  now = new Date(),
  allowExistingSlot = false,
): string | undefined {
  if (!timeSlot) return 'Choisissez un créneau horaire.';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeSlot))
    return 'Choisissez une heure valide au format HH:MM.';
  const slots = settings.enabledSlots.length
    ? settings.enabledSlots
    : [{ label: 'Matin (8h – 12h)', startHour: 8 }];
  const isAvailable = slots.some(
    (slot) => `${String(slot.startHour).padStart(2, '0')}:00` === timeSlot,
  );
  if (!isAvailable && !allowExistingSlot)
    return 'Ce créneau n’est plus disponible. Choisissez un autre horaire.';
  if (date && isAvailable) {
    const appointment = new Date(`${date}T${timeSlot}:00Z`);
    if (+appointment < +now + settings.minNoticeHours * 3600000)
      return settings.minNoticeHours > 0
        ? `Choisissez un créneau avec au moins ${settings.minNoticeHours} heures de préavis.`
        : 'Choisissez une heure qui n’est pas déjà passée.';
  }
  return undefined;
}
