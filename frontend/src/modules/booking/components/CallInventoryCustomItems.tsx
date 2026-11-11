import { visibleUiText } from '../../shared/content/visible-ui-text';
import { uiText } from '../../shared/content/reference-ui-text';
import type { Dispatch, SetStateAction } from 'react';
import { inventoryItems, type Inventory } from '../../moving/domain/inventory/inventory';
import {
  inventoryItemEstimate,
  referenceItemSubline,
  InventoryItemLabel,
  InventoryOriginToggle,
  InventoryFormatSelector,
  InventoryHoverCard,
} from './CallInventoryWidgets';

type Props = {
  inventory: Inventory;
  update: (next: Inventory) => void;
  audience: 'admin' | 'client';
  referenceMode: boolean;
  openCustom: boolean;
  setOpenCustom: Dispatch<SetStateAction<boolean>>;
  activeWidget: string | null;
  setActiveWidget: Dispatch<SetStateAction<string | null>>;
  enterInventoryItem: (id: string) => void;
  leaveInventoryItem: (id: string) => void;
  customLabel: string;
  setCustomLabel: Dispatch<SetStateAction<string>>;
  addCustomItem: () => void;
};

export function CallInventoryCustomItems({
  inventory,
  update,
  audience,
  referenceMode,
  openCustom,
  setOpenCustom,
  activeWidget,
  setActiveWidget,
  enterInventoryItem,
  leaveInventoryItem,
}: Props) {
  return (
    <>
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
          <div className="inventory-custom-entry" key={item.id}>
            <div className={item.quantity > 0 ? 'inventory-row selected' : 'inventory-row'}>
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
            {(audience === 'admin' || referenceMode) && (
              <details className="inventory-custom-details">
                <summary>{visibleUiText.text161}</summary>
                <label>
                  {visibleUiText.text162}
                  <select
                    value={item.like ?? ''}
                    onChange={(event) =>
                      update({
                        ...inventory,
                        custom: inventory.custom.map((line) =>
                          line.id === item.id
                            ? { ...line, like: event.target.value || undefined }
                            : line,
                        ),
                      })
                    }
                  >
                    <option value="">{visibleUiText.text163}</option>
                    {inventoryItems.map((definition) => (
                      <option key={definition.key} value={definition.key}>
                        {definition.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="inventory-custom-dimensions">
                  {(['cL', 'cW', 'cH'] as const).map((key, index) => (
                    <label key={key}>
                      {['Longueur', 'Largeur', 'Hauteur'][index]} {visibleUiText.text164}
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={item[key] ?? ''}
                        onChange={(event) =>
                          update({
                            ...inventory,
                            custom: inventory.custom.map((line) =>
                              line.id === item.id
                                ? {
                                    ...line,
                                    [key]:
                                      event.target.value === ''
                                        ? undefined
                                        : Math.max(0, Number(event.target.value)),
                                  }
                                : line,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    {visibleUiText.text165}
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={item.kg ?? ''}
                      onChange={(event) =>
                        update({
                          ...inventory,
                          custom: inventory.custom.map((line) =>
                            line.id === item.id
                              ? {
                                  ...line,
                                  kg:
                                    event.target.value === ''
                                      ? undefined
                                      : Math.max(0, Number(event.target.value)),
                                }
                              : line,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    {visibleUiText.text166}
                    <input
                      type="number"
                      min={0}
                      max={10000000}
                      value={item.mp ?? ''}
                      onChange={(event) =>
                        update({
                          ...inventory,
                          custom: inventory.custom.map((line) =>
                            line.id === item.id
                              ? {
                                  ...line,
                                  mp:
                                    event.target.value === ''
                                      ? undefined
                                      : Math.max(0, Math.round(Number(event.target.value))),
                                }
                              : line,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="inventory-custom-constraints">
                  {(
                    [
                      ['up', 'Toujours debout'],
                      ['frag', 'Fragile'],
                      ['notop', 'Ne rien poser dessus'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(item[key])}
                        onChange={(event) =>
                          update({
                            ...inventory,
                            custom: inventory.custom.map((line) =>
                              line.id === item.id ? { ...line, [key]: event.target.checked } : line,
                            ),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <small>{visibleUiText.text167}</small>
              </details>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
