import type { MovingEstimate } from '../../../../moving/domain/estimate/moving-estimate';
import type { MovingLaborPlanningSettings } from '../../../../shared/domain/model';

export function estimatedManoeuvreOvertimeHours(
  estimate: MovingEstimate | null,
  startTime: string,
): number {
  if (!estimate || estimate.crew <= 0) return 0;
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/u.exec(startTime);
  const [startHour, startMinute] = match ? startTime.split(':').map(Number) : [8, 0];
  const plannedEndMinutes = startHour * 60 + startMinute + estimate.totalMinutes;
  return Math.ceil(Math.max(0, plannedEndMinutes - 20 * 60) / 30) / 2;
}

export function manoeuvreOvertimeLine(
  estimate: MovingEstimate | null,
  settings: MovingLaborPlanningSettings | undefined,
  billingMode: 'complete' | 'standard' | 'driver-rental',
  options?: {
    enabled?: boolean | null;
    hours?: number | null;
    hourlyRate?: number | null;
    accountingHourlyRate?: number | null;
    startTime?: string;
  },
) {
  const rate =
    options?.hourlyRate ??
    options?.accountingHourlyRate ??
    settings?.manoeuvreOvertimeHourlyRate ??
    0;
  const estimatedHours = estimatedManoeuvreOvertimeHours(estimate, options?.startTime ?? '08:00');
  const hours = options?.hours ?? estimatedHours;
  if (options?.enabled === false || billingMode === 'driver-rental') return null;
  const quantity = (estimate?.crew ?? 0) * hours;
  return quantity > 0 && rate > 0
    ? {
        label: `Manœuvres · heures après 20 h (${estimate?.crew} × ${String(hours).replace('.', ',')} h)`,
        quantity,
        unitPrice: rate,
      }
    : null;
}
