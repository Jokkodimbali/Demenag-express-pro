import { ExternalLink } from 'lucide-react';
import { money } from '../domain/format';
import { useApp } from '../application/context';
import type { TollPoint } from '../domain/model';
import { agerouteTariffUrl, secaaTariffUrl } from '../domain/toll-rates';

type TollExtraLine = { id: string; label: string; quantity: number; unitPrice: number };
type TollDirection = 'one-way' | 'round-trip';

const directionLabels: Record<TollDirection, string> = {
  'one-way': 'Aller simple',
  'round-trip': 'Aller-retour',
};

export function TollRateSelector({
  lines,
  onToggle,
}: {
  lines: TollExtraLine[];
  onToggle: (line: TollExtraLine, selected: boolean) => void;
}) {
  const { tollPoints } = useApp();
  const selectedTollTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  function renderRows(stations: TollPoint[]) {
    return stations.map((station) => {
      const stationLabel = `Péage ${station.operator} · ${station.name}`;
      const selectedLine = lines.find(
        (line) => line.label === stationLabel || line.label.startsWith(`${stationLabel} · `),
      );
      const selected = Boolean(selectedLine);
      const unitPrice = station.heavyPrice;
      const direction: TollDirection = selectedLine?.label.endsWith(' · Aller simple')
        ? 'one-way'
        : 'round-trip';
      const multiplier = direction === 'round-trip' ? 2 : 1;
      const journeyCount = selectedLine
        ? Math.max(1, Math.ceil(selectedLine.quantity / multiplier))
        : 1;
      const createLine = (nextDirection: TollDirection, nextCount: number): TollExtraLine => ({
        id: selectedLine?.id ?? crypto.randomUUID(),
        label: `${stationLabel} · ${directionLabels[nextDirection]}`,
        quantity: nextCount * (nextDirection === 'round-trip' ? 2 : 1),
        unitPrice,
      });
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
            {lines.length} sélectionnée{lines.length === 1 ? '' : 's'} · {money(selectedTollTotal)}
          </small>
        </span>
        <span className="toll-dropdown-hint">Choisir les gares</span>
      </summary>
      <div className="toll-rate-content" aria-labelledby="toll-rate-title">
        <div className="section-heading">
          <div>
            <h4 id="toll-rate-title">Tarifs officiels · poids lourd</h4>
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
          {Array.from(new Set(tollPoints.map((point) => point.operator))).map((operator) => (
            <div key={operator}>
              <h5>{operator}</h5>
              {renderRows(tollPoints.filter((point) => point.operator === operator))}
            </div>
          ))}
        </div>
        <p className="caption">Total des péages sélectionnés : {money(selectedTollTotal)}</p>
      </div>
    </details>
  );
}
