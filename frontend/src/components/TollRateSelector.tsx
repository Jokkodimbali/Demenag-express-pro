import { uiText } from '../content/reference-ui-text';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { money } from '../domain/format';
import { useApp } from '../application/context';
import type { TollPoint } from '../domain/model';
import { tollPrice } from '../domain/toll-prices';

type TollExtraLine = { id: string; label: string; quantity: number; unitPrice: number };

export function TollRateSelector({
  lines,
  onToggle,
  vehicleId,
  roundTrips = 1,
}: {
  lines: TollExtraLine[];
  onToggle: (line: TollExtraLine, selected: boolean) => void;
  vehicleId?: string;
  roundTrips?: number;
}) {
  const { tollPoints, draft, catalogue } = useApp();
  const selectedVehicleId = vehicleId ?? draft.vehicleId;
  const vehicle = catalogue?.vehicles.find((item) => item.id === selectedVehicleId);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const selectedCount = (points: TollPoint[]) =>
    points.filter((point) => lines.some((line) => line.id === point.id)).length;
  const selectedLabel = (points: TollPoint[]) => {
    const count = selectedCount(points);
    return count ? `${count} coché${count > 1 ? 's' : ''}` : '';
  };
  const groups = new Map<string, Map<string, TollPoint[]>>();
  for (const point of tollPoints) {
    const region = point.region || 'Sans région';
    const axis = point.axis || 'Autre route';
    const axes = groups.get(region) ?? new Map<string, TollPoint[]>();
    const points = axes.get(axis) ?? [];
    points.push(point);
    axes.set(axis, points);
    groups.set(region, axes);
  }

  function toggleGroup(key: string) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  function renderPoint(point: TollPoint) {
    const selectedLine = lines.find((line) => line.id === point.id);
    const selected = Boolean(selectedLine);
    const quantity = selectedLine?.quantity ?? 0;
    const unitPrice = tollPrice(point, selectedVehicleId);
    const vehicleLabel = vehicle?.shortName ?? vehicle?.name ?? 'Véhicule';
    const pointLabel = /^péage/i.test(point.name) ? point.name : `Péage · ${point.name}`;
    const line: TollExtraLine = {
      id: point.id,
      label: selectedLine?.label ?? `${pointLabel} (${vehicleLabel})`,
      quantity: selected ? quantity : Math.max(1, roundTrips) * 2,
      unitPrice,
    };
    const setQuantity = (next: number) =>
      onToggle({ ...line, quantity: Math.max(1, Math.min(99, next)) }, true);

    return (
      <div className={`toll-rate-row${selected ? ' is-selected' : ''}`} key={point.id}>
        <label className="toll-rate-station">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggle(line, event.target.checked)}
          />
          <span>
            <strong>{point.name}</strong>
            <small>
              {money(unitPrice)} {uiText['passage']}
              {vehicleLabel}
            </small>
          </span>
        </label>
        {selected && (
          <>
            <div className="toll-rate-controls" aria-label={`Passages pour ${point.name}`}>
              <button
                type="button"
                aria-label={`Retirer un passage à ${point.name}`}
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
              >
                −
              </button>
              <output aria-label={`${quantity} passages`}>{quantity}</output>
              <button
                type="button"
                aria-label={`Ajouter un passage à ${point.name}`}
                disabled={quantity >= 99}
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
            <strong className="toll-rate-subtotal">{money(quantity * unitPrice)}</strong>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="toll-rate-selector">
      <p className="toll-rate-instruction">{uiText['1AllerRetour2Passages']}</p>
      {tollPoints.length === 0 ? (
        <p className="caption">{uiText['aucunPeageEnregistreAjoutezLesDansLOngletPeages']}</p>
      ) : (
        <div className="toll-rate-list">
          {[...groups.entries()].map(([region, axes]) => {
            const regionPoints = [...axes.values()].flat();
            const regionKey = `r:${region}`;
            const regionOpen = Boolean(openGroups[regionKey]);
            return (
              <section className="toll-region" key={region}>
                <button
                  type="button"
                  className="toll-group-toggle toll-region-toggle"
                  aria-expanded={regionOpen}
                  onClick={() => toggleGroup(regionKey)}
                >
                  <span>
                    <ChevronDown size={16} aria-hidden="true" />
                    {region === 'Sans région' ? region : `Région de ${region}`}
                  </span>
                  <small>{selectedLabel(regionPoints)}</small>
                </button>
                {regionOpen && (
                  <div className="toll-region-axes">
                    {[...axes.entries()].map(([axis, points]) => {
                      const axisKey = `a:${region}|${axis}`;
                      const axisOpen = Boolean(openGroups[axisKey]);
                      return (
                        <section className="toll-axis" key={axis}>
                          <button
                            type="button"
                            className="toll-group-toggle toll-axis-toggle"
                            aria-expanded={axisOpen}
                            onClick={() => toggleGroup(axisKey)}
                          >
                            <span>
                              <ChevronDown size={14} aria-hidden="true" />
                              {axis}
                            </span>
                            <small>{selectedLabel(points)}</small>
                          </button>
                          {axisOpen && (
                            <div className="toll-axis-points">{points.map(renderPoint)}</div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
