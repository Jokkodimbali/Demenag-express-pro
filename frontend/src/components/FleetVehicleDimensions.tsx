import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Vehicle } from '../domain/model';
import { vehicleCapacity } from '../domain/vehicle-capacity';

type Dimensions = Pick<Vehicle, 'length' | 'height' | 'width' | 'wheelWidth'>;

const numeric = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;
const shown = (value: number) => value.toFixed(2).replace('.', ',');
const inputValue = (value: string) => String(numeric(value)).replace('.', ',');

export function FleetVehicleDimensions({
  vehicle,
  disabled,
  onSave,
  management,
}: {
  vehicle: Vehicle;
  disabled: boolean;
  onSave: (vehicle: Vehicle) => Promise<void>;
  management: ReactNode;
}) {
  const [dimensions, setDimensions] = useState<Dimensions>(() => valuesOf(vehicle));
  const [saved, setSaved] = useState(false);

  useEffect(() => setDimensions(valuesOf(vehicle)), [vehicle]);

  const length = numeric(dimensions.length);
  const height = numeric(dimensions.height);
  const width = numeric(dimensions.width);
  const wheelWidth = Math.min(numeric(dimensions.wheelWidth) || width, width);
  const gross = length * height * width;
  const wheelSpace = Math.max(0, width - wheelWidth) * 0.3 * Math.min(length, 1.9);
  const volume = vehicleCapacity(
    dimensions.length,
    dimensions.height,
    dimensions.width,
    dimensions.wheelWidth,
  );
  const invalid = Object.values(dimensions).some((value) => numeric(value) <= 0);
  const dirty = Object.keys(dimensions).some((key) => {
    const field = key as keyof Dimensions;
    return numeric(dimensions[field]) !== numeric(vehicle[field]);
  });

  async function saveDimensions() {
    if (invalid || !dirty || disabled) return;
    try {
      await onSave({
        ...vehicle,
        length: `${numeric(dimensions.length)} m`,
        height: `${numeric(dimensions.height)} m`,
        width: `${numeric(dimensions.width)} m`,
        wheelWidth: `${numeric(dimensions.wheelWidth)} m`,
        volume,
      });
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <article className="fleet-dimension-card">
      <h4>{vehicle.name}</h4>
      <div className="fleet-dimension-images">
        <div className="fleet-dimension-profile">
          <img src={vehicle.image} alt={`Profil du ${vehicle.name}`} />
          <span className="fleet-dimension-length">
            LONGUEUR <strong>{dimensions.length} m</strong>
          </span>
          <span className="fleet-dimension-volume-chip">VOLUME ~{volume}</span>
        </div>
        <div className="fleet-dimension-interior">
          <img src={vehicle.interior} alt={`Intérieur du ${vehicle.name}`} />
          <span className="fleet-interior-view-label">VUE INTÉRIEURE</span>
          <span className="fleet-dimension-height">
            HAUTEUR <strong>{dimensions.height} m</strong>
          </span>
          <span className="fleet-dimension-width">
            LARGEUR <strong>{dimensions.width} m</strong>
          </span>
          <span className="fleet-wheel-width">
            {dimensions.wheelWidth} m entre passages de roue
          </span>
        </div>
      </div>
      <div className="fleet-dimension-fields">
        {(
          [
            ['length', 'Longueur (m)'],
            ['height', 'Hauteur (m)'],
            ['width', 'Largeur (m)'],
            ['wheelWidth', 'Entre passages de roue (m)'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="text"
              inputMode="decimal"
              value={dimensions[key]}
              aria-label={`${label} pour ${vehicle.name}`}
              onChange={(event) => {
                setSaved(false);
                setDimensions((current) => ({ ...current, [key]: event.target.value }));
              }}
            />
          </label>
        ))}
      </div>
      <div className="fleet-volume-breakdown">
        <div>
          <strong>VOLUME UTILE CALCULÉ</strong>
          <b>{volume}</b>
        </div>
        <div className="fleet-volume-steps">
          <span>
            {dimensions.length} m × {dimensions.height} m × {dimensions.width} m = {shown(gross)} m³
          </span>
          <span>
            Passages de roue : ({dimensions.width} m − {dimensions.wheelWidth} m) × 0,30 m ×{' '}
            {Math.min(length, 1.9).toFixed(2).replace('.', ',')} m = − {shown(wheelSpace)} m³
          </span>
          <span>Parois et toit arrondis : × 0,95 = {volume}</span>
        </div>
      </div>
      <div className="fleet-dimension-management">{management}</div>
      {(dirty || saved) && (
        <div className="fleet-dimension-save-row">
          {saved && <span role="status">Dimensions enregistrées.</span>}
          <button
            type="button"
            className="button primary"
            disabled={disabled || invalid || !dirty}
            onClick={() => void saveDimensions()}
          >
            Enregistrer les dimensions
          </button>
        </div>
      )}
    </article>
  );
}

function valuesOf(vehicle: Vehicle): Dimensions {
  return {
    length: inputValue(vehicle.length),
    height: inputValue(vehicle.height),
    width: inputValue(vehicle.width),
    wheelWidth: inputValue(vehicle.wheelWidth),
  };
}
