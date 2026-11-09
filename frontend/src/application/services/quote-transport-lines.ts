import type { Vehicle } from '../../domain/model';
import {
  referenceLowDemandDiscount,
  referenceTransportLines,
} from '../../domain/reference-pricing';

export function quoteTransportLines(input: {
  vehicle: Vehicle | null | undefined;
  tierLabel: string;
  unitPrice: number;
  trips: number;
  date: string | null;
  followingTripPercent: number;
  lowDemandPercent: number;
}) {
  if (!input.vehicle) return [];
  const lines = referenceTransportLines(
    `Transport ${input.vehicle.shortName || input.vehicle.name} · ${input.tierLabel.toLowerCase()}`,
    input.unitPrice,
    input.trips,
    input.followingTripPercent,
  );
  if (lines.length === 1 && lines[0]) lines[0].label += ' (aller-retour)';
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const discount = referenceLowDemandDiscount(total, input.date, input.lowDemandPercent);
  if (discount > 0)
    lines.push({
      label: `Remise jour creux (−${input.lowDemandPercent} % sur le transport)`,
      quantity: 1,
      unitPrice: -discount,
      total: -discount,
    });
  return lines;
}
