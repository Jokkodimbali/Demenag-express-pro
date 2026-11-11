import { uiText } from '../../shared/content/reference-ui-text';
import type { BookingViewState } from '../application/contracts/booking-view';
import { messages } from '../../shared/content/fr';
import type { BookingField, BookingFieldErrors } from '../domain/booking-validation';
import { sanitizePhoneInput } from '../../shared/domain/phone-number';

export function CustomerDetails({
  draft,
  setDraft,
  recognition,
  recognizingClient,
  fieldErrors = {},
  clearFieldError = () => {},
  referenceMode = false,
}: Pick<BookingViewState, 'draft' | 'setDraft'> & {
  recognition: { phone: string; name: string; bookingCount: number } | null;
  recognizingClient: boolean;
  fieldErrors?: BookingFieldErrors;
  clearFieldError?: (field: BookingField) => void;
  referenceMode?: boolean;
}) {
  return (
    <section className="panel">
      {!referenceMode && (
        <div className="step-title">
          <span>{messages.text4}</span>
          <div>
            <h3>{messages.vosCoordonnees}</h3>
          </div>
        </div>
      )}
      <div className="field-pair">
        <div>
          {!referenceMode && <label htmlFor="customer-name">{messages.nom}</label>}
          <input
            id="customer-name"
            name="customer-name"
            autoComplete="name"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.customerName)}
            aria-describedby={fieldErrors.customerName ? 'customer-name-error' : undefined}
            placeholder={referenceMode ? 'Nom du client' : undefined}
            aria-label={referenceMode ? 'Nom du client' : undefined}
            value={draft.customerName}
            onChange={(event) => {
              clearFieldError('customerName');
              setDraft((value) => ({ ...value, customerName: event.target.value }));
            }}
          />
          {fieldErrors.customerName && (
            <p className="booking-validation-error" id="customer-name-error" role="alert">
              {fieldErrors.customerName}
            </p>
          )}
        </div>
        <div>
          {!referenceMode && <label htmlFor="customer-phone">{messages.telephone}</label>}
          <input
            id="customer-phone"
            name="customer-phone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            inputMode="tel"
            aria-invalid={Boolean(fieldErrors.customerPhone)}
            aria-describedby={fieldErrors.customerPhone ? 'customer-phone-error' : undefined}
            placeholder={referenceMode ? 'Téléphone' : '+221 77 123 45 67 ou +33 6 12 34 56 78'}
            required
            value={draft.customerPhone}
            onChange={(event) => {
              clearFieldError('customerPhone');
              setDraft((value) => ({
                ...value,
                customerPhone: sanitizePhoneInput(event.target.value),
              }));
            }}
          />
          {fieldErrors.customerPhone && (
            <p className="booking-validation-error" id="customer-phone-error" role="alert">
              {fieldErrors.customerPhone}
            </p>
          )}
          {!referenceMode && recognizingClient ? (
            <p className="muted" role="status">
              {uiText['verificationDuNumero']}
            </p>
          ) : !referenceMode && recognition ? (
            <p className="client-recognition" role="status">
              {uiText['clientDejaConnu']}
              <strong>{recognition.name}</strong> · {recognition.bookingCount}{' '}
              {uiText['reservationSPrecedenteS']}
            </p>
          ) : null}
        </div>
      </div>
      {!referenceMode && !draft.customerName && !draft.customerPhone && (
        <p className="muted">{messages.connectezVousALEnvoiPourEnregistrerVos}</p>
      )}
      {!referenceMode && (
        <label htmlFor="booking-notes">
          {messages.precisionsUtiles}
          <span className="muted">{messages.facultatif}</span>
        </label>
      )}
      <textarea
        id="booking-notes"
        aria-label={referenceMode ? 'Remarque libre' : undefined}
        rows={3}
        maxLength={2000}
        placeholder={
          referenceMode
            ? "Remarque libre (ajoutée sous l'inventaire de la fiche d'appel)"
            : messages.etageAscenseurAccesAuCamionObjetsFragiles
        }
        value={draft.notes}
        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
      />
    </section>
  );
}
