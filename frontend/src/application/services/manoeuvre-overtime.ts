import type { MovingEstimate } from '../../domain/moving-estimate';
import type { MovingLaborPlanningSettings } from '../../domain/model';

export function manoeuvreOvertimeLine(
  estimate: MovingEstimate | null,
  settings: MovingLaborPlanningSettings | undefined,
  billingMode: 'complete' | 'standard' | 'driver-rental',
) {
  const threshold = settings?.manoeuvreOvertimeThresholdHours ?? 8;
  const rate = settings?.manoeuvreOvertimeHourlyRate ?? 0;
  const hours =
    billingMode === 'driver-rental' || !estimate || estimate.crew <= 0
      ? 0
      : Math.ceil(Math.max(0, estimate.totalMinutes / 60 - threshold) * 2) / 2;
  const quantity = (estimate?.crew ?? 0) * hours;
  return quantity > 0 && rate > 0
    ? {
        label: `Manœuvres · heures au-delà de ${threshold} h (${estimate?.crew} × ${String(hours).replace('.', ',')} h)`,
        quantity,
        unitPrice: rate,
      }
    : null;
}
