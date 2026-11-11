import type { Booking, RouteTicket, User } from '../../../shared/domain/model';
import { blankDraft, type Draft } from '../booking-draft';

export function bookingEditAccessError(
  user: User | null,
  administrativeQuote: boolean,
  authLoading: boolean,
): string | undefined {
  if (!user) {
    return authLoading
      ? undefined
      : 'Connectez-vous à votre compte client pour modifier cette demande.';
  }
  if (user.role !== 'client' && !(administrativeQuote && user.role === 'admin'))
    return 'Cette demande ne peut être modifiée que depuis un compte autorisé.';
  return undefined;
}

export function bookingEditStatusError(
  booking: Booking,
  administrativeQuote: boolean,
): string | undefined {
  if (administrativeQuote) return undefined;
  if (!['pending', 'confirmed', 'cancelled'].includes(booking.status))
    return 'Cette réservation ne peut plus être modifiée.';
  if (booking.quotes.some((quote) => quote.kind === 'final'))
    return 'Cette réservation ne peut plus être modifiée.';
  return undefined;
}

export function bookingDraftFromExisting(
  booking: Booking,
  route: RouteTicket,
  administrativeQuote: boolean,
): Draft {
  const draft = blankDraft();
  const access = booking.workAccess;
  return {
    ...draft,
    vehicleId: booking.vehicle.id,
    customerName: booking.customerName,
    customerPhone: booking.phone,
    source: booking.source ?? '',
    fromAddress: booking.fromAddress,
    toAddress: booking.toAddress,
    from: booking.from,
    to: booking.to,
    route,
    distanceKmOverride:
      administrativeQuote && Math.abs(booking.distanceKm - route.distanceKm) > 0.01
        ? booking.distanceKm
        : null,
    date: booking.date ?? '',
    noDate: !booking.date,
    month: booking.month ?? booking.date?.slice(0, 7) ?? booking.createdAt.slice(0, 7),
    timeSlot: booking.timeSlot,
    estimatedTrips: Math.max(1, booking.estimate.trips),
    options: booking.options,
    notes: booking.notes,
    questionnaireAnswers: Object.fromEntries(
      (booking.questionnaireAnswers ?? []).map((answer) => [answer.questionId, answer.answer]),
    ),
    inventory: {
      ...(booking.inventorySnapshot?.sourceInventory ?? draft.inventory),
      fromFloor: access?.fromFloor ?? booking.inventorySnapshot?.fromFloor ?? 0,
      toFloor: access?.toFloor ?? booking.inventorySnapshot?.toFloor ?? 0,
      fromLift: access?.fromLift ?? booking.inventorySnapshot?.fromLift ?? false,
      toLift: access?.toLift ?? booking.inventorySnapshot?.toLift ?? false,
    },
  };
}

export function administrativeBookingEditLocked(booking: Booking) {
  return (
    ['completed', 'cancelled'].includes(booking.status) ||
    booking.quotes.some((quote) => quote.kind === 'final')
  );
}
