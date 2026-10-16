import { Check } from 'lucide-react';
import type { BookingFormState } from '../../application/useBookingForm';
import { money } from '../../domain/format';
import type { Catalogue, Vehicle } from '../../domain/model';

export function VehicleSelector({
  catalogue,
  selected,
  draft,
  setDraft,
  tiers,
}: Pick<BookingFormState, 'catalogue' | 'selected' | 'draft' | 'setDraft' | 'tiers'> & {
  catalogue: Catalogue;
  selected: Vehicle;
}) {
  return (
    <section className="panel">
      <div className="step-title">
        <span>1 ·</span>
        <div>
          <h3>VÉHICULE</h3>
          <p>De la petite charge au déménagement complet.</p>
        </div>
      </div>
      <div className="vehicle-grid">
        {catalogue.vehicles.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-pressed={v.id === draft.vehicleId}
            disabled={v.active === false}
            className={'vehicle-card ' + (v.id === draft.vehicleId ? 'selected' : '')}
            onClick={() => setDraft((d) => ({ ...d, vehicleId: v.id }))}
          >
            <span className="vehicle-check">
              {v.id === draft.vehicleId ? <Check size={14} /> : null}
            </span>
            <img src={v.image} alt={v.name} loading="lazy" />
            <strong>{v.name}</strong>
            <span>
              {v.volume} <span className="dot">·</span> dès {money(v.prices[0])}
            </span>
          </button>
        ))}
      </div>
      <div className="vehicle-detail">
        <img src={selected.image} alt={selected.name} loading="lazy" />
        <img
          src={selected.interior}
          alt={'Dimensions intérieures du ' + selected.name}
          loading="lazy"
        />
        <div className="vehicle-specifications">
          <span className="eyebrow">DIMENSIONS UTILES</span>
          <h4>{selected.name}</h4>
          <div className="dimensions">
            <span className="volume">{selected.volume}</span>
            <span>L {selected.length}</span>
            <span>H {selected.height}</span>
            <span>l {selected.width}</span>
            <span>Passages de roue {selected.wheelWidth}</span>
            {selected.prices.map((value, index) => (
              <span key={index}>
                {tiers[index]} : {money(value)}
              </span>
            ))}
            <span>Au-delà de {catalogue.settings.distanceBounds?.[2] ?? 35} km : sur devis</span>
          </div>
        </div>
      </div>
    </section>
  );
}
