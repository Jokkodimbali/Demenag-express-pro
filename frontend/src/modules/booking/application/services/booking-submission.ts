import type { BookingInput, Options } from '../../../shared/domain/model';
import type { Draft } from '../booking-draft';

export function buildBookingSubmission(input: {
  draft: Draft;
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
    customerName: draft.customerName,
    customerPhone: draft.customerPhone,
    source: input.administrativeQuote ? draft.source : undefined,
    fromAddress: draft.fromAddress,
    toAddress: draft.toAddress,
    date: draft.date,
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
