import { ExternalLink } from 'lucide-react';
import { money } from '../domain/format';
import { useApp } from '../application/context';
import type { TollPoint } from '../domain/model';
import { agerouteTariffUrl, secaaTariffUrl } from '../domain/toll-rates';
import { tollLine, type TollDirection } from '../domain/toll-selection';
import { tollPrice } from '../domain/toll-prices';

type TollExtraLine = { id: string; label: string; quantity: number; unitPrice: number };

export function TollRateSelector({
  lines,
  onToggle,
  vehicleId,
}: {
  lines: TollExtraLine[];
  onToggle: (line: TollExtraLine, selected: boolean) => void;
  vehicleId?: string;
}) {
  const { tollPoints, draft, catalogue } = useApp();
  const selectedVehicleId = vehicleId ?? draft.vehicleId;
  const vehicle = catalogue?.vehicles.find((item) => item.id === selectedVehicleId);
  const selectedTollLines = lines.filter((line) =>
    tollPoints.some((point) => point.id === line.id),
  );
  const selectedTollTotal = selectedTollLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );

  function renderRows(stations: TollPoint[]) {
    return stations.map((station) => {
      const selectedLine = lines.find((line) => line.id === station.id);
      const selected = Boolean(selectedLine);
      const unitPrice = selectedLine?.unitPrice ?? tollPrice(station, selectedVehicleId);
      const direction: TollDirection = selectedLine?.label.endsWith(' · Aller simple')
        ? 'one-way'
        : 'round-trip';
      const multiplier = direction === 'round-trip' ? 2 : 1;
      const journeyCount = selectedLine
        ? Math.max(1, Math.ceil(selectedLine.quantity / multiplier))
        : 1;
      const createLine = (nextDirection: TollDirection, nextCount: number): TollExtraLine =>
        tollLine(station, selectedVehicleId, nextDirection, nextCount, selectedLine?.unitPrice);
      return (
        <div className="toll-rate-row" key={station.id}>
          <label className="toll-rate-station">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) =>
                onToggle(createLine(direction, journeyCount), event.target.checked)
              }
            />
            <span>{station.name}</span>
          </label>
          <strong className="toll-rate-price">
            {money(unitPrice)} <small>/ passage</small>
          </strong>
          {selected && selectedLine && (
            <div className="toll-rate-controls">
              <input
                type="number"
                min={1}
                max={direction === 'round-trip' ? 50 : 100}
                step={1}
                value={journeyCount}
                aria-label={`Nombre de trajets pour ${station.name}`}
                onChange={(event) => {
                  const max = direction === 'round-trip' ? 50 : 100;
                  const nextCount = Math.min(max, Math.max(1, Number(event.target.value) || 1));
                  onToggle(createLine(direction, nextCount), true);
                }}
              />
              <select
                value={direction}
                aria-label={`Type de trajet pour ${station.name}`}
                onChange={(event) => {
                  const nextDirection = event.target.value as TollDirection;
                  const max = nextDirection === 'round-trip' ? 50 : 100;
                  onToggle(createLine(nextDirection, Math.min(max, journeyCount)), true);
                }}
              >
                <option value="one-way">Aller simple</option>
                <option value="round-trip">Aller-retour</option>
              </select>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <details className="toll-rate-selector">
      <summary aria-label="Ouvrir la sélection des péages">
        <span>
          <strong>Gares de péage</strong>
          <small>
            {selectedTollLines.length} sélectionnée{selectedTollLines.length === 1 ? '' : 's'} ·{' '}
            {money(selectedTollTotal)}
          </small>
        </span>
        <span className="toll-dropdown-hint">Choisir les gares</span>
      </summary>
      <div className="toll-rate-content" aria-labelledby="toll-rate-title">
        <div className="section-heading">
          <div>
            <h4 id="toll-rate-title">Tarifs enregistrés · {vehicle?.name ?? 'véhicule'}</h4>
            <p className="caption">
              Choisissez le nombre de trajets et le sens pour chaque gare. Un aller-retour compte
              deux passages.
            </p>
          </div>
          <div className="toll-source-links">
            <a href={secaaTariffUrl} target="_blank" rel="noreferrer">
              SECAA <ExternalLink size={14} />
            </a>
            <a href={agerouteTariffUrl} target="_blank" rel="noreferrer">
              AGEROUTE <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <div className="toll-rate-list">
          {tollPoints.length === 0 && <p className="caption">Aucun point de péage configuré.</p>}
          {Array.from(new Set(tollPoints.map((point) => point.region || 'Autres régions'))).map(
            (region) => (
              <section className="toll-region" key={region}>
                <h5>
                  {region} ·{' '}
                  {
                    tollPoints.filter((point) => (point.region || 'Autres régions') === region)
                      .length
                  }{' '}
                  point(s)
                </h5>
                {Array.from(
                  new Set(
                    tollPoints
                      .filter((point) => (point.region || 'Autres régions') === region)
                      .map((point) => point.axis || 'Autre route'),
                  ),
                ).map((axis) => (
                  <div className="toll-axis" key={axis}>
                    <h6>{axis}</h6>
                    {renderRows(
                      tollPoints.filter(
                        (point) =>
                          (point.region || 'Autres régions') === region &&
                          (point.axis || 'Autre route') === axis,
                      ),
                    )}
                  </div>
                ))}
              </section>
            ),
          )}
        </div>
        <p className="caption">Total des péages sélectionnés : {money(selectedTollTotal)}</p>
      </div>
    </details>
  );
}
