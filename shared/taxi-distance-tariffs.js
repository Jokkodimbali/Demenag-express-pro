export const defaultTaxiDistanceTariffs = [
  {
    id: 'taxi-distance-1-3',
    label: 'Dans le quartier ou juste à côté (1–3 km)',
    minDistanceKm: 0,
    maxDistanceKm: 3,
    amountFcfa: 1500,
    sortOrder: 0,
  },
  {
    id: 'taxi-distance-3-7',
    label: 'Course moyenne (>3–7 km)',
    minDistanceKm: 3,
    maxDistanceKm: 7,
    amountFcfa: 2500,
    sortOrder: 1,
  },
  {
    id: 'taxi-distance-7-12',
    label: 'Traversée de Dakar (>7–12 km)',
    minDistanceKm: 7,
    maxDistanceKm: 12,
    amountFcfa: 3500,
    sortOrder: 2,
  },
  {
    id: 'taxi-distance-12-20',
    label: 'Dakar vers la banlieue proche (>12–20 km)',
    minDistanceKm: 12,
    maxDistanceKm: 20,
    amountFcfa: 5000,
    sortOrder: 3,
  },
  {
    id: 'taxi-distance-20-30',
    label: 'Banlieue lointaine, Rufisque (>20–30 km)',
    minDistanceKm: 20,
    maxDistanceKm: 30,
    amountFcfa: 7000,
    sortOrder: 4,
  },
  {
    id: 'taxi-distance-aibd',
    label: 'Aéroport AIBD (Diass), environ 45 km (>30 km)',
    minDistanceKm: 30,
    maxDistanceKm: null,
    amountFcfa: 30000,
    sortOrder: 5,
  },
];

export function taxiDistanceTariffFor(distanceKm, tariffs) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const orderedTariffs = [...tariffs].sort((left, right) => left.sortOrder - right.sortOrder);
  return (
    orderedTariffs.find(
      (tariff) =>
        distanceKm >= tariff.minDistanceKm &&
        (tariff.maxDistanceKm == null || distanceKm <= tariff.maxDistanceKm),
    ) ?? null
  );
}

export function taxiFareForDistance(distanceKm, tariffs) {
  return taxiDistanceTariffFor(distanceKm, tariffs)?.amountFcfa ?? null;
}

export function taxiPaidLegCount(rotationCount) {
  return Math.max(1, Math.max(0, Math.round(rotationCount)) * 2 - 1);
}
