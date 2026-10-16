import type { BookingStatus } from './model';
export const money = (value: number | null) =>
  value === null
    ? 'Sur devis'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' FCFA';
export const dateLabel = (value: string) =>
  new Date(value + 'T12:00:00Z').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Dakar',
  });
export const today = () => new Date().toISOString().slice(0, 10);
export const statuses: Record<BookingStatus, string> = {
  pending: 'Demande reçue',
  confirmed: 'Confirmée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
export const tierLabels = (bounds: [number, number, number] = [15, 25, 35]) => [
  `Moins de ${bounds[0]} km`,
  `${bounds[0]} à ${bounds[1]} km`,
  `${bounds[1]} à ${bounds[2]} km`,
  `Plus de ${bounds[2]} km`,
];
