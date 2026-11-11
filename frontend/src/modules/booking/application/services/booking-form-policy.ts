import type {
  Booking,
  Catalogue,
  ClientQuestion,
  ClientQuestionAnswer,
  Options,
  TollPoint,
  Vehicle,
  Settings,
} from '../../../shared/domain/model';
import type { Draft } from '../booking-draft';
import { normalizedClientPhone } from '../../../shared/domain/client-identity';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { tollPrice } from '../../../moving/domain/tolls/toll-prices';
import type { TollExtraLine } from '../../../moving/domain/tolls/toll-selection';
import {
  bookingDateError,
  bookingNameError,
  bookingPhoneError,
  bookingTimeError,
  type BookingFieldErrors,
  type BookingField,
} from '../../domain/booking-validation';

export function composeBookingNotes(input: {
  inventoryNote: string;
  administrativeQuote: boolean;
  fromNote: string;
  toNote: string;
  workSummary: string;
  notes: string;
}) {
  return [
    !input.administrativeQuote ? input.inventoryNote : '',
    input.administrativeQuote && input.fromNote.trim()
      ? `Repère départ : ${input.fromNote.trim()}`
      : '',
    input.administrativeQuote && input.toNote.trim()
      ? `Repère arrivée : ${input.toNote.trim()}`
      : '',
    input.administrativeQuote ? input.workSummary : '',
    input.notes,
  ]
    .filter(Boolean)
    .join(input.administrativeQuote ? '\n' : '\n\n');
}

export function bookingNotesLengthError(notes: string, administrativeQuote: boolean) {
  const maximum = administrativeQuote ? 10000 : 2000;
  if (notes.length <= maximum) return undefined;
  const formattedMaximum = administrativeQuote ? '10 000' : '2 000';
  return `La fiche d’appel et les précisions dépassent ${formattedMaximum} caractères. Réduisez les précisions avant l’envoi.`;
}

export function administrativeQuestionnaireAnswers(
  questions: readonly ClientQuestion[],
  answers: Record<string, string>,
): ClientQuestionAnswer[] {
  const configuredAnswers = questions
    .filter((question) => {
      const answer = answers[question.id]?.trim();
      return question.active && answer && answer !== 'À poser';
    })
    .map((question) => ({
      questionId: question.id,
      group: question.group,
      question: question.label,
      answer: answers[question.id].trim(),
    }));
  const keyQuestions: Array<[string, string]> = [
    ['key-ready', 'Le matériel sera-t-il prêt à être chargé ?'],
    ['key-stairs', 'Tout le matériel passe-t-il dans les escaliers ?'],
  ];
  const keyAnswers = keyQuestions
    .filter(([id]) => answers[id]?.trim())
    .map(([questionId, question]) => ({
      questionId,
      group: 'Questions clés',
      question,
      answer: answers[questionId].trim(),
    }));
  return [...configuredAnswers, ...keyAnswers];
}

export function changeOptionCount(
  options: Options,
  key: keyof Options,
  delta: number,
  maximum: number,
): Options {
  return {
    ...options,
    [key]: Math.max(0, Math.min(maximum, options[key] + delta)),
  };
}

export function validateBookingForm(input: {
  draft: Draft;
  scope: 'schedule' | 'contact' | 'all';
  administrativeQuote: boolean;
  settings?: Settings;
  allowExistingSlot: boolean;
}): BookingFieldErrors {
  const errors: BookingFieldErrors = {};
  if (!input.administrativeQuote && input.scope !== 'contact') {
    if (input.settings) {
      const dateError = bookingDateError(input.draft.date, input.settings);
      const timeError = bookingTimeError(
        input.draft.date,
        input.draft.timeSlot,
        input.settings,
        new Date(),
        input.allowExistingSlot,
      );
      if (dateError) errors.date = dateError;
      if (timeError) errors.timeSlot = timeError;
    } else {
      if (!input.draft.date) errors.date = 'Choisissez une date de déménagement.';
      if (!input.draft.timeSlot) errors.timeSlot = 'Choisissez un créneau horaire.';
    }
  }
  if (!input.administrativeQuote && input.scope !== 'schedule') {
    const nameError = bookingNameError(input.draft.customerName);
    const phoneError = bookingPhoneError(input.draft.customerPhone);
    if (nameError) errors.customerName = nameError;
    if (phoneError) errors.customerPhone = phoneError;
  }
  return errors;
}

export function bookingFieldErrorsFromApiMessage(message: string): BookingFieldErrors | undefined {
  const phone = /numéro valide avec son indicatif international/i.test(message);
  const date = /date invalide|date à venir|au maximum .* jours/i.test(message);
  const time =
    /créneau invalide|créneau n’est plus disponible|préavis|heure qui n’est pas déjà passée/i.test(
      message,
    );
  const field: BookingField | undefined = phone
    ? 'customerPhone'
    : date
      ? 'date'
      : time
        ? 'timeSlot'
        : undefined;
  return field ? { [field]: message } : undefined;
}

export function clientBookingHistory(bookings: readonly Booking[], phone: string) {
  const normalizedPhone = normalizedClientPhone(phone);
  const matches = bookings.filter(
    (booking) => normalizedClientPhone(booking.phone) === normalizedPhone,
  );
  const latest = matches.reduce<Booking | null>(
    (current, booking) => (!current || booking.createdAt > current.createdAt ? booking : current),
    null,
  );
  return latest
    ? { phone: normalizedPhone, name: latest.customerName, bookingCount: matches.length }
    : null;
}

export function normalizedBookingRecognitionPhone(phone: string) {
  return normalizedClientPhone(phone);
}

export function canRecognizeBookingClient(phone: string, hasAuthenticatedUser: boolean) {
  return hasAuthenticatedUser && normalizePhoneNumber(phone) !== null;
}

export function selectedBookingVehicle(
  vehicle: Vehicle | undefined,
  editingBooking: Booking | null,
): Vehicle | undefined {
  if (!vehicle) return undefined;
  return {
    ...vehicle,
    prices:
      editingBooking?.pricingSnapshot?.vehiclePrices[vehicle.id] ??
      (editingBooking?.vehicle.id === vehicle.id ? editingBooking.vehicle.prices : vehicle.prices),
  };
}

export function repriceTollLines(
  lines: TollExtraLine[],
  points: readonly TollPoint[],
  vehicleId: string,
): TollExtraLine[] {
  let changed = false;
  const next = lines.map((line) => {
    const point = points.find((item) => line.id === item.id);
    if (!point) return line;
    const unitPrice = tollPrice(point, vehicleId);
    if (line.unitPrice === unitPrice) return line;
    changed = true;
    return { ...line, unitPrice };
  });
  return changed ? next : lines;
}

export function adjustBookingDraftToCatalogue(
  draft: Draft,
  catalogue: Catalogue,
  input: { mode: 'booking' | 'admin-quote'; editingVehicleId?: string },
): Draft {
  const bookingDraft =
    input.mode === 'booking' &&
    !input.editingVehicleId &&
    !catalogue.settings.enabledSlots.some(
      (slot) => `${String(slot.startHour).padStart(2, '0')}:00` === draft.timeSlot,
    )
      ? {
          ...draft,
          timeSlot: `${String(catalogue.settings.enabledSlots[0]?.startHour ?? 8).padStart(2, '0')}:00`,
        }
      : draft;
  if (input.editingVehicleId === bookingDraft.vehicleId) return bookingDraft;
  const vehicleId = catalogue.vehicles.some(
    (vehicle) => vehicle.id === bookingDraft.vehicleId && vehicle.active !== false,
  )
    ? bookingDraft.vehicleId
    : (catalogue.vehicles.find((vehicle) => vehicle.active !== false)?.id ??
      bookingDraft.vehicleId);
  return vehicleId === bookingDraft.vehicleId ? bookingDraft : { ...bookingDraft, vehicleId };
}
