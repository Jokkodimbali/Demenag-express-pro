import { formatting } from '../config/formatting';
import { messages } from '../content/fr';
import type { BookingStatus } from './model';
export const money = (value: number | null) =>
  value === null
    ? messages.surDevis
    : new Intl.NumberFormat(formatting.locale, { maximumFractionDigits: 0 }).format(value) +
      ' ' +
      formatting.currencyLabel;
export const dateLabel = (value: string | null) =>
  value
    ? new Date(value + 'T12:00:00Z').toLocaleDateString(formatting.locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: formatting.timeZone,
      })
    : 'Sans date de rendez-vous';
export const today = () => new Date().toISOString().slice(0, 10);
export const statuses: Record<BookingStatus, string> = {
  pending: messages.demandeRecue,
  confirmed: messages.confirmee,
  in_progress: messages.enCours,
  completed: messages.terminee,
  cancelled: messages.annulee,
};
export const tierLabels = (bounds: [number, number, number] = [15, 25, 35]) => [
  messages.distanceBelow(bounds[0]),
  messages.distanceBetween(bounds[0], bounds[1]),
  messages.distanceBetween(bounds[1], bounds[2]),
  messages.distanceAbove(bounds[2]),
];
export const referenceTierLabels = (bounds: [number, number, number] = [15, 25, 35]) => [
  `Moins de ${bounds[0]} km`,
  `${bounds[0]} – ${bounds[1]} km`,
  `${bounds[1]} – ${bounds[2]} km`,
  `Plus de ${bounds[2]} km`,
];
