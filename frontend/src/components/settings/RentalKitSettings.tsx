import type { Catalogue } from '../../domain/model';
import { defaultRentalKitConfiguration } from '../../domain/rental-kit';
import { useRef, useState } from 'react';

export function RentalKitSettings({ catalogue }: { catalogue: Catalogue }) {
  const configured = catalogue.settings.rentalKitConfiguration ?? [];
  const [items, setItems] = useState(() =>
    (configured.length ? configured : defaultRentalKitConfiguration).map((item) => ({ ...item })),
  );
  const countInput = useRef<HTMLInputElement>(null);
  const notifyForm = () =>
    countInput.current?.dispatchEvent(new Event('change', { bubbles: true }));
  return (
    <section className="reference-settings-page reference-invoice-settings">
      <div className="reference-settings-grid">
        <section className="reference-settings-wide reference-settings-card">
          <div className="reference-settings-section-heading">
            <span className="reference-settings-card-title">
              Location avec chauffeur · matériel fourni
            </span>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setItems(defaultRentalKitConfiguration.map((item) => ({ ...item })));
                window.setTimeout(notifyForm, 0);
              }}
            >
              Valeurs par défaut
            </button>
          </div>
          <input
            ref={countInput}
            type="hidden"
            name="rentalKitConfiguration.count"
            value={items.length}
          />
          <div className="reference-rental-kit-settings">
            {items.map((item, index) => (
              <div key={item.id}>
                <label>
                  <span>Matériel</span>
                  <input
                    name={`rentalKitConfiguration.${index}.label`}
                    defaultValue={item.label}
                    required
                  />
                </label>
                <label>
                  <span>Règle de quantité</span>
                  <select name={`rentalKitConfiguration.${index}.rule`} defaultValue={item.rule}>
                    <option value="vehicle">Véhicule (1)</option>
                    <option value="one">Quantité 1</option>
                    <option value="blankets">Serviettes du plan de chargement</option>
                    <option value="liftingStraps">1 paire pour 2 manœuvres</option>
                    <option value="gloves">1 par manœuvre</option>
                    <option value="tieDownStraps">Sangles du plan de chargement</option>
                    <option value="fixed">Quantité fixe</option>
                  </select>
                </label>
                <label>
                  <span>Quantité fixe</span>
                  <input
                    name={`rentalKitConfiguration.${index}.quantity`}
                    type="number"
                    min="0"
                    defaultValue={item.quantity ?? 1}
                  />
                </label>
                <label>
                  <span>Image (chemin ou URL)</span>
                  <input
                    name={`rentalKitConfiguration.${index}.image`}
                    defaultValue={item.image ?? ''}
                    placeholder="/assets/kit-…"
                  />
                </label>
                <label>
                  <span>Importer une image</span>
                  <input
                    name={`rentalKitConfiguration.${index}.imageFile`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
                <input type="hidden" name={`rentalKitConfiguration.${index}.id`} value={item.id} />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setItems((current) => current.filter((_, rowIndex) => rowIndex !== index));
                    window.setTimeout(notifyForm, 0);
                  }}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setItems((current) => [
                ...current,
                { id: crypto.randomUUID(), label: 'Nouveau matériel', rule: 'fixed', quantity: 1 },
              ]);
              window.setTimeout(notifyForm, 0);
            }}
          >
            + Ajouter du matériel
          </button>
        </section>
      </div>
    </section>
  );
}
