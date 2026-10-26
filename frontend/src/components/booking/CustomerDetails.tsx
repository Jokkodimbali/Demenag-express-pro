import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';

export function CustomerDetails({
  draft,
  setDraft,
  recognition,
  recognizingClient,
  referenceMode = false,
}: Pick<BookingViewState, 'draft' | 'setDraft'> & {
  recognition: { phone: string; name: string; bookingCount: number } | null;
  recognizingClient: boolean;
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
            required
            placeholder={referenceMode ? 'Nom du client' : undefined}
            aria-label={referenceMode ? 'Nom du client' : undefined}
            value={draft.customerName}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerName: event.target.value }))
            }
          />
        </div>
        <div>
          {!referenceMode && <label htmlFor="customer-phone">{messages.telephone}</label>}
          <input
            id="customer-phone"
            name="customer-phone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            placeholder={referenceMode ? 'Téléphone' : undefined}
            required
            value={draft.customerPhone}
            onChange={(event) =>
              setDraft((value) => ({ ...value, customerPhone: event.target.value }))
            }
          />
          {!referenceMode && recognizingClient ? (
            <p className="muted" role="status">
              Vérification du numéro…
            </p>
          ) : !referenceMode && recognition ? (
            <p className="client-recognition" role="status">
              Client déjà connu : <strong>{recognition.name}</strong> · {recognition.bookingCount}{' '}
              réservation(s) précédente(s).
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
