import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Draft } from '../../application/booking-draft';
import {
  defaultMovingLaborPlanning,
  estimateMovingWork,
  formatDuration,
} from '../../domain/moving-estimate';
import type { MovingLaborPlanningSettings, Vehicle } from '../../domain/model';
import type { Inventory } from '../../domain/inventory';

const vehicleNames: Record<string, string> = {
  sprinter: 'Sprinter',
  trafic: 'Trafic',
  master: 'Master',
};
const vehicleLabel = (vehicle: Vehicle) => vehicleNames[vehicle.id] ?? vehicle.name;
const durationQuarterHour = (minutes: number) =>
  formatDuration(Math.max(15, Math.round(minutes / 15) * 15));
const referenceDuration = (minutes: number) =>
  formatDuration(Math.max(5, Math.round(minutes / 5) * 5));

export function MovingPlanningPanel({
  draft,
  setDraft,
  vehicles,
  selectedVehicleId,
  trips,
  maxTrips,
  onApply,
  laborPlanning,
  trafficDurationMinutes,
  volumeDetail,
  inventoryChecks = [],
  labourPriceEditor,
  estimateInventory,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  trips: number;
  maxTrips: number;
  onApply: (vehicleId: string, trips: number) => void;
  laborPlanning?: MovingLaborPlanningSettings;
  trafficDurationMinutes?: number;
  volumeDetail?: string;
  inventoryChecks?: string[];
  labourPriceEditor?: ReactNode;
  estimateInventory?: Inventory;
}) {
  const inventory = estimateInventory ?? draft.inventory;
  const dayLimitMinutes =
    (laborPlanning?.maxDayHours ?? defaultMovingLaborPlanning.maxDayHours) * 60;
  const laborLimits = { ...defaultMovingLaborPlanning, ...laborPlanning };
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const current = selectedVehicle
    ? estimateMovingWork(inventory, selectedVehicle, draft.route, {
        trips,
        crew: inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning,
        trafficDurationMinutes,
      })
    : null;
  const comparisons = vehicles
    .filter((vehicle) => vehicle.active !== false)
    .sort((left, right) => {
      const order = ['sprinter', 'trafic', 'master'];
      const leftOrder = order.indexOf(left.id);
      const rightOrder = order.indexOf(right.id);
      return (leftOrder < 0 ? order.length : leftOrder) -
        (rightOrder < 0 ? order.length : rightOrder);
    })
    .map((vehicle) => ({
      vehicle,
      estimate: estimateMovingWork(inventory, vehicle, draft.route, {
        startTime: draft.timeSlot,
        laborPlanning,
        trafficDurationMinutes,
      }),
    }));
  const volume = comparisons[0]?.estimate.volume ?? 0;
  const overHandling = !!current && current.handlingMinutes > laborLimits.maxHandlingHours * 60;
  const needsAlternatives =
    !!current &&
    (current.totalMinutes > dayLimitMinutes ||
      (overHandling && current.crew >= current.recommendedCrew));
  const alternatives = needsAlternatives
    ? comparisons
        .flatMap(({ vehicle, estimate }) =>
          ([1, 2] as const).flatMap((parallelVehicles) => {
            if ((vehicle.id === selectedVehicleId && parallelVehicles === 1) ||
                (parallelVehicles === 2 && estimate.trips < 2)) return [];
            const proposal = estimateMovingWork(inventory, vehicle, draft.route, {
              trips: estimate.trips,
              parallelVehicles,
              startTime: draft.timeSlot,
              laborPlanning,
              trafficDurationMinutes,
            });
            return proposal.rawTotalMinutes <= dayLimitMinutes
              ? [{ vehicle, parallelVehicles, estimate: proposal }]
              : [];
          }),
        )
        .sort((left, right) =>
          Number(right.estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60) -
            Number(left.estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60) ||
          left.parallelVehicles - right.parallelVehicles ||
          left.estimate.rawTotalMinutes - right.estimate.rawTotalMinutes,
        )
        .slice(0, 3)
    : [];

  return (
    <section className="moving-planning-panel" aria-label="Estimation du déménagement">
      <div className="moving-estimate-card">
        <div className="moving-estimate-card-head">
          <h3>ESTIMATION DES ALLERS-RETOURS</h3>
          <strong>Volume ≈ {volume.toFixed(1).replace('.', ',')} m³</strong>
        </div>
        <p className="moving-estimate-volume-detail">
          {volumeDetail ?? 'Volume des meubles, objets et effets annexes de la fiche d’appel.'}
        </p>
        {!!inventoryChecks.length && (
          <div className="moving-estimate-checks">
            {inventoryChecks.map((check) => (
              <span key={check}>À vérifier : {check}</span>
            ))}
          </div>
        )}
        {volume === 0 ? (
          <p className="muted">
            Cochez les objets ou précisez le type de logement pour afficher les estimations.
          </p>
        ) : (
          <div className="moving-vehicle-estimates">
            {comparisons.map(({ vehicle, estimate }) => {
              const selected = vehicle.id === selectedVehicleId;
              return (
                <article
                  className={'moving-vehicle-estimate' + (selected ? ' active' : '')}
                  key={vehicle.id}
                >
                  <div className="moving-vehicle-estimate-head">
                    <strong>{vehicleLabel(vehicle)}</strong>
                    <span>{estimate.capacity.toFixed(1).replace('.', ',')} m³</span>
                  </div>
                  <strong className="moving-vehicle-trip-count">
                    {estimate.trips || '—'}{' '}
                    {estimate.trips ? (estimate.trips > 1 ? 'allers-retours' : 'aller-retour') : ''}
                  </strong>
                  <span className="moving-vehicle-fill">
                    {Math.round(estimate.volume / (estimate.capacity * estimate.trips || 1) * 100)} % de remplissage
                    {estimate.trips > 1 &&
                      (estimate.volume - (estimate.trips - 1) * estimate.capacity * estimate.fillRate) /
                        (estimate.capacity * estimate.fillRate) < 0.2
                      ? ` · dernier voyage à ${Math.round((estimate.volume - (estimate.trips - 1) * estimate.capacity * estimate.fillRate) / (estimate.capacity * estimate.fillRate) * 100)} %, peut tenir en ${estimate.trips - 1} si chargé serré`
                      : ''}
                  </span>
                  {estimate.vehicleWarnings.map((warning) => (
                    <span className="moving-vehicle-warning" key={warning} role="status">
                      À vérifier : {warning}
                    </span>
                  ))}
                  <span className="moving-vehicle-current">
                    {selected ? 'Véhicule du devis' : ' '}
                  </span>
                  <button
                    type="button"
                    className={`moving-vehicle-apply${selected && estimate.trips === trips ? ' applied' : ''}`}
                    disabled={!estimate.trips || estimate.trips > maxTrips}
                    onClick={() => onApply(vehicle.id, estimate.trips)}
                  >
                    {selected && estimate.trips === trips
                      ? '✓ Appliqué'
                      : 'Appliquer'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {current && volume > 0 && (
        <div className="moving-labor-card">
          <header className="moving-labor-heading">
            <h3>MAIN-D'ŒUVRE ET DURÉE</h3>
            <strong className={current.totalMinutes > dayLimitMinutes ? 'warning' : 'success'}>
              {current.totalMinutes > dayLimitMinutes
                ? `Dépasse ${laborLimits.maxDayHours} h · ${formatDuration(current.totalMinutes)}`
                : `✓ Tient dans la journée · ${formatDuration(current.totalMinutes)}`}
            </strong>
          </header>
          <div className="moving-labor-summary">
            {labourPriceEditor}
            <div className="moving-crew-control">
              <span>Manœuvres</span>
              <div>
                <button
                  type="button"
                  aria-label="Retirer une manœuvre"
                  disabled={current.crew <= 1}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      inventory: { ...value.inventory, crew: Math.max(1, current.crew - 1) },
                      options: { ...value.options, labour: Math.max(1, current.crew - 1) },
                    }))
                  }
                >
                  −
                </button>
                <strong>{current.crew}</strong>
                <button
                  type="button"
                  aria-label="Ajouter une manœuvre"
                  disabled={current.crew >= 20}
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      inventory: { ...value.inventory, crew: Math.min(20, current.crew + 1) },
                      options: { ...value.options, labour: Math.min(20, current.crew + 1) },
                    }))
                  }
                >
                  +
                </button>
              </div>
              <small>
                Chargement + déchargement ≈ {referenceDuration(current.handlingMinutes)} (plafond{' '}
                {laborLimits.maxHandlingHours} h)
              </small>
              {draft.inventory.crew ? (
                <button
                  type="button"
                  className="moving-crew-reset"
                  onClick={() =>
                    setDraft((value) => ({
                      ...value,
                      inventory: { ...value.inventory, crew: 0 },
                      options: { ...value.options, labour: current.recommendedCrew },
                    }))
                  }
                >
                  Revenir au nombre recommandé ({current.recommendedCrew})
                </button>
              ) : null}
            </div>
            {current.carpenterCount > 0 && (
              <div>
                <span>Menuisier{current.carpenterCount > 1 ? 's' : ''}</span>
                <strong>{current.carpenterCount}</strong>
                <small>
                  Démontage ≈ {formatDuration(current.dismantleFromMinutes)} · remontage ≈{' '}
                  {formatDuration(current.dismantleToMinutes)}, en parallèle des manœuvres
                </small>
              </div>
            )}
            {current.packingMinutes > 0 && (
              <div>
                <span>Emballage</span>
                <strong>≈ {formatDuration(current.packingMinutes)}</strong>
                <small>
                  {current.packingMinutes > 90
                    ? `La veille (plus de 1 h 30), par ${current.crew} manœuvres`
                    : 'Le jour même, avant le chargement'}
                </small>
              </div>
            )}
            <div>
              <span>Trajet</span>
              <strong>{draft.route?.distanceKm ? `≈ ${formatDuration(current.travelLegMinutes)}` : '—'}</strong>
              <small>
                {draft.route?.distanceKm
                  ? `${String(draft.route.distanceKm).replace('.', ',')} km${current.plannedTrips > 1 ? ` · ${current.plannedTrips} allers chargés, ${current.plannedTrips - 1} retour${current.plannedTrips > 2 ? 's' : ''} à vide = ${formatDuration(current.travelMinutes)}` : ', stationnement compris'}`
                  : 'Placez A et B sur la carte pour estimer le trajet.'}
              </small>
            </div>
            <div>
              <span>Durée totale</span>
              <strong>≈ {formatDuration(current.totalMinutes)}</strong>
              <small>
                Entre {durationQuarterHour(current.lowDurationMinutes)} et{' '}
                {durationQuarterHour(current.highDurationMinutes)} selon la circulation et les accès
              </small>
            </div>
          </div>
          <div className="moving-plan">
            <h4>PLANNING PRÉVISIONNEL</h4>
            {current.planning.map((step, index) => (
              <div className="moving-plan-row" key={`${step.title}-${index}`}>
                <strong>{step.time}</strong>
                <div>
                  <span>{step.title}</span>
                  <small>{step.detail}</small>
                </div>
                <span>{formatDuration(step.minutes)}</span>
              </div>
            ))}
            <div className="moving-plan-end">
              <strong>{current.endTime}</strong>
              <span>Fin prévue</span>
            </div>
            {current.endLate && (
              <span className="moving-plan-late">Fin après 19 h : commencer plus tôt ou répartir sur 2 jours.</span>
            )}
          </div>
          {needsAlternatives && (alternatives.length > 0 || current.totalMinutes > dayLimitMinutes) && (
            <div className="moving-alternatives">
              <strong>
                {current.totalMinutes > dayLimitMinutes
                  ? `Au-delà du plafond de ${laborLimits.maxDayHours} h. Solutions :`
                  : `Chargement + déchargement au-delà de ${laborLimits.maxHandlingHours} h. Solutions :`}
              </strong>
              {alternatives.map(({ vehicle, parallelVehicles, estimate }) => (
                <div className="moving-alternative" key={`${vehicle.id}-${parallelVehicles}`}>
                  <span>
                    {parallelVehicles === 2
                      ? `2 × ${vehicleLabel(vehicle)} en parallèle (si disponibles) · ${Math.ceil(estimate.trips / 2)} AR chacun`
                      : `${vehicleLabel(vehicle)} · ${estimate.trips} AR`}, {estimate.crew} manœuvres
                  </span>
                  <strong className={estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60 ? 'success' : ''}>
                    ≈ {referenceDuration(estimate.rawTotalMinutes)}
                    {estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60
                      ? ' ✓'
                      : ` · manutention ${referenceDuration(estimate.handlingMinutes)}`}
                  </strong>
                  {parallelVehicles === 1 && estimate.trips <= maxTrips && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((value) => ({
                          ...value,
                          inventory: { ...value.inventory, crew: 0 },
                          options: { ...value.options, labour: estimate.crew },
                        }));
                        onApply(vehicle.id, estimate.trips);
                      }}
                    >
                      Appliquer
                    </button>
                  )}
                </div>
              ))}
              {current.totalMinutes > dayLimitMinutes && (
                <div className="moving-alternative">
                  <span>
                    Sur {Math.max(2, current.minimumDays)} jours avec le {selectedVehicle && vehicleLabel(selectedVehicle)} (chargement le 1er jour, fin le lendemain)
                  </span>
                  <strong>≈ {formatDuration(current.totalMinutes)} au total</strong>
                </div>
              )}
            </div>
          )}
          <details className="moving-method">
            <summary>Méthode de calcul</summary>
            <div>
              <p>Cadence par manœuvre et par heure au rez-de-chaussée : cartons et sacs ≈ {(laborLimits.cubicMetersPerHourPerMover * 1.4).toFixed(1).replace('.', ',')} m³, meubles ≈ {laborLimits.cubicMetersPerHourPerMover.toFixed(1).replace('.', ',')} m³, canapés et matelas ≈ {(laborLimits.cubicMetersPerHourPerMover * 1.2).toFixed(1).replace('.', ',')} m³, objets lourds (frigo, armoire montée, buffet…) ≈ {(laborLimits.cubicMetersPerHourPerMover * 0.72).toFixed(1).replace('.', ',')} m³. Déchargement 20 % plus rapide.</p>
              <p>Étages sans ascenseur : de +10 % (cartons) à +25 % (objets lourds) par étage, 40 % de plus si escalier étroit. Avec ascenseur : +5 % d'attente puis +3 % à +15 % par étage, les canapés passant souvent par l'escalier.</p>
              <p>Accès camion difficile (portage long) : +20 %. Objets fragiles : +10 %.</p>
              <p>Équipe : 2 manœuvres minimum, 3 si un objet lourd passe 2 étages ou plus sans ascenseur. Au-delà de 4 par véhicule, chacun de plus compte pour 60 % car ils se gênent. Maximum {laborLimits.maxMoversPerVehicle} par véhicule.</p>
              <p>Menuisier : démontage au départ et remontage à l'arrivée, en parallèle des manœuvres.</p>
              <p>Emballage : ≈ 0,45 h par m³ de cartons et petits objets, 0,1 h par m³ de meubles. Fait la veille s'il dépasse 1 h 30.</p>
              <p>Trajet : itinéraire majoré pour un utilitaire chargé et la circulation, +5 % pour Master et Sprinter, +10 min de stationnement par trajet, retour à vide 15 % plus rapide.</p>
              <p>Temps fixes : 15 min d'arrivée et de protection, 10 min de vérification finale. Pause de {laborLimits.pauseMinutes} min si la journée dépasse 5 h.</p>
              <p>Plafonds : chargement + déchargement ≤ {laborLimits.maxHandlingHours} h, journée ≤ {laborLimits.maxDayHours} h, début à {laborLimits.defaultStartHour} h si le créneau n’est pas précisé. Modifiables dans Paramètres.</p>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
