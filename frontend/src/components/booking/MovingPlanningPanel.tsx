import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Draft } from '../../application/booking-draft';
import {
  defaultMovingLaborPlanning,
  estimateMovingWork,
  formatDuration,
} from '../../domain/moving-estimate';
import type { MovingLaborPlanningSettings, Vehicle } from '../../domain/model';
import type { Inventory } from '../../domain/inventory';

export function MovingPlanningPanel({
  draft,
  setDraft,
  vehicles,
  selectedVehicleId,
  trips,
  maxTrips,
  onApply,
  laborPlanning,
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
  labourPriceEditor?: ReactNode;
  estimateInventory?: Inventory;
}) {
  const inventory = estimateInventory ?? draft.inventory;
  const dayLimitMinutes =
    (laborPlanning?.maxDayHours ?? defaultMovingLaborPlanning.maxDayHours) * 60;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const current = selectedVehicle
    ? estimateMovingWork(inventory, selectedVehicle, draft.route, {
        trips,
        crew: inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning,
      })
    : null;
  const comparisons = vehicles
    .filter((vehicle) => vehicle.active !== false)
    .map((vehicle) => ({
      vehicle,
      estimate: estimateMovingWork(inventory, vehicle, draft.route, {
        startTime: draft.timeSlot,
        laborPlanning,
      }),
    }));
  const volume = comparisons[0]?.estimate.volume ?? 0;

  return (
    <section className="moving-planning-panel" aria-label="Estimation du déménagement">
      <div className="moving-estimate-card">
        <div className="moving-estimate-card-head">
          <h3>ESTIMATION DES ALLERS-RETOURS</h3>
          <strong>Volume ≈ {volume.toFixed(1).replace('.', ',')} m³</strong>
        </div>
        <p className="moving-estimate-volume-detail">
          Estimation calculée à partir des tailles, formats, étages, options et effets annexes de la
          fiche d’appel. Chargement conseillé à{' '}
          {Math.round((comparisons[0]?.estimate.fillRate ?? 0.85) * 100)} % du volume utile.
        </p>
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
                    <strong>{vehicle.name}</strong>
                    <span>{estimate.capacity} m³</span>
                  </div>
                  <strong className="moving-vehicle-trip-count">
                    {estimate.trips || '—'}{' '}
                    {estimate.trips ? (estimate.trips > 1 ? 'allers-retours' : 'aller-retour') : ''}
                  </strong>
                  <span className="moving-vehicle-fill">
                    {Math.round(
                      (estimate.volume / (estimate.capacity * estimate.trips || 1)) * 100,
                    )}{' '}
                    % de remplissage
                  </span>
                  {estimate.trips > 1 &&
                    (estimate.volume - (estimate.trips - 1) * estimate.capacity * estimate.fillRate) /
                      (estimate.capacity * estimate.fillRate) <
                      0.2 && (
                      <span className="moving-vehicle-fill">
                        Dernier voyage : ≈{' '}
                        {Math.round(
                          ((estimate.volume -
                            (estimate.trips - 1) * estimate.capacity * estimate.fillRate) /
                            (estimate.capacity * estimate.fillRate)) *
                            100,
                        )}
                        % · peut tenir en {estimate.trips - 1} si chargé serré
                      </span>
                    )}
                  {estimate.vehicleWarnings.map((warning) => (
                    <span className="moving-vehicle-warning" key={warning} role="status">
                      ⚠ Objet hors gabarit : {warning}
                    </span>
                  ))}
                  <span className="moving-vehicle-current">
                    {selected ? 'Véhicule du devis' : ' '}
                  </span>
                  <button
                    type="button"
                    className={selected ? 'button secondary small' : 'button primary small'}
                    disabled={!estimate.trips || estimate.trips > maxTrips}
                    onClick={() => onApply(vehicle.id, estimate.trips)}
                  >
                    {selected && estimate.trips === trips
                      ? '✓ Appliqué'
                      : `Appliquer ${estimate.trips} aller-retour${estimate.trips > 1 ? 's' : ''}`}
                  </button>
                </article>
              );
            })}
          </div>
        )}
        <p className="moving-estimate-method-note">
          Le calcul tient compte du format de chaque objet, du démontage, du volume du logement et
          des étages. Les estimations restent à confirmer selon les accès et le chargement réel.
        </p>
      </div>

      {current && volume > 0 && (
        <div className="moving-labor-card">
          <header className="moving-labor-heading">
            <h3>MAIN-D’ŒUVRE ET DURÉE</h3>
            <strong className={current.totalMinutes > dayLimitMinutes ? 'warning' : 'success'}>
              {current.totalMinutes > dayLimitMinutes
                ? `À organiser · ${formatDuration(current.totalMinutes)}`
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
                {draft.inventory.crew ? 'Ajustement manuel' : 'Calcul automatique'} · recommandé :{' '}
                {current.recommendedCrew} · chargement et déchargement ≈{' '}
                {formatDuration(current.loadingMinutes + current.unloadingMinutes)}
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
                <small>Démontage et remontage en parallèle des manœuvres</small>
              </div>
            )}
            {current.packingMinutes > 0 && (
              <div>
                <span>Emballage</span>
                <strong>≈ {formatDuration(current.packingMinutes)}</strong>
                <small>
                  {current.packingMinutes > 90
                    ? 'À prévoir la veille'
                    : 'À faire avant le chargement'}
                </small>
              </div>
            )}
            <div>
              <span>Chargement</span>
              <strong>≈ {formatDuration(current.loadingMinutes)}</strong>
              <small>
                {draft.inventory.fromFloor
                  ? `Départ : étage ${draft.inventory.fromFloor}`
                  : 'Départ : RDC'}
              </small>
            </div>
            <div>
              <span>Déchargement</span>
              <strong>≈ {formatDuration(current.unloadingMinutes)}</strong>
              <small>
                {draft.inventory.toFloor
                  ? `Arrivée : étage ${draft.inventory.toFloor}`
                  : 'Arrivée : RDC'}
              </small>
            </div>
            <div>
              <span>Trajets</span>
              <strong>≈ {formatDuration(current.travelMinutes)}</strong>
              <small>
                {current.plannedTrips} aller-retour{current.plannedTrips > 1 ? 's' : ''} au devis
              </small>
            </div>
            <div>
              <span>Durée totale</span>
              <strong>≈ {formatDuration(current.totalMinutes)}</strong>
              <small>
                Entre {formatDuration(current.lowDurationMinutes)} et{' '}
                {formatDuration(current.highDurationMinutes)} selon circulation et accès
              </small>
            </div>
          </div>
          {!!current.warnings.length && (
            <ul className="moving-labor-warnings">
              {current.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="moving-plan">
            <h4>PLANNING PRÉVISIONNEL</h4>
            {current.planning.map((step, index) => (
              <div className="moving-plan-row" key={`${step.title}-${index}`}>
                <strong>{step.time}</strong>
                <div>
                  <span>{step.title}</span>
                  <small>{step.detail}</small>
                </div>
                <span>≈ {formatDuration(step.minutes)}</span>
              </div>
            ))}
            <div className="moving-plan-end">
              <strong>{current.endTime}</strong>
              <span>Fin prévue</span>
            </div>
          </div>
          <details className="moving-method">
            <summary>Méthode de calcul</summary>
            <p>
              Cadences par catégorie d’objets, étage et ascenseur ; démontage estimé en parallèle ;
              emballage selon l’option ou la réponse du client ; trajets chargés et retours à vide
              selon la distance, la durée calculée sur la carte et le véhicule. La pause configurée
              dans les paramètres est ajoutée au-delà de 5 heures de travail.
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
