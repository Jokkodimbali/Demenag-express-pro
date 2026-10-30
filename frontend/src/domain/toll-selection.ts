import type { TollPoint } from './model';
import { tollPrice } from './toll-prices';

export type TollExtraLine = { id: string; label: string; quantity: number; unitPrice: number };
export type TollDirection = 'one-way' | 'round-trip';
export const quoteTollsFromLines = (lines: TollExtraLine[]) =>
  lines.map((line) => ({
    tollPointId: line.id,
    direction: line.label.endsWith(' · Aller simple')
      ? ('one-way' as const)
      : ('round-trip' as const),
    quantity: line.quantity,
  }));
export const tollLabel = (name: string) => (/^péage\b/i.test(name) ? name : `Péage ${name}`);

export function tollLine(
  point: TollPoint,
  vehicleId: string,
  direction: TollDirection,
  journeyCount: number,
  savedUnitPrice?: number,
): TollExtraLine {
  return {
    id: point.id,
    label: `${tollLabel(point.name)} · ${direction === 'round-trip' ? 'Aller-retour' : 'Aller simple'}`,
    quantity: journeyCount * (direction === 'round-trip' ? 2 : 1),
    unitPrice: savedUnitPrice ?? tollPrice(point, vehicleId),
  };
}

export function tollPointForLine(label: string, points: TollPoint[]): TollPoint | undefined {
  return points.find((point) =>
    [' · Aller simple', ' · Aller-retour'].some(
      (direction) => label === `${tollLabel(point.name)}${direction}`,
    ),
  );
}
