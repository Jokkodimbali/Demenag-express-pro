import { ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';
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
  BookingViewState,
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
        <span className="eyebrow">{messages.provisoire2}</span>
        <span className="summary-icon">
          <Truck size={23} />
        </span>
      </div>
      <h3>{messages.estimation}</h3>
      <p className="muted">{messages.prixEstimePourVotreDemenagement}</p>
      <div className="summary-vehicle">
        <img src={selected.image} alt={messages.text} />
        <div>
          <strong>{selected.name}</strong>
          <span>
            {selected.volume}
            {messages.text1AllerRetour}
          </span>
        </div>
      </div>
      <div className="summary-trip">
        <div>
          <span className="point-badge from">{messages.a}</span>
          <span>{draft.fromAddress || messages.votreAdresseDeDepart}</span>
        </div>
        <div>
          <span className="point-badge to">{messages.b}</span>
          <span>{draft.toAddress || messages.votreAdresseDArrivee}</span>
        </div>
      </div>
      {draft.route && (
        <p className="distance-label">
          {draft.route.distanceKm}
          {messages.km2}
          {price ? tiers[price.tier] : messages.distanceRoutiere}
        </p>
      )}
      <div className="price-lines">
        {price?.lines.map((line, i) => (
          <div key={i}>
            <span>
              {line.label}
              {line.quantity > 1 ? messages.quantityMultiplier(line.quantity) : ''}
            </span>
            <strong>{money(line.total)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-total">
        <span>{messages.estimationProvisoire}</span>
        <strong aria-live="polite">
          {estimating ? messages.calcul : price ? money(price.total) : messages.aCalculer}
        </strong>
        <p>{messages.baseDUnAllerRetourLeDevisFinal}</p>
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
        {submitting
          ? messages.enregistrement
          : user
            ? 'Envoyer ma demande'
            : messages.meConnecterEtReserver}
        <ArrowRight size={18} />
      </button>
      <p className="summary-note">
        <ShieldCheck size={14} />{' '}
        {user
          ? messages.reservationOwner(user.name)
          : messages.votreSelectionEstConserveePendantLaConnexion}
      </p>
      <p className="caption">{messages.laDisponibiliteEstConfirmeeParNotreEquipeAucun}</p>
    </aside>
  );
}
