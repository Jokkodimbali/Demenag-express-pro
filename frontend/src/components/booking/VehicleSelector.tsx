import { Check } from 'lucide-react';
import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';
import { money } from '../../domain/format';
import type { Catalogue, Vehicle } from '../../domain/model';
import type { VehicleTransition } from '../../domain/vehicle-transition';

export function VehicleSelector({
  catalogue,
  selected,
  draft,
  setDraft,
  tiers,
  transition,
  onVehicleTransition,
}: Pick<BookingViewState, 'catalogue' | 'selected' | 'draft' | 'setDraft' | 'tiers'> & {
  catalogue: Catalogue;
  selected: Vehicle;
  transition: VehicleTransition | null;
  onVehicleTransition: (fromVehicleId: string, toVehicleId: string) => void;
}) {
  const chooseVehicle = (vehicleId: string) => {
    if (vehicleId === draft.vehicleId) return;
    onVehicleTransition(draft.vehicleId, vehicleId);
    setDraft((current) => ({ ...current, vehicleId }));
  };

  return (
    <section className="panel">
      <div className="step-title">
        <span>{messages.text1}</span>
        <div>
          <h3>{messages.vehicule}</h3>
          <p>{messages.deLaPetiteChargeAuDemenagementComplet}</p>
        </div>
      </div>
      <div className="vehicle-grid">
        {catalogue.vehicles.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-pressed={v.id === draft.vehicleId}
            disabled={v.active === false}
            className={[
              'vehicle-card',
              v.id === draft.vehicleId ? 'selected' : '',
              transition?.fromVehicleId === v.id ? 'rolling-out' : '',
              transition?.toVehicleId === v.id ? 'rolling-in' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => chooseVehicle(v.id)}
          >
            <span className="vehicle-check">
              {v.id === draft.vehicleId ? <Check size={14} /> : null}
            </span>
            <span className="vehicle-image-stage">
              <img src={v.image} alt={v.name} loading="eager" />
            </span>
            <strong>{v.name}</strong>
            <span>
              {v.volume} <span className="dot">·</span>
              {messages.des}
              {money(v.prices[0])}
            </span>
          </button>
        ))}
      </div>
      <div className="vehicle-detail">
        <img src={selected.image} alt={selected.name} loading="lazy" />
        <img
          src={selected.interior}
          alt={messages.dimensionsInterieuresDu + selected.name}
          loading="lazy"
        />
        <div className="vehicle-specifications">
          <span className="eyebrow">{messages.dimensionsUtiles}</span>
          <h4>{selected.name}</h4>
          <div className="dimensions">
            <span className="volume">{selected.volume}</span>
            <span>
              {messages.l}
              {selected.length}
            </span>
            <span>
              {messages.h}
              {selected.height}
            </span>
            <span>
              {messages.l2}
              {selected.width}
            </span>
            <span>
              {messages.passagesDeRoue}
              {selected.wheelWidth}
            </span>
            {selected.prices.map((value, index) => (
              <span key={index}>
                {tiers[index]} : {money(value)}
              </span>
            ))}
            <span>
              {messages.auDelaDe}
              {catalogue.settings.distanceBounds[2]}
              {messages.kmSurDevis}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
