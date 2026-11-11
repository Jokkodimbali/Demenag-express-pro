import { useRef, useState } from 'react';
import { useApp } from '../../../shared/application/context';
import type { Catalogue, RentalKitConfigurationItem } from '../../../shared/domain/model';
import { defaultRentalKitConfiguration } from '../../../moving/domain/rental-kit';
import { referenceSettingsText as text } from '../../../shared/content/reference-settings-text';

const ruleOptions: { value: RentalKitConfigurationItem['rule']; label: string }[] = [
  { value: 'vehicle', label: text.vehicleRule },
  { value: 'one', label: text.oneRule },
  { value: 'blankets', label: text.blanketsRule },
  { value: 'liftingStraps', label: text.liftingStrapsRule },
  { value: 'gloves', label: text.glovesRule },
  { value: 'tieDownStraps', label: text.tieDownStrapsRule },
  { value: 'fixed', label: text.fixedRule },
];

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(text.imageReadError));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(text.imageReadError));
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error(text.imageInvalidError));
      image.onload = () => {
        const scale = Math.min(1, 700 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error(text.imageProcessingError));
          return;
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function RentalKitSettings({ catalogue }: { catalogue: Catalogue }) {
  const configured = catalogue.settings.rentalKitConfiguration ?? [];
  const [items, setItems] = useState<RentalKitConfigurationItem[]>(() =>
    (configured.length ? configured : defaultRentalKitConfiguration).map((item) => ({ ...item })),
  );
  const [imageError, setImageError] = useState('');
  const countInput = useRef<HTMLInputElement>(null);
  const { requestConfirmation } = useApp();
  const notifyForm = () =>
    countInput.current?.dispatchEvent(new Event('change', { bubbles: true }));
  const vehicleImage =
    catalogue.vehicles.find((vehicle) => vehicle.id === 'sprinter')?.image ??
    catalogue.vehicles[0]?.image ??
    '';

  function updateItem(index: number, patch: Partial<RentalKitConfigurationItem>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function moveItem(index: number) {
    if (index === 0) return;
    setItems((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    window.setTimeout(notifyForm, 0);
  }

  function removeItem(index: number) {
    setItems((current) => {
      const remaining = current.filter((_, itemIndex) => itemIndex !== index);
      return remaining.length
        ? remaining
        : defaultRentalKitConfiguration.map((item) => ({ ...item }));
    });
    window.setTimeout(notifyForm, 0);
  }

  async function restoreDefaults() {
    const confirmed = await requestConfirmation({
      titleId: 'rental-kit-reset',
      eyebrow: text.materialResetEyebrow,
      title: text.materialResetTitle,
      description: text.materialResetDescription,
      confirmLabel: text.reset,
    });
    if (!confirmed) return;
    setItems(defaultRentalKitConfiguration.map((item) => ({ ...item })));
    window.setTimeout(notifyForm, 0);
  }

  async function chooseImage(index: number, file: File | undefined) {
    if (!file) return;
    setImageError('');
    try {
      updateItem(index, { image: await compressImage(file) });
      window.setTimeout(notifyForm, 0);
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : text.imageSaveError);
    }
  }

  return (
    <section className="reference-settings-wide reference-settings-card reference-rental-kit-card">
      <div className="reference-settings-section-heading">
        <span className="reference-settings-card-title">{text.rentalKitTitle}</span>
        <button
          type="button"
          className="reference-settings-outline-button"
          onClick={restoreDefaults}
        >
          {text.rentalKitDefaults}
        </button>
      </div>
      <span className="reference-settings-description">{text.rentalKitDescription}</span>
      <input
        ref={countInput}
        type="hidden"
        name="rentalKitConfiguration.count"
        value={items.length}
      />
      {imageError && (
        <p className="reference-rental-kit-error" role="alert">
          {imageError}
        </p>
      )}
      <div className="reference-rental-kit-list">
        {items.map((item, index) => {
          const image = item.rule === 'vehicle' ? vehicleImage : item.image;
          const canEditImage = item.rule !== 'vehicle';
          return (
            <div className="reference-rental-kit-row" key={item.id}>
              <label
                className="reference-rental-kit-image"
                aria-label={`${text.imageFor} ${item.label}`}
              >
                {image ? <img src={image} alt="" /> : <span>{text.imagePlaceholder}</span>}
                {canEditImage && (
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={`${text.importImageFor} ${item.label}`}
                    onChange={(event) => {
                      void chooseImage(index, event.currentTarget.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                )}
              </label>
              <div className="reference-rental-kit-fields">
                <div className="reference-rental-kit-title-row">
                  <input
                    name={`rentalKitConfiguration.${index}.label`}
                    value={item.label}
                    onChange={(event) => updateItem(index, { label: event.target.value })}
                    aria-label={`${text.materialName} ${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    title={text.moveUp}
                    aria-label={`${text.moveUp} ${item.label}`}
                    onClick={() => moveItem(index)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="remove"
                    title={text.remove}
                    aria-label={`${text.remove} ${item.label}`}
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </button>
                </div>
                <div className="reference-rental-kit-rule-row">
                  <select
                    name={`rentalKitConfiguration.${index}.rule`}
                    value={item.rule}
                    onChange={(event) =>
                      updateItem(index, {
                        rule: event.target.value as RentalKitConfigurationItem['rule'],
                      })
                    }
                    aria-label={`${text.quantityRuleFor} ${item.label}`}
                  >
                    {ruleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {item.rule === 'fixed' && (
                    <input
                      name={`rentalKitConfiguration.${index}.quantity`}
                      type="number"
                      min="0"
                      value={item.quantity ?? 1}
                      onChange={(event) =>
                        updateItem(index, {
                          quantity: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      aria-label={`${text.fixedQuantityFor} ${item.label}`}
                    />
                  )}
                  {canEditImage && item.image && (
                    <button
                      type="button"
                      className="reference-rental-kit-remove-image"
                      onClick={() => updateItem(index, { image: '' })}
                    >
                      {text.removeImage}
                    </button>
                  )}
                </div>
                <input type="hidden" name={`rentalKitConfiguration.${index}.id`} value={item.id} />
                <input
                  type="hidden"
                  name={`rentalKitConfiguration.${index}.image`}
                  value={item.image ?? ''}
                />
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="reference-rental-kit-add"
        onClick={() => {
          setItems((current) => [
            ...current,
            {
              id: `kit-${crypto.randomUUID()}`,
              label: text.newMaterial,
              rule: 'fixed',
              quantity: 1,
            },
          ]);
          window.setTimeout(notifyForm, 0);
        }}
      >
        {text.addMaterial}
      </button>
    </section>
  );
}
