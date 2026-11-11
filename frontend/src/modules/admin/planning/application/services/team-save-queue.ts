import type { Booking } from '../../../../shared/domain/model';
import { mergeTeamChanges } from './team-planning';

export type CrewUpdateInput = {
  crew: NonNullable<Booking['crew']>;
  crewBriefs: NonNullable<Booking['crewBriefs']>;
  crewRefusedBy: NonNullable<Booking['crewRefusedBy']>;
  crewReplies: NonNullable<Booking['crewReplies']>;
  crewMessages: NonNullable<Booking['crewMessages']>;
  version: number;
};
type SaveQueues = Map<string, Promise<Booking | null>>;

export function queueTeamSave(
  booking: Booking,
  patch: Partial<Booking>,
  queues: SaveQueues,
  confirmed: Map<string, Booking>,
  persist: (id: string, input: CrewUpdateInput) => Promise<Booking>,
) {
  if (!confirmed.has(booking.id)) confirmed.set(booking.id, booking);
  const previous = queues.get(booking.id);
  const operation = (previous ? previous.catch(() => null) : Promise.resolve(null)).then(
    async () => {
      const latest = confirmed.get(booking.id) ?? booking;
      const changes = mergeTeamChanges(latest, booking, patch);
      const updated = await persist(booking.id, { ...changes, version: latest.version });
      confirmed.set(updated.id, updated);
      return updated;
    },
  );
  queues.set(booking.id, operation);
  return operation.finally(() => {
    if (queues.get(booking.id) === operation) queues.delete(booking.id);
  });
}
