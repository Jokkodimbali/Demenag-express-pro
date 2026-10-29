import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Vehicle } from '../domain/model';
import { vehicleCapacity } from '../domain/vehicle-capacity';

type Dimensions = Pick<Vehicle, 'length' | 'height' | 'width' | 'wheelWidth'>;

const numeric = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;
const shown = (value: number) => value.toFixed(2).replace('.', ',');
const formatted = (value: string) => shown(numeric(value));
const inputValue = (value: string) => String(numeric(value)).replace('.', ',');
const assetRatio = (source: string, fallback: string) => {
  const filename = source.split('/').pop()?.split('?')[0] ?? '';
  if (filename === 'trafic-profil.png') return '960 / 365';
  if (filename === 'trafic-interieur.png') return '590 / 342';
  return fallback;
};
const vehicleOverlays: Record<
  string,
  {
    profile: [number, number, number, number];
    height: [number, number];
    wheel: [number, number, number, number];
    width: [number, number];
  }
> = {
  sprinter: {
    profile: [347.5, 56.5, 187, 39],
    height: [280.5, 220.5],
    wheel: [264.5, 326, 229, 28],
    width: [265, 392.5],
  },
  trafic: {
    profile: [297.5, 59.5, 185, 39],
    height: [296, 151.5],
    wheel: [283, 224, 228, 26],
    width: [291.5, 319.5],
  },
  master: {
    profile: [333.5, 43.5, 183, 39],
    height: [294.5, 224.5],
    wheel: [276, 308, 232, 26],
    width: [276.5, 364.5],
  },
};
const overlayStyle = (position: number[], width: number, height: number) => ({
  left: `${(position[0] / width) * 100}%`,
  top: `${(position[1] / height) * 100}%`,
  width: `${(position[2] / width) * 100}%`,
  minWidth: 0,
  textAlign: 'center' as const,
  transform: 'translate(-50%, -50%)',
});

export function FleetVehicleImagePreview({ vehicle }: { vehicle: Vehicle }) {
  const dimensions = valuesOf(vehicle);
  const overlays = vehicleOverlays[vehicle.id];
  const profileDimensions: [number, number] = vehicle.id === 'trafic' ? [960, 365] : [960, 355];
  const interiorDimensions: [number, number] = vehicle.id === 'trafic' ? [590, 342] : [560, 500];
  const volume = vehicleCapacity(
    dimensions.length,
    dimensions.height,
    dimensions.width,
    dimensions.wheelWidth,
  );

  return (
    <div className="fleet-dimension-images reference-request-vehicle-images">
      <div
        className="fleet-dimension-profile"
        style={{ aspectRatio: assetRatio(vehicle.image, '960 / 355') }}
      >
        <img src={vehicle.image} alt={`Profil du ${vehicle.name}`} />
        <span
          className={`fleet-dimension-length${overlays ? ' is-asset-annotated' : ''}`}
          style={
            overlays
              ? overlayStyle(overlays.profile, profileDimensions[0], profileDimensions[1])
              : undefined
          }
        >
          LONGUEUR <strong>{formatted(dimensions.length)} m</strong>
        </span>
        <span className="fleet-dimension-volume-chip">VOLUME ~{volume} m³</span>
      </div>
      <div
        className="fleet-dimension-interior"
        style={{ aspectRatio: assetRatio(vehicle.interior, '560 / 500') }}
      >
        <img src={vehicle.interior} alt={`Intérieur du ${vehicle.name}`} />
        {!overlays && <span className="fleet-interior-view-label">VUE INTÉRIEURE</span>}
        <span
          className={`fleet-dimension-height${overlays ? ' is-asset-annotated' : ''}`}
          style={
            overlays
              ? overlayStyle(
                  [overlays.height[0], overlays.height[1], 171, 39],
                  ...interiorDimensions,
                )
              : undefined
          }
        >
          HAUTEUR <strong>{formatted(dimensions.height)} m</strong>
        </span>
        <span
          className="fleet-dimension-width"
          style={
            overlays
              ? overlayStyle([overlays.width[0], overlays.width[1], 169, 39], ...interiorDimensions)
              : undefined
          }
        >
          LARGEUR <strong>{formatted(dimensions.width)} m</strong>
        </span>
        <span
          className="fleet-wheel-width"
          style={
            overlays
              ? {
                  ...overlayStyle(overlays.wheel, ...interiorDimensions),
                  background: '#17191de8',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }
              : undefined
          }
        >
          {formatted(dimensions.wheelWidth)} m entre passages de roue
        </span>
      </div>
    </div>
  );
}

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
  const wheelSpace = Math.max(0, width - wheelWidth) * 0.3 * Math.min(length, 0.95 * 1.9);
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
  const overlays = vehicleOverlays[vehicle.id];
  const profileDimensions: [number, number] = vehicle.id === 'trafic' ? [960, 365] : [960, 355];
  const interiorDimensions: [number, number] = vehicle.id === 'trafic' ? [590, 342] : [560, 500];
  const displayedLength = formatted(dimensions.length);
  const displayedHeight = formatted(dimensions.height);
  const displayedWidth = formatted(dimensions.width);
  const displayedWheelWidth = formatted(dimensions.wheelWidth);

  const saveDimensions = useCallback(async () => {
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
  }, [
    dimensions.height,
    dimensions.length,
    dimensions.wheelWidth,
    dimensions.width,
    disabled,
    dirty,
    invalid,
    onSave,
    vehicle,
    volume,
  ]);

  useEffect(() => {
    if (invalid || !dirty || disabled) return;
    const timer = window.setTimeout(() => void saveDimensions(), 500);
    return () => window.clearTimeout(timer);
  }, [disabled, dirty, invalid, saveDimensions]);

  return (
    <article className="fleet-dimension-card">
      <h4>{vehicle.name}</h4>
      <div className="fleet-dimension-images">
        <div
          className="fleet-dimension-profile"
          style={{ aspectRatio: assetRatio(vehicle.image, '960 / 355') }}
        >
          <img src={vehicle.image} alt={`Profil du ${vehicle.name}`} />
          <span
            className={`fleet-dimension-length${overlays ? ' is-asset-annotated' : ''}`}
            style={
              overlays
                ? overlayStyle(overlays.profile, profileDimensions[0], profileDimensions[1])
                : undefined
            }
          >
            LONGUEUR <strong>{displayedLength} m</strong>
          </span>
          <span className="fleet-dimension-volume-chip">VOLUME ~{volume}</span>
        </div>
        <div
          className="fleet-dimension-interior"
          style={{ aspectRatio: assetRatio(vehicle.interior, '560 / 500') }}
        >
          <img src={vehicle.interior} alt={`Intérieur du ${vehicle.name}`} />
          {!overlays && <span className="fleet-interior-view-label">VUE INTÉRIEURE</span>}
          <span
            className={`fleet-dimension-height${overlays ? ' is-asset-annotated' : ''}`}
            style={
              overlays
                ? overlayStyle(
                    [overlays.height[0], overlays.height[1], 171, 39],
                    ...interiorDimensions,
                  )
                : undefined
            }
          >
            HAUTEUR <strong>{displayedHeight} m</strong>
          </span>
          <span
            className="fleet-dimension-width"
            style={
              overlays
                ? overlayStyle(
                    [overlays.width[0], overlays.width[1], 169, 39],
                    ...interiorDimensions,
                  )
                : undefined
            }
          >
            LARGEUR <strong>{displayedWidth} m</strong>
          </span>
          <span
            className="fleet-wheel-width"
            style={
              overlays
                ? {
                    ...overlayStyle(overlays.wheel, ...interiorDimensions),
                    background: '#17191de8',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }
                : undefined
            }
          >
            {displayedWheelWidth} m entre passages de roue
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
          <b>~{volume}</b>
        </div>
        <div className="fleet-volume-steps">
          <span>
            {displayedLength} m × {displayedHeight} m × {displayedWidth} m = {shown(gross)} m³
          </span>
          <span>
            Passages de roue : ({displayedWidth} m − {displayedWheelWidth} m) × 0,30 m × 1,90 m = −{' '}
            {shown(wheelSpace)} m³
          </span>
          <span>Parois et toit arrondis : × 0,95 = {volume}</span>
        </div>
      </div>
      <div className="fleet-dimension-management">{management}</div>
      {saved && (
        <span role="status" className="sr-only">
          Dimensions enregistrées.
        </span>
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
