import { useState } from 'react';
import type { Draft } from '../../application/booking-draft';
import {
  inventoryFlags,
  inventoryItems,
  inventoryNote,
  blankInventory,
  type Inventory,
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

export function CallInventory({
  draft,
  setDraft,
  maxOptions,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  maxOptions: number;
}) {
  const [customLabel, setCustomLabel] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [open, setOpen] = useState(true);
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
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <strong>FICHE D’APPEL · INVENTAIRE</strong>
          <span>{total ? `${total} objet${total > 1 ? 's' : ''}` : 'Ouvrir la fiche'}</span>
        </summary>
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
                    dismantle: !!item.defaultDismantle,
                  };
                  return (
                    <div key={item.key}>
                      <div className="inventory-row">
                        <label className="inventory-item">
                          <input
                            type="checkbox"
                            checked={entry.quantity > 0}
                            onChange={(event) =>
                              setEntry(item.key, {
                                quantity: event.target.checked ? 1 : 0,
                                size: entry.size || item.defaultSize || 1,
                              })
                            }
                          />
                          {item.label}
                        </label>
                        {item.sizeLabel && (
                          <InventorySizeStepper
                            itemLabel={item.label}
                            sizeLabel={item.sizeLabel}
                            value={entry.size}
                            onChange={(size) => setEntry(item.key, { size })}
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
                            <span className="inventory-item">{item.label}</span>
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
                custom: [...inventory.custom, { id: crypto.randomUUID(), label, quantity: 1 }],
              });
              setCustomLabel('');
            }}
          >
            Ajouter
          </button>
        </div>
        {inventory.custom.map((item) => (
          <div className="inventory-row" key={item.id}>
            <strong>{item.label}</strong>
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
      </details>
    </section>
  );
}
