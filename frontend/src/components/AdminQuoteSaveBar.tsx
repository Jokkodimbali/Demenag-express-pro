import { visibleUiText } from '../content/visible-ui-text';
import { money } from '../application/presentation/format';
import type { MovingEstimate } from '../domain/moving-estimate';
import type { Quote } from '../domain/model';

type Props = {
  quoteKind: Quote['kind'];
  total: number | null;
  trips: number;
  movingEstimate: Pick<MovingEstimate, 'crew' | 'endTime'> | null;
  driverRental: boolean;
  submitting: boolean;
  disabled: boolean;
  editingReservation: boolean;
};

export function AdminQuoteSaveBar({
  quoteKind,
  total,
  trips,
  movingEstimate,
  driverRental,
  submitting,
  disabled,
  editingReservation,
}: Props) {
  return (
    <div className="admin-quote-save-bar" aria-live="polite">
      <div>
        <small>{quoteKind === 'final' ? visibleUiText.text207 : visibleUiText.text208}</small>
        <strong>{total == null ? visibleUiText.text209 : money(total)}</strong>
      </div>
      <div>
        <small>{visibleUiText.text205}</small>
        <strong>{trips}</strong>
      </div>
      {movingEstimate && (
        <>
          <div>
            <small>{driverRental ? visibleUiText.text210 : visibleUiText.text211}</small>
            <strong>{movingEstimate.crew}</strong>
          </div>
          <div>
            <small>{visibleUiText.text206}</small>
            <strong>{movingEstimate.endTime}</strong>
          </div>
        </>
      )}
      <button
        type="submit"
        form="admin-quote-form"
        className="button primary admin-quote-submit admin-quote-save-bar-submit"
        disabled={disabled}
      >
        {submitting
          ? 'Enregistrement…'
          : editingReservation
            ? 'Enregistrer les modifications'
            : 'Enregistrer'}
      </button>
    </div>
  );
}
