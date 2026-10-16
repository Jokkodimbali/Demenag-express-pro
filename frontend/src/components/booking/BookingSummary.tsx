import { ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import type { BookingFormState } from '../../application/useBookingForm';
import { money } from '../../domain/format';
import type { Catalogue, Vehicle } from '../../domain/model';

export function BookingSummary({
  catalogue,
  selected,
  draft,
  price,
  tiers,
  estimating,
  estimateError,
  submitError,
  submitting,
  user,
}: Pick<
  BookingFormState,
  | 'catalogue'
  | 'selected'
  | 'draft'
  | 'price'
  | 'tiers'
  | 'estimating'
  | 'estimateError'
  | 'submitError'
  | 'submitting'
  | 'user'
> & { catalogue: Catalogue; selected: Vehicle }) {
  return (
    <aside className="summary">
      <div className="summary-top">
        <span className="eyebrow">PROVISOIRE</span>
        <span className="summary-icon">
          <Truck size={23} />
        </span>
      </div>
      <h3>ESTIMATION</h3>
      <p className="muted">Prix estimé pour votre déménagement.</p>
      <div className="summary-vehicle">
        <img src={selected.image} alt="" />
        <div>
          <strong>{selected.name}</strong>
          <span>{selected.volume} · 1 aller-retour</span>
        </div>
      </div>
      <div className="summary-trip">
        <div>
          <span className="point-badge from">A</span>
          <span>{draft.fromAddress || 'Votre adresse de départ'}</span>
        </div>
        <div>
          <span className="point-badge to">B</span>
          <span>{draft.toAddress || 'Votre adresse d’arrivée'}</span>
        </div>
      </div>
      {draft.route && (
        <p className="distance-label">
          {draft.route.distanceKm} km · {price ? tiers[price.tier] : 'Distance routière'}
        </p>
      )}
      <div className="price-lines">
        {price?.lines.map((line, i) => (
          <div key={i}>
            <span>
              {line.label}
              {line.quantity > 1 ? ` × ${line.quantity}` : ''}
            </span>
            <strong>{money(line.total)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-total">
        <span>ESTIMATION PROVISOIRE</span>
        <strong aria-live="polite">
          {estimating ? 'Calcul…' : price ? money(price.total) : 'À calculer'}
        </strong>
        <p>Base d’un aller-retour. Le devis final dépend du nombre réel de trajets effectués.</p>
      </div>
      {estimateError && (
        <p className="alert error" role="alert">
          {estimateError}
        </p>
      )}
      {submitError && (
        <p className="alert error" role="alert">
          {submitError}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={
          submitting ||
          estimating ||
          !price ||
          selected.active === false ||
          catalogue.settings.bookingsEnabled === false
        }
      >
        {submitting ? 'Enregistrement…' : user ? 'Envoyer ma demande' : 'Me connecter et réserver'}
        <ArrowRight size={18} />
      </button>
      <p className="summary-note">
        <ShieldCheck size={14} />{' '}
        {user
          ? `Réservation au nom de ${user.name}`
          : 'Votre sélection est conservée pendant la connexion.'}
      </p>
      <p className="caption">
        La disponibilité est confirmée par notre équipe. Aucun paiement demandé à cette étape.
      </p>
    </aside>
  );
}
