import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import type { MovingEstimate } from '../../../moving/domain/estimate/moving-estimate';
import type { Quote } from '../../../shared/domain/model';

type Props = {
  quoteKind: Quote['kind'];
  total: number | null;
  charges: readonly {
    label: string;
    quantity: number;
    unitPrice: number;
    total: number;
    includedInManoeuvres?: boolean;
  }[];
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
  charges,
  trips,
  movingEstimate,
  driverRental,
  submitting,
  disabled,
  editingReservation,
}: Props) {
  const chargesTotal = charges.reduce(
    (sum, charge) => sum + (charge.includedInManoeuvres ? 0 : charge.total),
    0,
  );
  const chargeQuoteDifference = total == null ? null : chargesTotal - total;

  return (
    <div className="admin-quote-save-bar" aria-live="polite">
      <section
        className="admin-quote-save-bar-charges"
        aria-label="Écart entre les charges et le devis"
      >
        <small>Total des charges − total du devis</small>
        <strong>
          {chargeQuoteDifference == null ? visibleUiText.text209 : money(chargeQuoteDifference)}
        </strong>
      </section>
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
      <span className="admin-quote-save-bar-break" aria-hidden="true" />
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
