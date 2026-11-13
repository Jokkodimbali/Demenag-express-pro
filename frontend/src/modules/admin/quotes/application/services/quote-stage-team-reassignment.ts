import type { Booking } from '../../../../shared/domain/model';
import type { ApplicationApi } from '../../../../shared/application/ports';
import {
  activeBookings,
  autoAssignTeamForBooking,
  bookingsWithCrewForDay,
  normalizeCrewLead,
  orderBookingsForAutoComposition,
} from '../../../planning/application/services/team-planning';

export async function reassignTeamsAfterScheduleChange(
  api: Pick<ApplicationApi, 'bookings' | 'drivers' | 'updateCrew' | 'booking'>,
  booking: Booking,
  previousBooking: Booking,
  onFailure: () => void,
) {
  if (booking.date === previousBooking.date && booking.timeSlot === previousBooking.timeSlot)
    return booking;
  try {
    const [savedBookings, employees] = await Promise.all([api.bookings(), api.drivers()]);
    let plannedBookings = savedBookings.map((item) => (item.id === booking.id ? booking : item));
    const dates = [...new Set([booking.date, previousBooking.date].filter(Boolean))] as string[];
    for (const date of dates) {
      const forceCurrentFinal = booking.date === date && booking.status === 'completed';
      const dayBookings = activeBookings(plannedBookings).filter(
        (item) =>
          item.date === date &&
          (item.status !== 'completed' || (forceCurrentFinal && item.id === booking.id)),
      );
      const autoJobs = orderBookingsForAutoComposition(
        dayBookings.map((item) =>
          forceCurrentFinal && item.id === booking.id ? { ...item, status: 'pending' } : item,
        ),
      );
      for (const item of autoJobs) {
        const current = plannedBookings.find((saved) => saved.id === item.id) ?? item;
        const assignment = autoAssignTeamForBooking({
          booking: current,
          employees,
          date,
          plannedBookings,
        });
        const saved = await api.updateCrew(current.id, {
          crew: assignment.crew,
          crewBriefs: current.crewBriefs ?? {},
          crewRefusedBy: current.crewRefusedBy ?? [],
          crewReplies: current.crewReplies ?? {},
          crewMessages: current.crewMessages ?? {},
          version: current.version,
        });
        plannedBookings = plannedBookings.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        );
      }
      for (const item of bookingsWithCrewForDay(plannedBookings, date)) {
        const crew = normalizeCrewLead({
          chauffeur: item.crew?.chauffeur ?? (item.driverId ? [item.driverId] : []),
          menuisier: item.crew?.menuisier ?? [],
          manoeuvre: item.crew?.manoeuvre ?? [],
          chef: item.crew?.chef ?? '',
        });
        if (crew.chef === item.crew?.chef) continue;
        const saved = await api.updateCrew(item.id, {
          crew,
          crewBriefs: item.crewBriefs ?? {},
          crewRefusedBy: item.crewRefusedBy ?? [],
          crewReplies: item.crewReplies ?? {},
          crewMessages: item.crewMessages ?? {},
          version: item.version,
        });
        plannedBookings = plannedBookings.map((candidate) =>
          candidate.id === saved.id ? saved : candidate,
        );
      }
    }
    return plannedBookings.find((item) => item.id === booking.id) ?? booking;
  } catch {
    onFailure();
    return await api.booking(booking.id).catch(() => booking);
  }
}
