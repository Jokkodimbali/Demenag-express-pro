import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import type { CheaperVehicle } from '../application/services/quote-vehicle-fit';

export function AdminQuoteCheaperVehicle({
  suggestion,
  onSelect,
}: {
  suggestion: CheaperVehicle | null;
  onSelect: (vehicleId: string, trips: number) => void;
}) {
  if (!suggestion) return null;
  return (
    <div className="admin-quote-cheaper-vehicle" role="status">
      <span>
        {visibleUiText.text221} {suggestion.vehicle.shortName || suggestion.vehicle.name} :{' '}
        {money(suggestion.total)} (− {money(suggestion.savings)}, {suggestion.trips}{' '}
        {visibleUiText.text230}
        {suggestion.trips > 1 ? 's' : ''})
      </span>
      <button type="button" onClick={() => onSelect(suggestion.vehicle.id, suggestion.trips)}>
        {visibleUiText.text222}
      </button>
    </div>
  );
}
