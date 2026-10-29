import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../application/context';
import type { Draft } from '../../application/booking-draft';
import {
  readInventoryIllustration,
  saveInventoryIllustration,
} from '../../application/inventory-illustrations';
import { MovingPlanningPanel } from './MovingPlanningPanel';
import type { MovingLaborPlanningSettings, Vehicle } from '../../domain/model';
import {
  estimatedInventoryItemVolume,
  estimateMovingWork,
  inventoryDismantleFactor,
} from '../../domain/moving-estimate';
import {
  inventoryFlags,
  inventoryItems,
  inventoryFormats,
  inventoryFormatHint,
  inventoryNote,
  blankInventory,
  type Inventory,
  type InventoryFormat,
} from '../../domain/inventory';
import {
  referenceAnnexVolume,
  referenceDwellingLabel,
  referenceDwellingVolume,
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../../domain/reference-inventory-note';

const sections = [...new Set(inventoryItems.map((item) => item.section))];
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

function assemblyCount(inventory: Inventory, key: 'desk' | 'wardrobe' | 'bed'): number {
  return inventoryItems
    .filter((item) => item.assembly === key)
    .reduce((sum, item) => {
      const line = inventory.entries[item.key];
      return (
        sum +
        (line?.dismantle ? line.quantity : 0) +
        inventory.variants
          .filter((variant) => variant.itemKey === item.key && variant.dismantle)
          .reduce((count, variant) => count + variant.quantity, 0)
      );
    }, 0);
}

function inventoryItemEstimate(
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

function referenceItemSubline(
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

function InventoryItemLabel({ label, estimate }: { label: ReactNode; estimate: string }) {
  return (
    <div className="inventory-item-copy">
      {label}
      <small className="inventory-item-estimate">{estimate}</small>
    </div>
  );
}

function InventoryOriginToggle({
  value,
  onChange,
}: {
  value: 'local' | 'import';
  onChange: (value: 'local' | 'import') => void;
}) {
  return (
    <div className="inventory-origin-toggle" role="group" aria-label="Origine du meuble">
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

function InventorySizeStepper({
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
      {showLabel && <span className="inventory-size-label">Taille</span>}
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

function InventoryFormatSelector({
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
      <span>Format</span>
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

function InventoryHoverCard({
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
        <svg viewBox="0 0 24 24" role="img" aria-label="Ajouter une illustration">
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
            <strong>Volume moyen</strong>
            <span>{volumeLabel(currentVolume)} / unité</span>
          </div>
        )}
        {dismantle && canDismantle && item.key !== 'climatiseur' && (
          <div className="inventory-hover-detail">
            <strong>Démonté</strong>
            <span>
              {hasDismantleVolumeReduction ? `−${dismantlePercent} % appliqué` : 'volume inchangé'}
            </span>
          </div>
        )}
        {item.key === 'salon' && (
          <div className="inventory-hover-detail">
            <strong>Non empilable</strong>
            <span>+25 % (rien ne se pose dessus)</span>
          </div>
        )}
        <div className="inventory-hover-selection">
          <strong>Votre sélection</strong>
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

export function CallInventory({
  draft,
  setDraft,
  maxOptions,
  vehicles,
  selectedVehicleId,
  quoteTrips,
  maxTrips,
  onApplyEstimate,
  laborPlanning,
  trafficDurationMinutes,
  labourPriceEditor,
  estimateInventory,
  audience = 'admin',
  referenceMode = false,
}: {
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
}) {
  const [customLabel, setCustomLabel] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [open, setOpen] = useState(audience === 'client' && !referenceMode);
  const [openCustom, setOpenCustom] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterInventoryItem = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveWidget(id), 250);
  };
  const leaveInventoryItem = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveWidget((current) => (current === id ? null : current));
  };
  const dwellingTypes = ['Studio', 'F2', 'F3', 'F4', 'F5 et plus', 'Villa'];
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [section, audience === 'client' && !referenceMode]),
    ),
  );
  const inventory = draft.inventory;
  const { api } = useApp();
  const [historicalSizeMaximum, setHistoricalSizeMaximum] = useState<Record<string, number>>({});
  const historyRequested = useRef(false);
  useEffect(() => {
    if (audience !== 'admin' || !open || historyRequested.current) return;
    historyRequested.current = true;
    void api
      .bookings()
      .then((bookings) => {
        const maximum: Record<string, number> = {};
        bookings.forEach((booking) => {
          const source = booking.inventorySnapshot?.sourceInventory;
          if (!source) return;
          Object.entries(source.entries).forEach(([key, entry]) => {
            maximum[key] = Math.max(maximum[key] ?? 0, entry.size);
          });
          source.variants.forEach((entry) => {
            maximum[entry.itemKey] = Math.max(maximum[entry.itemKey] ?? 0, entry.size);
          });
        });
        setHistoricalSizeMaximum(maximum);
      })
      .catch(() => undefined);
  }, [api, audience, open]);
  const update = (next: Inventory) => {
    if (
      ['desk', 'wardrobe', 'bed'].some((key) => {
        const optionKey = key as 'desk' | 'wardrobe' | 'bed';
        const nextValue =
          draft.options[optionKey] +
          assemblyCount(next, optionKey) -
          assemblyCount(inventory, optionKey);
        return nextValue < 0 || nextValue > maxOptions;
      })
    ) {
      setInventoryError(
        `Le maximum de ${maxOptions} montages par type est atteint. Ajustez les options avant de continuer.`,
      );
      return;
    }
    setInventoryError('');
    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
    const estimate = vehicle
      ? estimateMovingWork(next, vehicle, draft.route, {
          crew: next.crew,
          startTime: draft.timeSlot,
          laborPlanning,
        })
      : null;
    setDraft((current) => {
      const options = { ...current.options };
      for (const key of ['desk', 'wardrobe', 'bed'] as const) {
        const difference = assemblyCount(next, key) - assemblyCount(current.inventory, key);
        options[key] = Math.max(0, Math.min(maxOptions, options[key] + difference));
      }
      if (estimate && estimate.volume > 0) options.labour = estimate.crew;
      return { ...current, inventory: next, options };
    });
    if (estimate?.trips) onApplyEstimate(selectedVehicleId, estimate.trips);
  };
  const clearInventory = () => {
    if (!window.confirm("Vider la fiche d'appel ?")) return;
    setInventoryError('');
    setCustomLabel('');
    setActiveWidget(null);
    setDraft((current) => {
      const options = { ...current.options };
      for (const key of ['desk', 'wardrobe', 'bed'] as const) {
        options[key] = Math.max(0, options[key] - assemblyCount(current.inventory, key));
      }
      return { ...current, inventory: blankInventory(), options };
    });
  };
  const addCustomItem = () => {
    const label = customLabel.trim().toLowerCase();
    if (!label) return;
    update({
      ...inventory,
      custom: [
        ...inventory.custom,
        {
          id: crypto.randomUUID(),
          label,
          quantity: 1,
          format: 'medium',
          dismantle: false,
          origin: 'local',
        },
      ],
    });
    setCustomLabel('');
  };
  const setEntry = (key: string, patch: Partial<Inventory['entries'][string]>) => {
    const item = inventoryItems.find((entry) => entry.key === key);
    const current = inventory.entries[key] ?? {
      quantity: 0,
      size: item?.defaultSize ?? 1,
      format: 'medium' as const,
      dismantle: !!item?.defaultDismantle,
    };
    update({ ...inventory, entries: { ...inventory.entries, [key]: { ...current, ...patch } } });
  };
  const total =
    Object.values(inventory.entries).reduce((sum, item) => sum + item.quantity, 0) +
    inventory.variants.reduce((sum, item) => sum + item.quantity, 0) +
    inventory.custom.reduce((sum, item) => sum + item.quantity, 0);
  const estimateVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const currentEstimate = estimateVehicle
    ? estimateMovingWork(estimateInventory ?? inventory, estimateVehicle, draft.route, {
        trips: quoteTrips,
        crew: inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning,
        trafficDurationMinutes,
      })
    : null;
  const hasVolume = currentEstimate ? currentEstimate.volume > 0 : total > 0;
  const annexVolume = referenceAnnexVolume(inventory);
  const countedObjectVolume =
    Object.entries(inventory.entries).reduce(
      (sum, [key, entry]) =>
        sum + estimatedInventoryItemVolume(key, entry.size, !!entry.dismantle, entry.format) * entry.quantity,
      0,
    ) +
    inventory.variants.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume(item.itemKey, item.size, !!item.dismantle, item.format) *
          item.quantity,
      0,
    ) +
    inventory.custom.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume('custom', 1, !!item.dismantle, item.format) * item.quantity,
      0,
    );
  const volumeDetail = `Meubles et objets comptés ≈ ${countedObjectVolume.toFixed(1).replace('.', ',')} m³${annexVolume > 0 ? ` · effets annexes ≈ ${annexVolume.toFixed(1).replace('.', ',')} m³` : ''}`;
  const quantityOf = (key: string) =>
    (inventory.entries[key]?.quantity ?? 0) +
    inventory.variants
      .filter((item) => item.itemKey === key)
      .reduce((sum, item) => sum + item.quantity, 0);
  const inventoryChecks = [
    ...(quantityOf('lit') > quantityOf('matelas')
      ? [`${quantityOf('lit') - quantityOf('matelas')} lit(s) sans matelas compté : ajoutez-les si le client les emporte.`]
      : []),
    ...(quantityOf('table-manger') > 0 && quantityOf('chaise') === 0
      ? ['Table à manger sans chaises : à vérifier avec le client.']
      : []),
    ...(!inventory.ready ? ['Demandez si le matériel sera prêt à être chargé.'] : []),
    ...(!inventory.stairs ? ['Demandez si tout le matériel passe dans les escaliers.'] : []),
    ...(inventory.stairs === 'non'
      ? ['Objets qui ne passent pas les escaliers : prévoir démontage, corde ou monte-meuble.']
      : []),
    ...(!inventory.dwellingType
      ? ["Type de logement non précisé : les sacs d'habits, la vaisselle et le linge ne sont pas estimés."]
      : []),
  ];

  return (
    <section className={`panel call-inventory${referenceMode ? ' reference-call-inventory' : ''}`}>
      <div className="inventory-heading">
        <div>
          <strong>
            {audience === 'client' && !referenceMode
              ? 'VOTRE INVENTAIRE'
              : "FICHE D'APPEL · INVENTAIRE"}
          </strong>
          <span>
            {audience === 'client' && !referenceMode
              ? 'Indiquez les objets à déménager pour estimer le volume et les allers-retours.'
              : "Cochez et comptez pendant l'appel, le devis se remplit tout seul."}
          </span>
        </div>
        <button
          type="button"
          className="inventory-collapse"
          onClick={() => setOpen((value) => !value)}
        >
          {audience === 'client' && !referenceMode
            ? open
              ? 'Réduire'
              : 'Développer'
            : open
              ? 'Réduire'
              : 'Ouvrir la fiche'}
        </button>
      </div>
      {open && (
        <div className="inventory-content">
          {audience === 'client' && !referenceMode && (
            <p className="muted">
              Les montages de lit, armoire et bureau sélectionnés alimentent directement votre
              estimation.
            </p>
          )}
          {inventoryError && (
            <p className="alert error" role="alert">
              {inventoryError}
            </p>
          )}
          <div className="inventory-access">
            {(['from', 'to'] as const).map((side) => (
              <div className="inventory-access-card" key={side}>
                <div className="inventory-floor-row">
                  <strong>
                    <span className={`point-badge ${side}`}>{side === 'from' ? 'A' : 'B'}</span>
                    Étage
                  </strong>
                  <div
                    className="inventory-floor-stepper"
                    role="group"
                    aria-label={`Étage ${side === 'from' ? 'de départ' : 'd’arrivée'}`}
                  >
                    <button
                      type="button"
                      aria-label={`Diminuer l’étage ${side === 'from' ? 'de départ' : 'd’arrivée'}`}
                      disabled={inventory[side === 'from' ? 'fromFloor' : 'toFloor'] <= 0}
                      onClick={() =>
                        update({
                          ...inventory,
                          [side === 'from' ? 'fromFloor' : 'toFloor']:
                            inventory[side === 'from' ? 'fromFloor' : 'toFloor'] - 1,
                        })
                      }
                    >
                      −
                    </button>
                    <output>
                      {inventory[side === 'from' ? 'fromFloor' : 'toFloor'] === 0
                        ? 'RDC'
                        : inventory[side === 'from' ? 'fromFloor' : 'toFloor'] === 1
                          ? '1er étage'
                          : `${inventory[side === 'from' ? 'fromFloor' : 'toFloor']}e étage`}
                    </output>
                    <button
                      type="button"
                      aria-label={`Augmenter l’étage ${side === 'from' ? 'de départ' : 'd’arrivée'}`}
                      disabled={inventory[side === 'from' ? 'fromFloor' : 'toFloor'] >= 20}
                      onClick={() =>
                        update({
                          ...inventory,
                          [side === 'from' ? 'fromFloor' : 'toFloor']:
                            inventory[side === 'from' ? 'fromFloor' : 'toFloor'] + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <label className="inventory-check">
                  <input
                    type="checkbox"
                    checked={inventory[side === 'from' ? 'fromLift' : 'toLift']}
                    onChange={(event) =>
                      update({
                        ...inventory,
                        [side === 'from' ? 'fromLift' : 'toLift']: event.target.checked,
                      })
                    }
                  />{' '}
                  Ascenseur
                </label>
              </div>
            ))}
          </div>
          <div className="inventory-dwelling-type">
            <div>
              <strong>
                Type de logement <span>(facultatif)</span>
              </strong>
              {annexVolume > 0 && (audience === 'admin' || referenceMode) && (
                <span className="inventory-annex-volume">
                  + ≈ {annexVolume.toFixed(1).replace('.', ',')} m³ annexes
                </span>
              )}
            </div>
            <div className="inventory-dwelling-options" role="group" aria-label="Type de logement">
              <button
                type="button"
                aria-pressed={!inventory.dwellingType}
                className={!inventory.dwellingType ? 'active' : ''}
                onClick={() => update({ ...inventory, dwellingType: '' })}
              >
                Non précisé
              </button>
              {dwellingTypes.map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={inventory.dwellingType === type}
                  className={inventory.dwellingType === type ? 'active' : ''}
                  onClick={() => update({ ...inventory, dwellingType: type })}
                >
                  {referenceDwellingLabel(type)}
                </button>
              ))}
            </div>
            {inventory.dwellingType && (
              <label className="inventory-check">
                <input
                  type="checkbox"
                  checked={inventory.annexOn !== false}
                  onChange={(event) => update({ ...inventory, annexOn: event.target.checked })}
                />
                <span>
                  Ajouter les effets annexes (forfait{' '}
                  {referenceDwellingLabel(inventory.dwellingType)} ≈{' '}
                  {String(referenceDwellingVolume(inventory.dwellingType)).replace('.', ',')} m³)
                  <small>Sacs, vaisselle, linge, petits objets</small>
                </span>
              </label>
            )}
          </div>
          {sections.map((section) => (
            <details
              className="inventory-section"
              key={section}
              open={openSections[section]}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOpenSections((current) =>
                  current[section] === isOpen ? current : { ...current, [section]: isOpen },
                );
              }}
            >
              <summary>
                <span>{section}</span>
                {(() => {
                  const count = inventoryItems
                    .filter((item) => item.section === section)
                    .reduce(
                      (sum, item) =>
                        sum +
                        (inventory.entries[item.key]?.quantity ?? 0) +
                        inventory.variants
                          .filter((variant) => variant.itemKey === item.key)
                          .reduce((variantSum, variant) => variantSum + variant.quantity, 0),
                      0,
                    );
                  return count > 0 ? (
                    <span className="inventory-section-count">
                      {count} {count > 1 ? 'objets' : 'objet'}
                    </span>
                  ) : null;
                })()}
              </summary>
              <div className="inventory-list">
                {inventoryItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const entry = inventory.entries[item.key] ?? {
                      quantity: 0,
                      size: item.defaultSize ?? 1,
                      format: 'medium' as const,
                      dismantle: !!item.defaultDismantle,
                    };
                    return (
                      <div key={item.key}>
                        <div
                          className={
                            entry.quantity > 0 ? 'inventory-row selected' : 'inventory-row'
                          }
                        >
                          <div
                            className={`inventory-item-hover-wrap${activeWidget === item.key ? ' is-open' : ''}`}
                            onMouseEnter={() => enterInventoryItem(item.key)}
                            onMouseLeave={() => leaveInventoryItem(item.key)}
                          >
                            {audience === 'client' && !referenceMode && (
                              <label className="inventory-item">
                                <input
                                  type="checkbox"
                                  aria-label={`Sélectionner ${item.label}`}
                                  checked={entry.quantity > 0}
                                  onChange={(event) =>
                                    setEntry(item.key, {
                                      quantity: event.target.checked ? 1 : 0,
                                      size: entry.size || item.defaultSize || 1,
                                    })
                                  }
                                />
                              </label>
                            )}
                            <InventoryItemLabel
                              estimate={(audience === 'admin' || referenceMode
                                ? referenceItemSubline
                                : inventoryItemEstimate)(
                                item,
                                entry.size || item.defaultSize || 1,
                                entry.format ?? 'medium',
                                entry.dismantle,
                                entry.quantity,
                              )}
                              label={
                                <button
                                  type="button"
                                  className="inventory-item-name"
                                  aria-expanded={activeWidget === item.key}
                                  aria-label={
                                    audience === 'admin' || referenceMode
                                      ? `Ajouter ${item.label}`
                                      : `Voir les formats de ${item.label}`
                                  }
                                  onClick={() => {
                                    if (audience === 'admin' || referenceMode) {
                                      setEntry(item.key, {
                                        quantity: Math.min(999, entry.quantity + 1),
                                      });
                                    } else {
                                      setActiveWidget((value) =>
                                        value === item.key ? null : item.key,
                                      );
                                    }
                                  }}
                                >
                                  {item.label}
                                </button>
                              }
                            />
                            {activeWidget === item.key && (
                              <InventoryHoverCard
                                item={item}
                                format={entry.format ?? 'medium'}
                                size={entry.size || item.defaultSize || 1}
                                quantity={entry.quantity}
                                dismantle={entry.dismantle}
                                onSelectFormat={(format) => setEntry(item.key, { format })}
                                onSelectSize={(size) => setEntry(item.key, { size })}
                                historicalMaximum={historicalSizeMaximum[item.key]}
                              />
                            )}
                          </div>
                          {item.sizeLabel && (
                            <InventorySizeStepper
                              itemKey={item.key}
                              itemLabel={item.label}
                              sizeLabel={item.sizeLabel}
                              value={entry.size}
                              onChange={(size) => setEntry(item.key, { size })}
                              showLabel={audience === 'admin' || referenceMode}
                              historicalMaximum={historicalSizeMaximum[item.key]}
                            />
                          )}
                          {item.hasFormat && (
                            <InventoryFormatSelector
                              itemKey={item.key}
                              itemLabel={item.label}
                              value={entry.format ?? 'medium'}
                              onChange={(format) => setEntry(item.key, { format })}
                            />
                          )}
                          <label className="inventory-check inventory-dismantle">
                            <input
                              type="checkbox"
                              checked={entry.dismantle}
                              onChange={(event) =>
                                setEntry(item.key, { dismantle: event.target.checked })
                              }
                            />
                            <span>
                              Démontage / montage
                              {item.key !== 'climatiseur' && (
                                <small>
                                  {entry.dismantle
                                    ? `démonté : −${Math.round((1 - inventoryDismantleFactor(item.key)) * 100)} % de volume`
                                    : 'transporté monté'}
                                </small>
                              )}
                            </span>
                          </label>
                          {['salon', 'chaise'].includes(item.key) && (
                            <label className="inventory-check">
                              <input
                                type="checkbox"
                                checked={!!entry.menuisier}
                                onChange={(event) =>
                                  setEntry(item.key, { menuisier: event.target.checked })
                                }
                              />
                              Menuisier (pieds, accoudoirs)
                            </label>
                          )}
                          {!['carton', 'sac', 'gaz', 'pot'].includes(item.key) && (
                            <InventoryOriginToggle
                              value={entry.origin ?? 'local'}
                              onChange={(origin) => setEntry(item.key, { origin })}
                            />
                          )}
                          <div className="inventory-quantity">
                            <button
                              type="button"
                              aria-label={`Retirer ${item.label}`}
                              disabled={!entry.quantity}
                              onClick={() =>
                                setEntry(item.key, { quantity: Math.max(0, entry.quantity - 1) })
                              }
                            >
                              −
                            </button>
                            <output>{entry.quantity}</output>
                            <button
                              type="button"
                              aria-label={`Ajouter ${item.label}`}
                              onClick={() =>
                                setEntry(item.key, {
                                  quantity: Math.min(999, entry.quantity + 1),
                                  size: entry.size || item.defaultSize || 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                          {item.sizeLabel && (
                            <button
                              type="button"
                              className="inventory-variant-add"
                              onClick={() =>
                                update({
                                  ...inventory,
                                  variants: [
                                    ...inventory.variants,
                                    {
                                      id: crypto.randomUUID(),
                                      itemKey: item.key,
                                      quantity: 1,
                                      size: entry.size + 1,
                                      dismantle: entry.dismantle,
                                      menuisier: entry.menuisier,
                                      origin: entry.origin,
                                    },
                                  ],
                                })
                              }
                            >
                              {audience === 'admin' || referenceMode
                                ? `+ Ajouter ${['table-basse', 'table-manger', 'chaise', 'bibliotheque', 'vitrine', 'coiffeuse', 'commode', 'television', 'cuisiniere', 'machine-laver'].includes(item.key) ? 'une' : 'un'} ${item.label.toLowerCase()}`
                                : '+ Autre taille'}
                            </button>
                          )}
                        </div>
                        {inventory.variants
                          .filter((variant) => variant.itemKey === item.key)
                          .map((variant) => (
                            <div
                              className={
                                variant.quantity > 0
                                  ? 'inventory-row inventory-variant selected'
                                  : 'inventory-row inventory-variant'
                              }
                              key={variant.id}
                            >
                              <div
                                className={`inventory-item-hover-wrap${activeWidget === variant.id ? ' is-open' : ''}`}
                                onMouseEnter={() => enterInventoryItem(variant.id)}
                                onMouseLeave={() => leaveInventoryItem(variant.id)}
                              >
                                <InventoryItemLabel
                                  estimate={(audience === 'admin' || referenceMode
                                    ? referenceItemSubline
                                    : inventoryItemEstimate)(
                                    item,
                                    variant.size,
                                    variant.format ?? 'medium',
                                    variant.dismantle,
                                    variant.quantity,
                                  )}
                                  label={
                                    <button
                                      type="button"
                                      className="inventory-item-name"
                                      aria-expanded={activeWidget === variant.id}
                                      onClick={() => {
                                        if (audience === 'admin' || referenceMode) {
                                          update({
                                            ...inventory,
                                            variants: inventory.variants.map((line) =>
                                              line.id === variant.id
                                                ? {
                                                    ...line,
                                                    quantity: Math.min(999, line.quantity + 1),
                                                  }
                                                : line,
                                            ),
                                          });
                                        } else {
                                          setActiveWidget((value) =>
                                            value === variant.id ? null : variant.id,
                                          );
                                        }
                                      }}
                                    >
                                      {item.label}
                                    </button>
                                  }
                                />
                                {activeWidget === variant.id && (
                                  <InventoryHoverCard
                                    item={item}
                                    format={variant.format ?? 'medium'}
                                    size={variant.size}
                                    quantity={variant.quantity}
                                    dismantle={variant.dismantle}
                                    historicalMaximum={historicalSizeMaximum[item.key]}
                                    onSelectFormat={(format) =>
                                      update({
                                        ...inventory,
                                        variants: inventory.variants.map((line) =>
                                          line.id === variant.id ? { ...line, format } : line,
                                        ),
                                      })
                                    }
                                    onSelectSize={(size) =>
                                      update({
                                        ...inventory,
                                        variants: inventory.variants.map((line) =>
                                          line.id === variant.id ? { ...line, size } : line,
                                        ),
                                      })
                                    }
                                  />
                                )}
                              </div>
                              {item.sizeLabel && (
                                <InventorySizeStepper
                                  itemKey={item.key}
                                  itemLabel={item.label}
                                  sizeLabel={item.sizeLabel}
                                  value={variant.size}
                                  showLabel={audience === 'admin' || referenceMode}
                                  historicalMaximum={historicalSizeMaximum[item.key]}
                                  onChange={(size) =>
                                    update({
                                      ...inventory,
                                      variants: inventory.variants.map((line) =>
                                        line.id === variant.id ? { ...line, size } : line,
                                      ),
                                    })
                                  }
                                />
                              )}
                              <label className="inventory-check inventory-dismantle">
                                <input
                                  type="checkbox"
                                  checked={variant.dismantle}
                                  onChange={(event) =>
                                    update({
                                      ...inventory,
                                      variants: inventory.variants.map((line) =>
                                        line.id === variant.id
                                          ? { ...line, dismantle: event.target.checked }
                                          : line,
                                      ),
                                    })
                                  }
                                />
                                <span>
                                  Démontage / montage
                                  {item.key !== 'climatiseur' && (
                                    <small>
                                      {variant.dismantle
                                        ? `démonté : −${Math.round((1 - inventoryDismantleFactor(item.key)) * 100)} % de volume`
                                        : 'transporté monté'}
                                    </small>
                                  )}
                                </span>
                              </label>
                              {['salon', 'chaise'].includes(item.key) && (
                                <label className="inventory-check">
                                  <input
                                    type="checkbox"
                                    checked={!!variant.menuisier}
                                    onChange={(event) =>
                                      update({
                                        ...inventory,
                                        variants: inventory.variants.map((line) =>
                                          line.id === variant.id
                                            ? { ...line, menuisier: event.target.checked }
                                            : line,
                                        ),
                                      })
                                    }
                                  />
                                  Menuisier (pieds, accoudoirs)
                                </label>
                              )}
                              {!['carton', 'sac', 'gaz', 'pot'].includes(item.key) && (
                                <InventoryOriginToggle
                                  value={variant.origin ?? 'local'}
                                  onChange={(origin) =>
                                    update({
                                      ...inventory,
                                      variants: inventory.variants.map((line) =>
                                        line.id === variant.id ? { ...line, origin } : line,
                                      ),
                                    })
                                  }
                                />
                              )}
                              <div className="inventory-quantity">
                                <button
                                  type="button"
                                  onClick={() =>
                                    update({
                                      ...inventory,
                                      variants: inventory.variants.map((line) =>
                                        line.id === variant.id
                                          ? { ...line, quantity: Math.max(0, line.quantity - 1) }
                                          : line,
                                      ),
                                    })
                                  }
                                >
                                  −
                                </button>
                                <output>{variant.quantity}</output>
                                <button
                                  type="button"
                                  onClick={() =>
                                    update({
                                      ...inventory,
                                      variants: inventory.variants.map((line) =>
                                        line.id === variant.id
                                          ? { ...line, quantity: Math.min(999, line.quantity + 1) }
                                          : line,
                                      ),
                                    })
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                className="inventory-variant-add"
                                onClick={() =>
                                  update({
                                    ...inventory,
                                    variants: inventory.variants.filter(
                                      (line) => line.id !== variant.id,
                                    ),
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            </details>
          ))}
          {(audience === 'admin' || referenceMode) && inventory.custom.length > 0 && (
            <button
              type="button"
              className="inventory-custom-section-toggle"
              aria-expanded={openCustom}
              onClick={() => setOpenCustom((current) => !current)}
            >
              <span>Autres objets</span>
              <span>
                {inventory.custom.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                {inventory.custom.reduce((sum, item) => sum + item.quantity, 0) > 1
                  ? 'objets'
                  : 'objet'}
              </span>
            </button>
          )}
          <div
            className={
              (audience === 'admin' || referenceMode) && !openCustom
                ? 'inventory-custom-items is-closed'
                : 'inventory-custom-items'
            }
          >
            {inventory.custom.map((item) => (
              <div
                className={item.quantity > 0 ? 'inventory-row selected' : 'inventory-row'}
                key={item.id}
              >
                <div
                  className={`inventory-item-hover-wrap${activeWidget === item.id ? ' is-open' : ''}`}
                  onMouseEnter={() => enterInventoryItem(item.id)}
                  onMouseLeave={() => leaveInventoryItem(item.id)}
                >
                  <InventoryItemLabel
                    estimate={(audience === 'admin' || referenceMode ? referenceItemSubline : inventoryItemEstimate)(
                      {
                        key: 'custom',
                        label: item.label,
                        plural: item.label,
                        section: 'Autres objets',
                        hasFormat: true,
                      },
                      1,
                      item.format ?? 'medium',
                      Boolean(item.dismantle),
                      item.quantity,
                    )}
                    label={
                      <button
                        type="button"
                        className="inventory-item-name"
                        aria-expanded={activeWidget === item.id}
                        onClick={() => {
                          if (audience === 'admin' || referenceMode) {
                            update({
                              ...inventory,
                              custom: inventory.custom.map((line) =>
                                line.id === item.id
                                  ? { ...line, quantity: Math.min(999, line.quantity + 1) }
                                  : line,
                              ),
                            });
                          } else {
                            setActiveWidget((value) => (value === item.id ? null : item.id));
                          }
                        }}
                      >
                        {item.label}
                      </button>
                    }
                  />
                  {activeWidget === item.id && (
                    <InventoryHoverCard
                      item={{
                        key: 'custom',
                        label: item.label,
                        plural: item.label,
                        section: 'Autres objets',
                        hasFormat: true,
                    canDismantle: true,
                        volumeByFormat: [0.3, 0.5, 0.8],
                      }}
                      imageScope={`custom:${item.id}`}
                      format={item.format ?? 'medium'}
                      size={1}
                      quantity={item.quantity}
                      dismantle={Boolean(item.dismantle)}
                      onSelectFormat={(format) =>
                        update({
                          ...inventory,
                          custom: inventory.custom.map((line) =>
                            line.id === item.id ? { ...line, format } : line,
                          ),
                        })
                      }
                      onSelectSize={() => undefined}
                    />
                  )}
                </div>
                <InventoryFormatSelector
                  itemKey="custom"
                  itemLabel={item.label}
                  value={item.format ?? 'medium'}
                  onChange={(format) =>
                    update({
                      ...inventory,
                      custom: inventory.custom.map((line) =>
                        line.id === item.id ? { ...line, format } : line,
                      ),
                    })
                  }
                />
                <label className="inventory-check">
                  <input
                    type="checkbox"
                    checked={Boolean(item.dismantle)}
                    onChange={(event) =>
                      update({
                        ...inventory,
                        custom: inventory.custom.map((line) =>
                          line.id === item.id ? { ...line, dismantle: event.target.checked } : line,
                        ),
                      })
                    }
                  />
                  Démontage / montage
                </label>
                <InventoryOriginToggle
                  value={item.origin ?? 'local'}
                  onChange={(origin) =>
                    update({
                      ...inventory,
                      custom: inventory.custom.map((line) =>
                        line.id === item.id ? { ...line, origin } : line,
                      ),
                    })
                  }
                />
                <div className="inventory-quantity">
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        ...inventory,
                        custom: inventory.custom.map((line) =>
                          line.id === item.id
                            ? { ...line, quantity: Math.max(0, line.quantity - 1) }
                            : line,
                        ),
                      })
                    }
                  >
                    −
                  </button>
                  <output>{item.quantity}</output>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        ...inventory,
                        custom: inventory.custom.map((line) =>
                          line.id === item.id
                            ? { ...line, quantity: Math.min(999, line.quantity + 1) }
                            : line,
                        ),
                      })
                    }
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className={
                    audience === 'admin' || referenceMode
                      ? 'inventory-variant-add'
                      : 'button secondary small'
                  }
                  title={audience === 'admin' || referenceMode ? 'Retirer' : undefined}
                  onClick={() =>
                    update({
                      ...inventory,
                      custom: inventory.custom.filter((line) => line.id !== item.id),
                    })
                  }
                >
                  {audience === 'admin' || referenceMode ? '×' : 'Supprimer'}
                </button>
              </div>
            ))}
          </div>
          <div className="inventory-custom">
            <label>
              {audience === 'client' && !referenceMode && 'Autre objet'}
              <input
                maxLength={120}
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Autre objet (ex. piano, aquarium…)"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomItem();
                  }
                }}
              />
            </label>
            <button type="button" className="button secondary small" onClick={addCustomItem}>
              Ajouter
            </button>
          </div>
          <div className="inventory-flags">
            {inventoryFlags.map((flag) =>
              audience === 'admin' || referenceMode ? (
                <button
                  type="button"
                  key={flag.key}
                  className={inventory.flags[flag.key] ? 'inventory-flag active' : 'inventory-flag'}
                  aria-pressed={!!inventory.flags[flag.key]}
                  onClick={() =>
                    update({
                      ...inventory,
                      flags: { ...inventory.flags, [flag.key]: !inventory.flags[flag.key] },
                    })
                  }
                >
                  {inventory.flags[flag.key] ? '✓ ' : ''}
                  {flag.label}
                </button>
              ) : (
                <label className="inventory-check" key={flag.key}>
                  <input
                    type="checkbox"
                    checked={!!inventory.flags[flag.key]}
                    onChange={(event) =>
                      update({
                        ...inventory,
                        flags: { ...inventory.flags, [flag.key]: event.target.checked },
                      })
                    }
                  />
                  {flag.label}
                </label>
              ),
            )}
          </div>
          {audience === 'admin' || referenceMode ? (
            <div className="inventory-note-preview">
              {referenceInventoryNote(inventory, draft.fromAddress, draft.toAddress)}
              {currentEstimate?.volume
                ? `\n${referenceMovingEstimateNote(currentEstimate, draft.route?.distanceKm ?? 0, laborPlanning?.maxDayHours)}`
                : ''}
            </div>
          ) : (
            <label className="inventory-note-label">
              Rempli automatiquement dans le devis et le PDF
              <textarea
                readOnly
                rows={Math.min(10, Math.max(3, total + 3))}
                value={inventoryNote(inventory)}
              />
            </label>
          )}
          {(audience === 'client' || hasVolume) && (
            <MovingPlanningPanel
              draft={draft}
              setDraft={setDraft}
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              trips={quoteTrips}
              maxTrips={maxTrips}
              onApply={onApplyEstimate}
              laborPlanning={laborPlanning}
              trafficDurationMinutes={trafficDurationMinutes}
              volumeDetail={volumeDetail}
              inventoryChecks={inventoryChecks}
              labourPriceEditor={labourPriceEditor}
              estimateInventory={estimateInventory}
            />
          )}
          <div className="inventory-footer">
            {audience === 'client' && !referenceMode && (
              <span>
                Les lits, armoires et bureaux cochés « Démontage / montage » sont facturés.
              </span>
            )}
            <button type="button" className="button secondary small" onClick={clearInventory}>
              Vider la fiche
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
