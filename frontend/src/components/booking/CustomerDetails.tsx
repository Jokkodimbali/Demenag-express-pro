import type { BookingFormState } from '../../application/useBookingForm';

export function CustomerDetails({
  user,
  draft,
  setDraft,
}: Pick<BookingFormState, 'user' | 'draft' | 'setDraft'>) {
  return (
    <section className="panel">
      <div className="step-title">
        <span>4 ·</span>
        <div>
          <h3>VOS COORDONNÉES</h3>
        </div>
      </div>
      {user ? (
        <div className="field-pair">
          <div>
            <label htmlFor="customer-name">Nom</label>
            <input id="customer-name" readOnly value={user.name} />
          </div>
          <div>
            <label htmlFor="customer-phone">Téléphone</label>
            <input id="customer-phone" readOnly value={user.phone} />
          </div>
        </div>
      ) : (
        <p className="muted">
          Connectez-vous à l’envoi pour enregistrer vos coordonnées et suivre votre réservation.
        </p>
      )}
      <label htmlFor="booking-notes">
        Précisions utiles <span className="muted">(facultatif)</span>
      </label>
      <textarea
        id="booking-notes"
        rows={3}
        maxLength={2000}
        placeholder="Étage, ascenseur, accès au camion, objets fragiles…"
        value={draft.notes}
        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
      />
    </section>
  );
}
