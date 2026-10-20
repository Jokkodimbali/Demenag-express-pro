import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';

export function CustomerDetails({
  draft,
  setDraft,
  onPhoneBlur,
  recognition,
  recognizingClient,
}: Pick<BookingViewState, 'draft' | 'setDraft'> & {
  onPhoneBlur: (phone: string) => void;
  recognition: { phone: string; name: string; bookingCount: number } | null;
  recognizingClient: boolean;
}) {
  return (
    <section className="panel">
      <div className="step-title">
        <span>{messages.text4}</span>
        <div>
          <h3>{messages.vosCoordonnees}</h3>
        </div>
      </div>
      <div className="field-pair">
        <div>
          <label htmlFor="customer-name">{messages.nom}</label>
          <input
            id="customer-name"
            name="customer-name"
            autoComplete="name"
            maxLength={100}
            required
            value={draft.customerName}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerName: event.target.value }))
            }
          />
        </div>
        <div>
          <label htmlFor="customer-phone">{messages.telephone}</label>
          <input
            id="customer-phone"
            name="customer-phone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            required
            value={draft.customerPhone}
            onBlur={(event) => onPhoneBlur(event.currentTarget.value)}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerPhone: event.target.value }))
            }
          />
          {recognizingClient ? (
            <p className="muted" role="status">
              Vérification du numéro…
            </p>
          ) : recognition ? (
            <p className="client-recognition" role="status">
              Client déjà connu : <strong>{recognition.name}</strong> · {recognition.bookingCount}{' '}
              réservation(s) précédente(s).
            </p>
          ) : null}
        </div>
      </div>
      {!draft.customerName && !draft.customerPhone && (
        <p className="muted">{messages.connectezVousALEnvoiPourEnregistrerVos}</p>
      )}
      <label htmlFor="booking-notes">
        {messages.precisionsUtiles}
        <span className="muted">{messages.facultatif}</span>
      </label>
      <textarea
        id="booking-notes"
        rows={3}
        maxLength={2000}
        placeholder={messages.etageAscenseurAccesAuCamionObjetsFragiles}
        value={draft.notes}
        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
      />
    </section>
  );
}
