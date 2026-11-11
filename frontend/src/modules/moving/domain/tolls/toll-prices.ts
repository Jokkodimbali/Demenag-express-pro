import type { TollPoint } from '../../../shared/domain/model';

export function tollPrice(point: TollPoint, vehicleId: string): number {
  return point.vehiclePrices?.[vehicleId] ?? point.heavyPrice;
}
