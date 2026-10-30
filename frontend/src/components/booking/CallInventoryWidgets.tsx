import { uiText } from '../../content/reference-ui-text';
import { useEffect, useState, type ReactNode } from 'react';
import type { Draft } from '../../application/booking-draft';
import {
  readInventoryIllustration,
  saveInventoryIllustration,
} from '../../application/inventory-illustrations';
import {
  estimatedInventoryItemVolume,
  inventoryDismantleFactor,
} from '../../domain/moving-estimate';
import {
  inventoryItems,
  inventoryFormats,
  inventoryFormatHint,
  type InventoryFormat,
} from '../../domain/inventory';
import { assemblyCount } from '../../domain/inventory-count';
import type { Inventory } from '../../domain/inventory';
import type { MovingLaborPlanningSettings, Vehicle } from '../../domain/model';

export type CallInventoryProps = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  maxOptions: number;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  quoteTrips: number;
  maxTrips: number;
  onApplyEstimate: (vehicleId: string, trips: number) => void;
  laborPlanning?: MovingLaborPlanningSettings;
  trafficDurationMinutes?: number;
  labourPriceEditor?: ReactNode;
  estimateInventory?: Inventory;
  audience?: 'admin' | 'client';
  referenceMode?: boolean;
};
const inventorySizeRanges: Record<string, [number, number]> = {
  salon: [1, 10],
  'table-manger': [2, 12],
  lit: [1, 4],
  matelas: [1, 4],
  armoire: [1, 8],
};
const inventorySizeRange = (key: string, historicalMaximum?: number): [number, number] => {
  const item = inventoryItems.find((entry) => entry.key === key);
  const [minimum, maximum] = inventorySizeRanges[key] ?? [
    1,
    item?.defaultSize ? item.defaultSize + 3 : 1,
  ];
  return [minimum, Math.max(maximum, historicalMaximum ?? maximum)];
};

export { assemblyCount };

export function inventoryItemEstimate(
  item: (typeof inventoryItems)[number],
  size: number,
  format: InventoryFormat,
  dismantle: boolean,
  quantity: number,
): string {
  const sizeDescription = item.sizeLabel
    ? `${size} ${size === 1 ? item.sizeLabel.replace(/s$/u, '') : item.sizeLabel}${item.sizeName ? ` · ${item.sizeName(size)}` : ''}`
    : item.hasFormat
      ? inventoryFormatHint(item.key, format) ||
        inventoryFormats.find((option) => option.value === format)?.label.toLowerCase() ||
        'standard'
      : '';
  const volume = estimatedInventoryItemVolume(item.key, size, dismantle, format);
  const unitLabel = volume.toFixed(2).replace('.', ',');
  const totalLabel = (volume * Math.max(1, quantity)).toFixed(2).replace('.', ',');
  return `${sizeDescription ? `${sizeDescription} · ` : ''}${quantity > 0 ? `${quantity} × ≈ ${unitLabel} = ≈ ${totalLabel} m³` : `≈ ${unitLabel} m³ / unité`}`;
}

export function referenceItemSubline(
  item: (typeof inventoryItems)[number],
  size: number,
  format: InventoryFormat,
  dismantle: boolean,
  quantity: number,
): string {
  const volume =
    quantity > 0
      ? `≈ ${(estimatedInventoryItemVolume(item.key, size, dismantle, format) * quantity).toFixed(2).replace('.', ',')} m³`
      : '';
  const hint = item.hasFormat ? inventoryFormatHint(item.key, format) : '';
  return [volume, hint].filter(Boolean).join(' · ');
}

export function InventoryItemLabel({ label, estimate }: { label: ReactNode; estimate: string }) {
  return (
    <div className="inventory-item-copy">
      {label}
      <small className="inventory-item-estimate">{estimate}</small>
    </div>
  );
}

export function InventoryOriginToggle({
  value,
  onChange,
}: {
  value: 'local' | 'import';
  onChange: (value: 'local' | 'import') => void;
}) {
  return (
    <div className="inventory-origin-toggle" role="group" aria-label={uiText['origineDuMeuble']}>
      {(['local', 'import'] as const).map((origin) => (
        <button
          type="button"
          key={origin}
          aria-pressed={value === origin}
          className={value === origin ? 'active' : ''}
          onClick={() => onChange(origin)}
        >
          {origin === 'local' ? 'Local' : 'Importé'}
        </button>
      ))}
    </div>
  );
}

export function InventorySizeStepper({
  itemKey,
  itemLabel,
  sizeLabel,
  value,
  onChange,
  showLabel = false,
  historicalMaximum,
}: {
  itemKey: string;
  itemLabel: string;
  sizeLabel: string;
  value: number;
  onChange: (value: number) => void;
  showLabel?: boolean;
  historicalMaximum?: number;
}) {
  const [minimum, maximum] = inventorySizeRange(itemKey, historicalMaximum);
  const label = value === 1 ? sizeLabel.replace(/s$/, '') : sizeLabel;
  return (
    <div className="inventory-size-stepper" role="group" aria-label={`Taille de ${itemLabel}`}>
      {showLabel && <span className="inventory-size-label">{uiText['taille']}</span>}
      <button
        type="button"
        aria-label={`Réduire la taille de ${itemLabel}`}
        disabled={value <= minimum}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>
        {value} {label}
      </output>
      <button
        type="button"
        aria-label={`Augmenter la taille de ${itemLabel}`}
        disabled={value >= Math.max(maximum, value)}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function InventoryFormatSelector({
  itemKey,
  itemLabel,
  value,
  onChange,
}: {
  itemKey: string;
  itemLabel: string;
  value: InventoryFormat;
  onChange: (format: InventoryFormat) => void;
}) {
  return (
    <div className="inventory-format-selector" role="group" aria-label={`Format de ${itemLabel}`}>
      <span>{uiText['format']}</span>
      <div>
        {inventoryFormats.map((format) => (
          <button
            type="button"
            key={format.value}
            aria-pressed={value === format.value}
            title={inventoryFormatHint(itemKey, format.value) || format.label}
            onClick={() => onChange(format.value)}
          >
            {format.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InventoryHoverCard({
  item,
  format,
  size,
  quantity,
  dismantle,
  onSelectFormat,
  onSelectSize,
  imageScope,
  historicalMaximum,
}: {
  item: (typeof inventoryItems)[number];
  format: InventoryFormat;
  size: number;
  quantity: number;
  dismantle: boolean;
  onSelectFormat: (format: InventoryFormat) => void;
  onSelectSize: (size: number) => void;
  imageScope?: string;
  historicalMaximum?: number;
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState('');
  const formatOptions = item.hasFormat ? inventoryFormats : [];
  const displayLabel = item.label.charAt(0).toLocaleUpperCase('fr-FR') + item.label.slice(1);
  const sizeLabel = item.sizeLabel;
  const [minimumSize, maximumSize] = inventorySizeRange(item.key, historicalMaximum);
  const sizeOptions = sizeLabel
    ? [
        Math.max(minimumSize, Math.min(size - 1, maximumSize - 2)),
        Math.max(minimumSize, Math.min(size - 1, maximumSize - 2)) + 1,
        Math.max(minimumSize, Math.min(size - 1, maximumSize - 2)) + 2,
      ]
        .filter((value) => value <= maximumSize)
        .map((value) => ({
          value,
          label: `${value} ${value === 1 ? sizeLabel.replace(/s$/u, '') : sizeLabel}`,
          hint: item.sizeName?.(value) ?? `${value} ${sizeLabel}`,
        }))
    : [];
  const hasDismantleVolumeReduction = item.key !== 'climatiseur';
  const canDismantle = true;
  const currentVolume = estimatedInventoryItemVolume(item.key, size, dismantle, format);
  const dismantlePercent = Math.round((1 - inventoryDismantleFactor(item.key)) * 100);
  const volumeLabel = (volume: number) => `≈ ${volume.toFixed(2).replace('.', ',')} m³`;
  const scope = imageScope ?? item.key;
  const hasVariants = formatOptions.length > 0 || sizeOptions.length > 0;
  const defaultImageKey = `${scope}:default`;
  useEffect(() => {
    const imageKeys = [
      ...(item.hasFormat
        ? inventoryFormats.map((option) => `${scope}:format:${option.value}`)
        : []),
      ...(item.sizeLabel
        ? [Math.max(minimumSize, Math.min(size - 1, maximumSize - 2))]
            .flatMap((first) => [first, first + 1, first + 2])
            .filter((value) => value <= maximumSize)
            .map((value) => `${scope}:size:${value}`)
        : []),
      ...(!hasVariants ? [defaultImageKey] : []),
    ];
    let active = true;
    void Promise.all(
      imageKeys.map(async (key) => [key, await readInventoryIllustration(key)] as const),
    )
      .then((entries) => {
        if (active)
          setImages(
            Object.fromEntries(entries.filter((entry) => entry[1])) as Record<string, string>,
          );
      })
      .catch(() => {
        if (active) setUploadError("Les images enregistrées n'ont pas pu être chargées.");
      });
    return () => {
      active = false;
    };
  }, [
    scope,
    item.key,
    item.hasFormat,
    item.sizeLabel,
    size,
    minimumSize,
    maximumSize,
    hasVariants,
    defaultImageKey,
  ]);

  const upload = async (key: string, file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    try {
      const image = await saveInventoryIllustration(key, file);
      setImages((current) => ({ ...current, [key]: image }));
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "L'image n'a pas pu être enregistrée.",
      );
    }
  };

  const illustration = (key: string, label: string) => (
    <label
      className={`inventory-hover-image-upload${key === defaultImageKey ? ' inventory-hover-default-image' : ''}`}
      title={images[key] ? 'Remplacer cette image' : 'Choisir et enregistrer une image'}
      onClick={(event) => event.stopPropagation()}
    >
      {images[key] ? (
        <img src={images[key]} alt={`Illustration ${label}`} />
      ) : (
        <svg viewBox="0 0 24 24" role="img" aria-label={uiText['ajouterUneIllustration']}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="m5 18 5-5 3 3 2-2 4 4" />
        </svg>
      )}
      <span>{images[key] ? 'Remplacer' : 'Ajouter une image'}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`${images[key] ? 'Remplacer' : 'Ajouter'} l’illustration ${label}`}
        onChange={(event) => {
          void upload(key, event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );

  return (
    <div className="inventory-hover-card" role="tooltip">
      {!hasVariants && illustration(defaultImageKey, item.label)}
      <div className="inventory-hover-body">
        <strong className="inventory-hover-title">
          <span>
            {displayLabel} ·{' '}
            {item.sizeLabel
              ? `${size} ${size === 1 ? item.sizeLabel.replace(/s$/u, '') : item.sizeLabel}${item.sizeName ? ` · ${item.sizeName(size)}` : ''}`
              : item.hasFormat
                ? inventoryFormatHint(item.key, format) ||
                  (inventoryFormats
                    .find((option) => option.value === format)
                    ?.label.toLowerCase() ??
                    'standard')
                : ''}
          </span>
          <small>
            {canDismantle
              ? `Démontable${hasDismantleVolumeReduction ? ` · −${dismantlePercent} %` : ''}`
              : 'Non démontable'}
          </small>
        </strong>
        {(formatOptions.length > 0 || sizeOptions.length > 0) && (
          <div className="inventory-hover-variants">
            {formatOptions.map((option) => {
              const active = option.value === format;
              const imageKey = `${scope}:format:${option.value}`;
              return (
                <div
                  key={option.value}
                  className={active ? 'active' : ''}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => onSelectFormat(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectFormat(option.value);
                  }}
                >
                  {illustration(imageKey, `${item.label} ${option.label.toLowerCase()}`)}
                  <strong>{option.label}</strong>
                  <small>{inventoryFormatHint(item.key, option.value) || option.label}</small>
                </div>
              );
            })}
            {sizeOptions.map((option) => (
              <div
                className={option.value === size ? 'active' : ''}
                key={option.value}
                role="button"
                tabIndex={0}
                aria-pressed={option.value === size}
                onClick={() => onSelectSize(option.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectSize(option.value);
                }}
              >
                {illustration(`${scope}:size:${option.value}`, `${item.label} ${option.label}`)}
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </div>
            ))}
          </div>
        )}
        {uploadError && (
          <p className="inventory-image-error" role="alert">
            {uploadError}
          </p>
        )}
        {!item.hasFormat && !item.sizeLabel && (
          <div className="inventory-hover-detail">
            <strong>{uiText['volumeMoyen']}</strong>
            <span>
              {volumeLabel(currentVolume)} {uiText['unite']}
            </span>
          </div>
        )}
        {dismantle && canDismantle && item.key !== 'climatiseur' && (
          <div className="inventory-hover-detail">
            <strong>{uiText['demonte']}</strong>
            <span>
              {hasDismantleVolumeReduction ? `−${dismantlePercent} % appliqué` : 'volume inchangé'}
            </span>
          </div>
        )}
        {item.key === 'salon' && (
          <div className="inventory-hover-detail">
            <strong>{uiText['nonEmpilable']}</strong>
            <span>{uiText['25RienNeSePoseDessus']}</span>
          </div>
        )}
        <div className="inventory-hover-selection">
          <strong>{uiText['votreSelection']}</strong>
          <span>
            {Math.max(1, quantity)} ×{' '}
            {item.sizeLabel
              ? `${size} ${size === 1 ? item.sizeLabel.replace(/s$/u, '') : item.sizeLabel}`
              : item.hasFormat
                ? inventoryFormatHint(item.key, format) ||
                  (inventoryFormats
                    .find((option) => option.value === format)
                    ?.label.toLowerCase() ??
                    'standard')
                : 'standard'}
            {dismantle && item.key !== 'climatiseur' ? ', démonté' : ''} ={' '}
            {volumeLabel(currentVolume * Math.max(1, quantity))}
          </span>
        </div>
        {item.tip && <p>{item.tip}</p>}
      </div>
    </div>
  );
}
