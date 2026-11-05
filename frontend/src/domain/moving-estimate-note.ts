import type { MovingEstimate } from './moving-estimate';

export function movingEstimateNote(estimate: MovingEstimate): string {
  const vehicleName = estimate.vehicleName.replace(/^(Mercedes|Renault)\s+/u, '');
  return [
    `Estimation des allers-retours : volume ≈ ${estimate.volume.toFixed(1).replace('.', ',')} m³, soit ${estimate.plannedTrips} aller-retour${estimate.plannedTrips > 1 ? 's' : ''} en ${vehicleName}.`,
    `Main-d’œuvre : ${estimate.crew} manœuvre${estimate.crew > 1 ? 's' : ''}${estimate.carpenterCount ? ` + ${estimate.carpenterCount} menuisier${estimate.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ≈ ${formatDuration(estimate.loadingMinutes + estimate.unloadingMinutes)}.`,
    ...(estimate.packingMinutes > 0
      ? [
          `Emballage : ≈ ${formatDuration(estimate.packingMinutes)}${estimate.packingMinutes > 90 ? ', la veille.' : ', le jour même avant le chargement.'}`,
        ]
      : []),
    ...(estimate.travelMinutes > 0
      ? [
          `Trajet : ≈ ${formatDuration(estimate.travelMinutes)} pour ${estimate.plannedTrips} voyage${estimate.plannedTrips > 1 ? 's' : ''}.`,
        ]
      : []),
    `Planning prévisionnel : de ${estimate.startTime} à ${estimate.endTime}, durée ≈ ${formatDuration(estimate.totalMinutes)} (entre ${formatDuration(estimate.lowDurationMinutes)} et ${formatDuration(estimate.highDurationMinutes)}).`,
    ...(estimate.minimumDays > 1
      ? [
          `Durée à organiser sur environ ${estimate.minimumDays} jours ou avec un véhicule supplémentaire.`,
        ]
      : []),
  ].join('\n');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return Math.ceil(minutes) + ' min';
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? hours + ' h ' + remaining.toString().padStart(2, '0') : hours + ' h';
}
