import { useState } from 'react';
import { quoteCalculationRules, visibleUiText } from '../content/visible-ui-text';
import { money } from '../application/presentation/format';
import type { MovingEstimate } from '../domain/moving-estimate';
import type { Settings, Vehicle } from '../domain/model';

type Line = { label: string; value: string; detail: string; final?: boolean };
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;

export function AdminQuoteCalculationDetails({
  estimate,
  inventoryCount,
  vehicle,
  trips,
  total,
  lineCount,
  discount,
  hasTolls,
  manual,
  settings,
}: {
  estimate: MovingEstimate | null;
  inventoryCount: number;
  vehicle: Vehicle;
  trips: number;
  total: number | null;
  lineCount: number;
  discount: number;
  hasTolls: boolean;
  manual: boolean;
  settings?: Settings;
}) {
  const [open, setOpen] = useState(false);
  if (!estimate || estimate.volume <= 0) return null;
  const rows: Line[] = [
    {
      label: visibleUiText.calculationRows[0],
      value: `${inventoryCount} objets`,
      detail: `${estimate.volume.toFixed(1).replace('.', ',')} m³ · capacité ${vehicle.volume} m³`,
    },
    {
      label: visibleUiText.calculationRows[1],
      value: `${estimate.volume.toFixed(1).replace('.', ',')} m³`,
      detail: `Capacité utile du véhicule : ${estimate.capacity.toFixed(1).replace('.', ',')} m³`,
    },
    {
      label: visibleUiText.calculationRows[2],
      value: `${trips} AR`,
      detail: `${vehicle.shortName || vehicle.name} · ${estimate.capacity.toFixed(1).replace('.', ',')} m³ utiles · ${manual ? 'effectif réglé manuellement' : 'estimé selon le volume et la capacité'}`,
    },
    {
      label: visibleUiText.calculationRows[3],
      value: `≈ ${Math.round(estimate.totalWeightKg).toLocaleString('fr-FR')} kg`,
      detail: `Objet le plus lourd ≈ ${Math.round(estimate.maxItemWeightKg).toLocaleString('fr-FR')} kg`,
    },
    {
      label: visibleUiText.calculationRows[4],
      value: `${estimate.crew} manœuvres`,
      detail: `Conseil : ${estimate.recommendedCrew} · chargement et déchargement : ${duration(estimate.handlingMinutes)}`,
    },
    {
      label: visibleUiText.calculationRows[5],
      value: duration(estimate.handlingMinutes),
      detail: `Chargement ${duration(estimate.loadingMinutes)} · déchargement ${duration(estimate.unloadingMinutes)}`,
    },
    {
      label: visibleUiText.calculationRows[6],
      value: `${duration(estimate.travelLegMinutes)} par aller`,
      detail: `${estimate.travelMinutes} min de trajet total, circulation comprise`,
    },
    {
      label: visibleUiText.calculationRows[7],
      value: duration(estimate.totalMinutes),
      detail: `Fin prévue ${estimate.endTime}${estimate.heat ? ` · pauses chaleur ${estimate.heat.rest} min` : ''}`,
    },
    {
      label: visibleUiText.calculationRows[8],
      value: `${estimate.fatigueEffort.percentage} %`,
      detail: `Portage ${estimate.fatigueEffort.carrying} % · trajet ${estimate.fatigueEffort.travel} % · autres efforts ${estimate.fatigueEffort.other} %`,
    },
    {
      label: visibleUiText.calculationRows[9],
      value: total == null ? '—' : money(total),
      detail: `${lineCount} ligne${lineCount === 1 ? '' : 's'}${discount ? ` · remise ${money(discount)}` : ''}${hasTolls ? ' · péages à part' : ''}`,
      final: true,
    },
  ];
  return (
    <details
      className="admin-quote-calculation-details"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{visibleUiText.text240}</summary>
      <div className="admin-quote-calculation-grid">
        {rows.map((row, index) => (
          <div className={row.final ? 'final' : ''} key={row.label}>
            <span>{index + 1}</span>
            <div>
              <div>
                <small>{row.label}</small>
                <strong>{row.value}</strong>
              </div>
              <p>{row.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <strong className="admin-quote-calculation-rules-title">{visibleUiText.text241}</strong>
      <ul>
        {quoteCalculationRules(settings).map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </details>
  );
}
