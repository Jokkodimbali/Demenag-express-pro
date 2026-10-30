import type { Booking } from './model';

export function bookingClosure(booking: Booking, hasFinalQuote: boolean) {
  const trips = booking.trips ?? [];
  const incompleteTrips = trips.filter((trip) => !trip.finishedAt);
  const blockers = [
    !hasFinalQuote ? 'enregistrer le devis final' : '',
    !booking.driverFinishedAt ? 'attendre le signalement de fin des courses' : '',
    trips.length === 0 ? 'enregistrer au moins une course' : '',
    incompleteTrips.length > 0
      ? `terminer les courses ${incompleteTrips.map((trip) => trip.sequence).join(', ')}`
      : '',
  ].filter(Boolean);
  return {
    blockers,
    incompleteTrips,
    canClose: booking.status === 'in_progress' && blockers.length === 0,
  };
}
