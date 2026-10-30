import { uiText } from '../../content/reference-ui-text';
import { useCallInventory } from '../../application/controllers/useCallInventory';
import { MovingPlanningPanel } from './MovingPlanningPanel';
import { inventoryDismantleFactor } from '../../domain/moving-estimate';
import { inventoryFlags, inventoryItems, inventoryNote } from '../../domain/inventory';
import {
  referenceDwellingLabel,
  referenceDwellingVolume,
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../../domain/reference-inventory-note';
import type { CallInventoryProps } from './CallInventoryWidgets';

const sections = [...new Set(inventoryItems.map((item) => item.section))];
import {
  inventoryItemEstimate,
  referenceItemSubline,
  InventoryItemLabel,
  InventoryOriginToggle,
  InventorySizeStepper,
  InventoryFormatSelector,
  InventoryHoverCard,
} from './CallInventoryWidgets';

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
}: CallInventoryProps) {
  const {
    customLabel,
    setCustomLabel,
    inventoryError,
    open,
    setOpen,
    openCustom,
    setOpenCustom,
    activeWidget,
    setActiveWidget,
    enterInventoryItem,
    leaveInventoryItem,
    openSections,
    setOpenSections,
    inventory,
    historicalSizeMaximum,
    update,
    clearInventory,
    addCustomItem,
    setEntry,
    total,
    currentEstimate,
    hasVolume,
    annexVolume,
    volumeDetail,
    inventoryChecks,
    dwellingTypes,
  } = useCallInventory({
    draft,
    setDraft,
    maxOptions,
    vehicles,
    selectedVehicleId,
    quoteTrips,
    onApplyEstimate,
    laborPlanning,
    trafficDurationMinutes,
    estimateInventory,
    audience,
    referenceMode,
  });
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
              {uiText['lesMontagesDeLitArmoireEtBureauSelectionnesAlimententD']}
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
                    {uiText['etage']}
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
                  {uiText['ascenseur']}
                </label>
              </div>
            ))}
          </div>
          <div className="inventory-dwelling-type">
            <div>
              <strong>
                {uiText['typeDeLogement']}
                <span>{uiText['facultatif']}</span>
              </strong>
              {annexVolume > 0 && (audience === 'admin' || referenceMode) && (
                <span className="inventory-annex-volume">
                  + ≈ {annexVolume.toFixed(1).replace('.', ',')} {uiText['m³Annexes']}
                </span>
              )}
            </div>
            <div
              className="inventory-dwelling-options"
              role="group"
              aria-label={uiText['typeDeLogement2']}
            >
              <button
                type="button"
                aria-pressed={!inventory.dwellingType}
                className={!inventory.dwellingType ? 'active' : ''}
                onClick={() => update({ ...inventory, dwellingType: '' })}
              >
                {uiText['nonPrecise']}
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
                  {uiText['ajouterLesEffetsAnnexesForfait']}{' '}
                  {referenceDwellingLabel(inventory.dwellingType)} ≈{' '}
                  {String(referenceDwellingVolume(inventory.dwellingType)).replace('.', ',')}{' '}
                  {uiText['m³2']}
                  <small>{uiText['sacsVaisselleLingePetitsObjets']}</small>
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
                              {uiText['demontageMontage']}
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
                              {uiText['menuisierPiedsAccoudoirs']}
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
                                  {uiText['demontageMontage']}
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
                                  {uiText['menuisierPiedsAccoudoirs']}
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
              <span>{uiText['autresObjets']}</span>
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
                    estimate={(audience === 'admin' || referenceMode
                      ? referenceItemSubline
                      : inventoryItemEstimate)(
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
                  {uiText['demontageMontage']}
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
                placeholder={uiText['autreObjetExPianoAquarium']}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomItem();
                  }
                }}
              />
            </label>
            <button type="button" className="button secondary small" onClick={addCustomItem}>
              {uiText['ajouter']}
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
              {uiText['rempliAutomatiquementDansLeDevisEtLePDF']}
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
              <span>{uiText['lesLitsArmoiresEtBureauxCochesDemontageMontageSontFact']}</span>
            )}
            <button type="button" className="button secondary small" onClick={clearInventory}>
              {uiText['viderLaFiche']}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
