import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';

export function CustomerDetails({
  user,
  draft,
  setDraft,
}: Pick<BookingViewState, 'user' | 'draft' | 'setDraft'>) {
  return (
    <section className="panel">
      <div className="step-title">
        <span>{messages.text4}</span>
        <div>
          <h3>{messages.vosCoordonnees}</h3>
        </div>
      </div>
      {user ? (
        <div className="field-pair">
          <div>
            <label htmlFor="customer-name">{messages.nom}</label>
            <input id="customer-name" readOnly value={user.name} />
          </div>
          <div>
            <label htmlFor="customer-phone">{messages.telephone}</label>
            <input id="customer-phone" readOnly value={user.phone} />
          </div>
        </div>
      ) : (
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
