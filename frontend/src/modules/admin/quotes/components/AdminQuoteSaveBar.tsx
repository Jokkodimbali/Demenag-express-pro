import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import type { MovingEstimate } from '../../../moving/domain/estimate/moving-estimate';
import type { Quote } from '../../../shared/domain/model';
import { grossMarginIndicatorColor } from '../application/services/gross-margin-indicator-color';

type Props = {
  quoteKind: Quote['kind'];
  total: number | null;
  grossMargin: number | null;
  distanceKm: number | null | undefined;
  companyToDepartureDistanceKm: number | null | undefined;
  companyToDepartureDistanceBusy: boolean;
  companyToDepartureDistanceError: string;
  grossMarginAboveThresholdColor: string;
  grossMarginBelowThresholdColor: string;
  trips: number;
  crewCount: number | null;
  movingEstimate: Pick<MovingEstimate, 'crew' | 'endTime'> | null;
  driverRental: boolean;
  submitting: boolean;
  disabled: boolean;
  editingReservation: boolean;
};

export function AdminQuoteSaveBar({
  quoteKind,
  total,
  grossMargin,
  distanceKm,
  companyToDepartureDistanceKm,
  companyToDepartureDistanceBusy,
  companyToDepartureDistanceError,
  grossMarginAboveThresholdColor,
  grossMarginBelowThresholdColor,
  trips,
  crewCount,
  movingEstimate,
  driverRental,
  submitting,
  disabled,
  editingReservation,
}: Props) {
  return (
    <div className="admin-quote-save-bar" aria-live="polite">
      <section className="admin-quote-save-bar-charges" aria-label="Marge brute estimée">
        <small>Marge brute estimée</small>
        <strong
          className="admin-quote-save-bar-margin"
          style={{
            color: grossMarginIndicatorColor(
              grossMargin,
              grossMarginAboveThresholdColor,
              grossMarginBelowThresholdColor,
            ),
          }}
        >
          {grossMargin == null ? '—' : money(grossMargin)}
        </strong>
      </section>
      <div className="admin-quote-save-bar-distances">
        <small>Distance A → B</small>
        <strong>
          {distanceKm == null
            ? '—'
            : `${distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`}
        </strong>
        <small>Locaux → départ client (A)</small>
        <strong title={companyToDepartureDistanceError || undefined}>
          {companyToDepartureDistanceBusy
            ? 'Calcul…'
            : companyToDepartureDistanceError
              ? 'Indisponible'
              : companyToDepartureDistanceKm == null
                ? '—'
                : `${companyToDepartureDistanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`}
        </strong>
      </div>
      <div>
        <small>{quoteKind === 'final' ? visibleUiText.text207 : visibleUiText.text208}</small>
        <strong>{total == null ? visibleUiText.text209 : money(total)}</strong>
      </div>
      <div>
        <small>{visibleUiText.text205}</small>
        <strong>{trips}</strong>
      </div>
      {crewCount !== null && crewCount > 0 && (
        <div>
          <small>{driverRental ? visibleUiText.text210 : visibleUiText.text211}</small>
          <strong>{crewCount}</strong>
        </div>
      )}
      {movingEstimate && (
        <>
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
