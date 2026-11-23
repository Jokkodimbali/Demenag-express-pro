import type { Booking, BookingInput, Options } from '../../../shared/domain/model';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import type { Draft } from '../booking-draft';

export function buildBookingSubmission(input: {
  draft: Draft;
  existingBooking?: Pick<Booking, 'customerName' | 'phone'>;
  routeId: string;
  administrativeQuote: boolean;
  quoteTrips: number;
  options?: Options;
  notes: string;
  questionnaireAnswers: BookingInput['questionnaireAnswers'];
  workPlan: NonNullable<BookingInput['workPlan']>;
  inventorySnapshot?: BookingInput['inventorySnapshot'];
}): BookingInput {
  const { draft } = input;
  return {
    vehicleId: draft.vehicleId,
    routeId: input.routeId,
    distanceKmOverride: draft.distanceKmOverride,
    trips: input.administrativeQuote ? input.quoteTrips : draft.estimatedTrips,
    customerName:
      input.administrativeQuote && input.existingBooking && draft.customerName.trim().length < 2
        ? input.existingBooking.customerName
        : draft.customerName,
    customerPhone:
      input.administrativeQuote &&
      input.existingBooking &&
      !normalizePhoneNumber(draft.customerPhone)
        ? input.existingBooking.phone
        : draft.customerPhone,
    source: input.administrativeQuote ? draft.source : undefined,
    fromAddress: draft.fromAddress,
    toAddress: draft.toAddress,
    date: draft.date,
    noDate: draft.noDate,
    month: draft.date ? draft.date.slice(0, 7) : draft.month,
    timeSlot: draft.date ? draft.timeSlot : '',
    options: input.options ?? draft.options,
    workAccess: {
      fromFloor: draft.inventory.fromFloor,
      toFloor: draft.inventory.toFloor,
      fromLift: draft.inventory.fromLift,
      toLift: draft.inventory.toLift,
    },
    notes: input.notes,
    questionnaireAnswers: input.questionnaireAnswers,
    workPlan: input.administrativeQuote ? input.workPlan : undefined,
    inventorySnapshot: input.inventorySnapshot,
    requestId: draft.requestId,
  };
}
