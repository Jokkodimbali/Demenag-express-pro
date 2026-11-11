export type ReferenceTransportLine = {
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function referenceTransportLines(
  label: string,
  unitPrice: number,
  trips: number,
  followingTripPercent = 100,
): ReferenceTransportLine[] {
  const discount = Math.max(10, Math.min(100, followingTripPercent)) / 100;
  if (trips <= 1 || discount >= 1)
    return [
      { label: `${label} (aller-retour)`, quantity: trips, unitPrice, total: trips * unitPrice },
    ];
  const laterUnitPrice = Math.round((unitPrice * discount) / 500) * 500;
  return [
    { label: `${label} · 1er aller-retour`, quantity: 1, unitPrice, total: unitPrice },
    {
      label: `Allers-retours suivants (${Math.round(discount * 100)} % du 1er)`,
      quantity: trips - 1,
      unitPrice: laterUnitPrice,
      total: (trips - 1) * laterUnitPrice,
    },
  ];
}

export function referenceLowDemandDiscount(
  transportTotal: number,
  date: string | null | undefined,
  percent: number,
) {
  if (!date || percent <= 0) return 0;
  const day = new Date(`${date}T12:00:00`).getDay();
  const dayOfMonth = Number(date.slice(8, 10));
  if (day < 1 || day > 4 || dayOfMonth < 6 || dayOfMonth > 24) return 0;
  return Math.round((transportTotal * percent) / 100 / 500) * 500;
}
