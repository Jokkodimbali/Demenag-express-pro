import { visibleUiText } from '../../content/visible-ui-text';
import { useEffect, useState } from 'react';
import { inventoryItems } from '../../domain/inventory';
import type { CustomInventoryType } from '../../domain/model';

type Props = {
  types: CustomInventoryType[];
  hiddenKeys: string[];
  onSave: (types: CustomInventoryType[], hiddenKeys: string[]) => Promise<void>;
};

const sections = [...new Set([...inventoryItems.map((item) => item.section), 'Autres objets'])];

export function InventoryCatalogSettings({ types, hiddenKeys, onSave }: Props) {
  const [draftTypes, setDraftTypes] = useState(types);
  const [draftHidden, setDraftHidden] = useState(hiddenKeys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftTypes(types);
    setDraftHidden(hiddenKeys);
  }, [types, hiddenKeys]);

  function patchType(index: number, patch: Partial<CustomInventoryType>) {
    setDraftTypes((current) =>
      current.map((type, i) => (i === index ? { ...type, ...patch } : type)),
    );
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave(draftTypes, draftHidden);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le catalogue n’a pas pu être enregistré.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="settings-inventory-catalog"
      aria-labelledby="settings-inventory-catalog-title"
      onChange={(event) => event.stopPropagation()}
    >
      <header>
        <div>
          <h2 id="settings-inventory-catalog-title">{visibleUiText.text180}</h2>
          <p>{visibleUiText.text181}</p>
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setDraftTypes((current) => [
              ...current,
              {
                k: `u${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
                n: 'Nouvel objet',
                sec: 'Autres objets',
              },
            ])
          }
        >
          {visibleUiText.text182}
        </button>
      </header>

      <details>
        <summary>
          {visibleUiText.text183}
          {inventoryItems.length})
        </summary>
        <div className="settings-inventory-hidden-list">
          {inventoryItems.map((item) => (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={!draftHidden.includes(item.key)}
                onChange={(event) =>
                  setDraftHidden((current) =>
                    event.target.checked
                      ? current.filter((key) => key !== item.key)
                      : [...current, item.key],
                  )
                }
              />
              {item.label}
            </label>
          ))}
        </div>
      </details>

      {draftTypes.map((type, index) => (
        <article className="settings-inventory-type" key={type.k}>
          <div className="settings-inventory-type-heading">
            <strong>
              {visibleUiText.text184}
              {index + 1}
            </strong>
            <button
              type="button"
              className="button secondary"
              onClick={() => setDraftTypes((current) => current.filter((_, i) => i !== index))}
            >
              {visibleUiText.text185}
            </button>
          </div>
          <div className="settings-inventory-type-fields">
            <label>
              {visibleUiText.text186}
              <input
                value={type.n}
                maxLength={100}
                onChange={(event) => patchType(index, { n: event.target.value })}
              />
            </label>
            <label>
              {visibleUiText.text101}
              <select
                value={type.sec}
                onChange={(event) => patchType(index, { sec: event.target.value })}
              >
                {sections.map((section) => (
                  <option key={section}>{section}</option>
                ))}
              </select>
            </label>
            <label>
              {visibleUiText.text187}
              <select
                value={type.like ?? ''}
                onChange={(event) => patchType(index, { like: event.target.value || undefined })}
              >
                <option value="">{visibleUiText.text163}</option>
                {inventoryItems
                  .filter((item) => !['carton', 'sac'].includes(item.key))
                  .map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </label>
            {(['L', 'W', 'H', 'kg', 'menuPriceLocal', 'menuPriceImport'] as const).map((key) => (
              <label key={key}>
                {key === 'kg'
                  ? 'Poids (kg)'
                  : key === 'menuPriceLocal'
                    ? 'Menuisier · local (FCFA)'
                    : key === 'menuPriceImport'
                      ? 'Menuisier · importé (FCFA)'
                      : `${key === 'L' ? 'Longueur' : key === 'W' ? 'Largeur' : 'Hauteur'} (cm)`}
                <input
                  type="number"
                  min={0}
                  max={key.startsWith('menuPrice') ? 10000000 : 100000}
                  value={type[key] ?? ''}
                  onChange={(event) =>
                    patchType(index, {
                      [key]:
                        event.target.value === '' ? '' : Math.max(0, Number(event.target.value)),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="settings-inventory-type-flags">
            {(
              [
                ['dm', 'Démontable'],
                ['up', 'Toujours debout'],
                ['frag', 'Fragile'],
                ['notop', 'Rien dessus'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(type[key])}
                  onChange={(event) => patchType(index, { [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </article>
      ))}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Enregistrement…' : 'Enregistrer le catalogue'}
      </button>
    </section>
  );
}
