import { uiText } from '../../content/reference-ui-text';
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
      return (
        (leftOrder < 0 ? order.length : leftOrder) - (rightOrder < 0 ? order.length : rightOrder)
      );
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
            if (
              (vehicle.id === selectedVehicleId && parallelVehicles === 1) ||
              (parallelVehicles === 2 && estimate.trips < 2)
            )
              return [];
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
        .sort(
          (left, right) =>
            Number(right.estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60) -
              Number(left.estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60) ||
            left.parallelVehicles - right.parallelVehicles ||
            left.estimate.rawTotalMinutes - right.estimate.rawTotalMinutes,
        )
        .slice(0, 3)
    : [];

  return (
    <section className="moving-planning-panel" aria-label={uiText['estimationDuDemenagement']}>
      <div className="moving-estimate-card">
        <div className="moving-estimate-card-head">
          <h3>{uiText['estimationDESALLERSRETOURS']}</h3>
          <strong>
            {uiText['volume2']}
            {volume.toFixed(1).replace('.', ',')} {uiText['m³']}
          </strong>
        </div>
        <p className="moving-estimate-volume-detail">
          {volumeDetail ?? 'Volume des meubles, objets et effets annexes de la fiche d’appel.'}
        </p>
        {!!inventoryChecks.length && (
          <div className="moving-estimate-checks">
            {inventoryChecks.map((check) => (
              <span key={check}>
                {uiText['aVerifier']}
                {check}
              </span>
            ))}
          </div>
        )}
        {volume === 0 ? (
          <p className="muted">
            {uiText['cochezLesObjetsOuPrecisezLeTypeDeLogementPourAfficherL']}
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
                    <span>
                      {estimate.capacity.toFixed(1).replace('.', ',')} {uiText['m³']}
                    </span>
                  </div>
                  <strong className="moving-vehicle-trip-count">
                    {estimate.trips || '—'}{' '}
                    {estimate.trips ? (estimate.trips > 1 ? 'allers-retours' : 'aller-retour') : ''}
                  </strong>
                  <span className="moving-vehicle-fill">
                    {Math.round(
                      (estimate.volume / (estimate.capacity * estimate.trips || 1)) * 100,
                    )}{' '}
                    {uiText['deRemplissage']}
                    {estimate.trips > 1 &&
                    (estimate.volume -
                      (estimate.trips - 1) * estimate.capacity * estimate.fillRate) /
                      (estimate.capacity * estimate.fillRate) <
                      0.2
                      ? ` · dernier voyage à ${Math.round(((estimate.volume - (estimate.trips - 1) * estimate.capacity * estimate.fillRate) / (estimate.capacity * estimate.fillRate)) * 100)} %, peut tenir en ${estimate.trips - 1} si chargé serré`
                      : ''}
                  </span>
                  {estimate.vehicleWarnings.map((warning) => (
                    <span className="moving-vehicle-warning" key={warning} role="status">
                      {uiText['aVerifier']}
                      {warning}
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
                    {selected && estimate.trips === trips ? '✓ Appliqué' : 'Appliquer'}
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
            <h3>{uiText['mainDŒUVREETDUREE']}</h3>
            <strong className={current.totalMinutes > dayLimitMinutes ? 'warning' : 'success'}>
              {current.totalMinutes > dayLimitMinutes
                ? `Dépasse ${laborLimits.maxDayHours} h · ${formatDuration(current.totalMinutes)}`
                : `✓ Tient dans la journée · ${formatDuration(current.totalMinutes)}`}
            </strong>
          </header>
          <div className="moving-labor-summary">
            {labourPriceEditor}
            <div className="moving-crew-control">
              <span>{uiText['manœuvres']}</span>
              <div>
                <button
                  type="button"
                  aria-label={uiText['retirerUneManœuvre']}
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
                  aria-label={uiText['ajouterUneManœuvre']}
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
                {uiText['chargementDechargement']}
                {referenceDuration(current.handlingMinutes)} {uiText['plafond']}{' '}
                {laborLimits.maxHandlingHours} {uiText['h']}
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
                  {uiText['revenirAuNombreRecommande']}
                  {current.recommendedCrew})
                </button>
              ) : null}
            </div>
            {current.carpenterCount > 0 && (
              <div>
                <span>
                  {uiText['menuisier2']}
                  {current.carpenterCount > 1 ? 's' : ''}
                </span>
                <strong>{current.carpenterCount}</strong>
                <small>
                  {uiText['demontage']}
                  {formatDuration(current.dismantleFromMinutes)} {uiText['remontage']}{' '}
                  {formatDuration(current.dismantleToMinutes)}
                  {uiText['enParalleleDesManœuvres']}
                </small>
              </div>
            )}
            {current.packingMinutes > 0 && (
              <div>
                <span>{uiText['emballage']}</span>
                <strong>≈ {formatDuration(current.packingMinutes)}</strong>
                <small>
                  {current.packingMinutes > 90
                    ? `La veille (plus de 1 h 30), par ${current.crew} manœuvres`
                    : 'Le jour même, avant le chargement'}
                </small>
              </div>
            )}
            <div>
              <span>{uiText['trajet3']}</span>
              <strong>
                {draft.route?.distanceKm ? `≈ ${formatDuration(current.travelLegMinutes)}` : '—'}
              </strong>
              <small>
                {draft.route?.distanceKm
                  ? `${String(draft.route.distanceKm).replace('.', ',')} km${current.plannedTrips > 1 ? ` · ${current.plannedTrips} allers chargés, ${current.plannedTrips - 1} retour${current.plannedTrips > 2 ? 's' : ''} à vide = ${formatDuration(current.travelMinutes)}` : ', stationnement compris'}`
                  : 'Placez A et B sur la carte pour estimer le trajet.'}
              </small>
            </div>
            <div>
              <span>{uiText['dureeTotale']}</span>
              <strong>≈ {formatDuration(current.totalMinutes)}</strong>
              <small>
                {uiText['entre']}
                {durationQuarterHour(current.lowDurationMinutes)} {uiText['et']}{' '}
                {durationQuarterHour(current.highDurationMinutes)}{' '}
                {uiText['selonLaCirculationEtLesAcces']}
              </small>
            </div>
          </div>
          <div className="moving-plan">
            <h4>{uiText['planningPREVISIONNEL']}</h4>
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
              <span>{uiText['finPrevue']}</span>
            </div>
            {current.endLate && (
              <span className="moving-plan-late">
                {uiText['finApres19HCommencerPlusTotOuRepartirSur2Jours']}
              </span>
            )}
          </div>
          {needsAlternatives &&
            (alternatives.length > 0 || current.totalMinutes > dayLimitMinutes) && (
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
                        : `${vehicleLabel(vehicle)} · ${estimate.trips} AR`}
                      , {estimate.crew} {uiText['manœuvres2']}
                    </span>
                    <strong
                      className={
                        estimate.handlingMinutes <= laborLimits.maxHandlingHours * 60
                          ? 'success'
                          : ''
                      }
                    >
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
                        {uiText['appliquer']}
                      </button>
                    )}
                  </div>
                ))}
                {current.totalMinutes > dayLimitMinutes && (
                  <div className="moving-alternative">
                    <span>
                      {uiText['sur2']}
                      {Math.max(2, current.minimumDays)} {uiText['joursAvecLe']}{' '}
                      {selectedVehicle && vehicleLabel(selectedVehicle)}{' '}
                      {uiText['chargementLe1erJourFinLeLendemain']}
                    </span>
                    <strong>
                      ≈ {formatDuration(current.totalMinutes)} {uiText['auTotal']}
                    </strong>
                  </div>
                )}
              </div>
            )}
          <details className="moving-method">
            <summary>{uiText['methodeDeCalcul']}</summary>
            <div>
              <p>
                {uiText['cadenceParManœuvreEtParHeureAuRezDeChausseeCartonsEtSa']}{' '}
                {(laborLimits.cubicMetersPerHourPerMover * 1.4).toFixed(1).replace('.', ',')}{' '}
                {uiText['m³Meubles']}
                {laborLimits.cubicMetersPerHourPerMover.toFixed(1).replace('.', ',')}{' '}
                {uiText['m³CanapesEtMatelas']}{' '}
                {(laborLimits.cubicMetersPerHourPerMover * 1.2).toFixed(1).replace('.', ',')}{' '}
                {uiText['m³ObjetsLourdsFrigoArmoireMonteeBuffet']}{' '}
                {(laborLimits.cubicMetersPerHourPerMover * 0.72).toFixed(1).replace('.', ',')}{' '}
                {uiText['m³Dechargement20PlusRapide']}
              </p>
              <p>{uiText['etagesSansAscenseurDe10CartonsA25ObjetsLourdsParEtage4']}</p>
              <p>{uiText['accesCamionDifficilePortageLong20ObjetsFragiles10']}</p>
              <p>
                {uiText['equipe2ManœuvresMinimum3SiUnObjetLourdPasse2EtagesOuPl']}
                {laborLimits.maxMoversPerVehicle} {uiText['parVehicule']}
              </p>
              <p>{uiText['menuisierDemontageAuDepartEtRemontageALArriveeEnParall']}</p>
              <p>{uiText['emballage045HParM³DeCartonsEtPetitsObjets01HParM³DeMeu']}</p>
              <p>{uiText['trajetItineraireMajorePourUnUtilitaireChargeEtLaCircul']}</p>
              <p>
                {uiText['tempsFixes15MinDArriveeEtDeProtection10MinDeVerificati']}
                {laborLimits.pauseMinutes} {uiText['minSiLaJourneeDepasse5H']}
              </p>
              <p>
                {uiText['plafondsChargementDechargement']}
                {laborLimits.maxHandlingHours} {uiText['hJournee']} {laborLimits.maxDayHours}{' '}
                {uiText['hDebutA']}
                {laborLimits.defaultStartHour}{' '}
                {uiText['hSiLeCreneauNEstPasPreciseModifiablesDansParametres']}
              </p>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
