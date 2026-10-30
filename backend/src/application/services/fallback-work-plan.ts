import type { Booking, WorkPlanReview, WorkPlanStep } from '../../domain/model.js';

export function fallbackWorkPlan(booking: Booking): WorkPlanStep[] {
  const slot = booking.timeSlot;
  const afternoon = /apr/i.test(slot);
  const morning = /matin/i.test(slot);
  const slotStart = afternoon ? 13 * 60 : 8 * 60;
  const slotEnd = morning ? 12 * 60 : afternoon ? 17 * 60 : 17 * 60;
  const specified = /^(\d{1,2}):(\d{2})$/.exec(slot);
  const start = booking.inventorySnapshot?.startTime
    ? Number(booking.inventorySnapshot.startTime.slice(0, 2)) * 60 +
      Number(booking.inventorySnapshot.startTime.slice(3, 5))
    : specified
      ? Number(specified[1]) * 60 + Number(specified[2])
      : slotStart;
  const estimatedEnd = booking.inventorySnapshot?.endTime
    ? Number(booking.inventorySnapshot.endTime.slice(0, 2)) * 60 +
      Number(booking.inventorySnapshot.endTime.slice(3, 5))
    : slotEnd;
  const end = Math.max(start + 60, estimatedEnd);
  const time = (minutes: number) =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const pending: WorkPlanReview = {
    status: 'pending',
    reason: '',
    checkedAt: null,
    checkedBy: null,
  };
  return [
    {
      id: 'fallback-1',
      time: time(start),
      title: 'Arrivée au départ',
      detail: '',
      minutes: 15,
      review: pending,
    },
    {
      id: 'fallback-2',
      time: time(start + 15),
      title: 'Déménagement',
      detail: 'Fiche d’appel non remplie : durée du créneau',
      minutes: end - start - 25,
      review: pending,
    },
    {
      id: 'fallback-3',
      time: time(end - 10),
      title: 'Vérification finale',
      detail: '',
      minutes: 10,
      review: pending,
    },
  ];
}
