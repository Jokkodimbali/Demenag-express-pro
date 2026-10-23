import { useEffect, useState } from 'react';
import type { Draft } from '../../application/booking-draft';
import {
  readInventoryIllustration,
  saveInventoryIllustration,
} from '../../application/inventory-illustrations';
import { MovingPlanningPanel } from './MovingPlanningPanel';
import type { Vehicle } from '../../domain/model';
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

const sections = [...new Set(inventoryItems.map((item) => item.section))];

function InventorySizeStepper({
  itemLabel,
  sizeLabel,
  value,
  onChange,
}: {
  itemLabel: string;
  sizeLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const label = value === 1 ? sizeLabel.replace(/s$/, '') : sizeLabel;
  return (
    <div className="inventory-size-stepper" role="group" aria-label={`Taille de ${itemLabel}`}>
      <button
        type="button"
        aria-label={`Réduire la taille de ${itemLabel}`}
        disabled={value <= 1}
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
        disabled={value >= 99}
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
}: {
  item: (typeof inventoryItems)[number];
  format: InventoryFormat;
  size: number;
  quantity: number;
  dismantle: boolean;
  onSelectFormat: (format: InventoryFormat) => void;
  onSelectSize: (size: number) => void;
  imageScope?: string;
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState('');
  const formatOptions = item.hasFormat ? inventoryFormats : [];
  const sizeOptions = item.sizeLabel
    ? [Math.max(1, size - 1), size, size + 1].map((value) => ({
        value,
        label: `${value} ${item.sizeLabel}`,
        hint: item.sizeName?.(value) ?? `${value} ${item.sizeLabel}`,
      }))
    : [];
  const selectedFormatIndex = inventoryFormats.findIndex((option) => option.value === format);
  const sizeVolumePerUnit: Record<string, number> = {
    salon: 0.6,
    lit: 0.5,
    matelas: 0.25,
    armoire: 0.8,
    'table-manger': 0.17,
  };
  const dismantleFactor: Record<string, number> = {
    lit: 0.6,
    armoire: 0.6,
    'table-manger': 0.6,
    bureau: 0.7,
  };
  const currentVolume =
    (item.sizeLabel
      ? (sizeVolumePerUnit[item.key] ?? 0.5) * size
      : (item.volumeByFormat?.[selectedFormatIndex] ?? 0.5)) *
    (dismantle ? (dismantleFactor[item.key] ?? (item.canDismantle ? 0.8 : 1)) : 1);
  const dismantlePercent = Math.round((1 - (dismantleFactor[item.key] ?? 0.8)) * 100);
  const volumeLabel = (volume: number) => `≈ ${volume.toFixed(2).replace('.', ',')} m³`;
  const scope = imageScope ?? item.key;
  useEffect(() => {
    const imageKeys = [
      ...(item.hasFormat
        ? inventoryFormats.map((option) => `${scope}:format:${option.value}`)
        : []),
      ...(item.sizeLabel
        ? [Math.max(1, size - 1), size, size + 1].map((value) => `${scope}:size:${value}`)
        : []),
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
  }, [scope, item.key, item.hasFormat, item.sizeLabel, size]);

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
      className="inventory-hover-image-upload"
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
      <strong className="inventory-hover-title">
        {item.label} ·{' '}
        {item.sizeLabel
          ? `${size} ${item.sizeLabel}`
          : (inventoryFormats.find((option) => option.value === format)?.label.toLowerCase() ??
            'standard')}
        {dismantle && item.canDismantle && <small>Démontable · −{dismantlePercent} %</small>}
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
      <div className="inventory-hover-selection">
        <strong>Votre sélection</strong>
        <span>
          {quantity} ×{' '}
          {item.sizeLabel
            ? `${size} ${item.sizeLabel}`
            : (inventoryFormats.find((option) => option.value === format)?.label.toLowerCase() ??
              'standard')}{' '}
          = {volumeLabel(currentVolume * quantity)}
        </span>
      </div>
      {item.tip && <p>{item.tip}</p>}
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
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  maxOptions: number;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  quoteTrips: number;
  maxTrips: number;
  onApplyEstimate: (vehicleId: string, trips: number) => void;
}) {
  const [customLabel, setCustomLabel] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [open, setOpen] = useState(true);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const dwellingTypes = ['Studio', 'F2', 'F3', 'F4', 'F5 et plus', 'Villa', 'Autre'];
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((section) => [section, true])),
  );
  const inventory = draft.inventory;
  const update = (next: Inventory) => {
    const assemblyCount = (value: Inventory, key: 'desk' | 'wardrobe' | 'bed') =>
      inventoryItems
        .filter((item) => item.assembly === key)
        .reduce((sum, item) => {
          const line = value.entries[item.key];
          return (
            sum +
            (line?.dismantle ? line.quantity : 0) +
            value.variants
              .filter((variant) => variant.itemKey === item.key && variant.dismantle)
              .reduce((count, variant) => count + variant.quantity, 0)
          );
        }, 0);
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
    setDraft((current) => {
      const options = { ...current.options };
      for (const key of ['desk', 'wardrobe', 'bed'] as const) {
        const difference = assemblyCount(next, key) - assemblyCount(current.inventory, key);
        options[key] = Math.max(0, Math.min(maxOptions, options[key] + difference));
      }
      return { ...current, inventory: next, options };
    });
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

  return (
    <section className="panel call-inventory">
      <div className="inventory-heading">
        <div>
          <strong>FICHE D’APPEL · INVENTAIRE</strong>
          <span>Cochez et comptez pendant l’appel, le devis se remplit tout seul.</span>
        </div>
        <button
          type="button"
          className="inventory-collapse"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Réduire' : 'Développer'}
        </button>
      </div>
      {open && (
        <div className="inventory-content">
          <p className="muted">
            Cochez et comptez pendant l’appel. Les montages de lit, armoire et bureau sélectionnés
            alimentent directement le devis.
          </p>
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
                      disabled={inventory[side === 'from' ? 'fromFloor' : 'toFloor'] >= 99}
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
              <strong>Type de logement</strong>
              <span>(facultatif)</span>
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
                  {type}
                </button>
              ))}
            </div>
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
              <summary>{section}</summary>
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
                        <div className="inventory-row">
                          <div
                            className={`inventory-item-hover-wrap${activeWidget === item.key ? ' is-open' : ''}`}
                            onMouseEnter={() => setActiveWidget(item.key)}
                            onMouseLeave={() =>
                              setActiveWidget((value) => (value === item.key ? null : value))
                            }
                          >
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
                            <button
                              type="button"
                              className="inventory-item-name"
                              aria-expanded={activeWidget === item.key}
                              aria-label={`Voir les formats de ${item.label}`}
                              onClick={() =>
                                setActiveWidget((value) => (value === item.key ? null : item.key))
                              }
                            >
                              {item.label}
                            </button>
                            {activeWidget === item.key && (
                              <InventoryHoverCard
                                item={item}
                                format={entry.format ?? 'medium'}
                                size={entry.size || item.defaultSize || 1}
                                quantity={entry.quantity}
                                dismantle={entry.dismantle}
                                onSelectFormat={(format) => setEntry(item.key, { format })}
                                onSelectSize={(size) => setEntry(item.key, { size })}
                              />
                            )}
                          </div>
                          {item.sizeLabel && (
                            <InventorySizeStepper
                              itemLabel={item.label}
                              sizeLabel={item.sizeLabel}
                              value={entry.size}
                              onChange={(size) => setEntry(item.key, { size })}
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
                          {(item.assembly || item.canDismantle) && (
                            <label className="inventory-check">
                              <input
                                type="checkbox"
                                checked={entry.dismantle}
                                onChange={(event) =>
                                  setEntry(item.key, { dismantle: event.target.checked })
                                }
                              />
                              Démontage / montage
                            </label>
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
                                  quantity: Math.min(99, entry.quantity + 1),
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
                                    },
                                  ],
                                })
                              }
                            >
                              + Autre taille
                            </button>
                          )}
                        </div>
                        {inventory.variants
                          .filter((variant) => variant.itemKey === item.key)
                          .map((variant) => (
                            <div className="inventory-row inventory-variant" key={variant.id}>
                              <div
                                className={`inventory-item-hover-wrap${activeWidget === variant.id ? ' is-open' : ''}`}
                                onMouseEnter={() => setActiveWidget(variant.id)}
                                onMouseLeave={() =>
                                  setActiveWidget((value) => (value === variant.id ? null : value))
                                }
                              >
                                <button
                                  type="button"
                                  className="inventory-item-name"
                                  aria-expanded={activeWidget === variant.id}
                                  onClick={() =>
                                    setActiveWidget((value) =>
                                      value === variant.id ? null : variant.id,
                                    )
                                  }
                                >
                                  {item.label}
                                </button>
                                {activeWidget === variant.id && (
                                  <InventoryHoverCard
                                    item={item}
                                    format={variant.format ?? 'medium'}
                                    size={variant.size}
                                    quantity={variant.quantity}
                                    dismantle={variant.dismantle}
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
                                  itemLabel={item.label}
                                  sizeLabel={item.sizeLabel}
                                  value={variant.size}
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
                              {item.assembly && (
                                <label className="inventory-check">
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
                                  Démontage / montage
                                </label>
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
                                          ? { ...line, quantity: Math.min(99, line.quantity + 1) }
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
          <div className="inventory-custom">
            <label>
              Autre objet
              <input
                maxLength={80}
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Ex. piano"
              />
            </label>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                const label = customLabel.trim();
                if (!label) return;
                update({
                  ...inventory,
                  custom: [
                    ...inventory.custom,
                    { id: crypto.randomUUID(), label, quantity: 1, format: 'medium' },
                  ],
                });
                setCustomLabel('');
              }}
            >
              Ajouter
            </button>
          </div>
          {inventory.custom.map((item) => (
            <div className="inventory-row" key={item.id}>
              <div
                className={`inventory-item-hover-wrap${activeWidget === item.id ? ' is-open' : ''}`}
                onMouseEnter={() => setActiveWidget(item.id)}
                onMouseLeave={() => setActiveWidget((value) => (value === item.id ? null : value))}
              >
                <button
                  type="button"
                  className="inventory-item-name"
                  aria-expanded={activeWidget === item.id}
                  onClick={() => setActiveWidget((value) => (value === item.id ? null : item.id))}
                >
                  {item.label}
                </button>
                {activeWidget === item.id && (
                  <InventoryHoverCard
                    item={{
                      key: 'custom',
                      label: item.label,
                      plural: item.label,
                      section: 'Autres objets',
                      hasFormat: true,
                      volumeByFormat: [0.3, 0.5, 0.8],
                    }}
                    imageScope={`custom:${item.id}`}
                    format={item.format ?? 'medium'}
                    size={1}
                    quantity={item.quantity}
                    dismantle={false}
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
                          ? { ...line, quantity: Math.min(99, line.quantity + 1) }
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
                className="button secondary small"
                onClick={() =>
                  update({
                    ...inventory,
                    custom: inventory.custom.filter((line) => line.id !== item.id),
                  })
                }
              >
                Supprimer
              </button>
            </div>
          ))}
          <div className="inventory-flags">
            {inventoryFlags.map((flag) => (
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
            ))}
          </div>
          <label className="inventory-note-label">
            Rempli automatiquement dans le devis et le PDF
            <textarea
              readOnly
              rows={Math.min(10, Math.max(3, total + 3))}
              value={inventoryNote(inventory)}
            />
          </label>
          <MovingPlanningPanel
            draft={draft}
            setDraft={setDraft}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            trips={quoteTrips}
            maxTrips={maxTrips}
            onApply={onApplyEstimate}
          />
          <div className="inventory-footer">
            <span>Les lits, armoires et bureaux cochés « Démontage / montage » sont facturés.</span>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                if (window.confirm('Vider la fiche d’appel ?')) update(blankInventory());
              }}
            >
              Vider la fiche
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
