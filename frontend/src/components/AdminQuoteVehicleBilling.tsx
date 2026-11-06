import { useState } from 'react';
import { money } from '../domain/format';
import { adminQuoteVehicleText as t } from '../content/admin-quote-vehicle';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue } from '../domain/model';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminQuoteVehicleBilling({
  model,
  catalogue,
}: {
  model: Model;
  catalogue: Catalogue;
}) {
  const {
    quoteConfig,
    setQuoteConfig,
    draft,
    setDraft,
    movingEstimate,
    rentalKit,
    rentalOvertimeAmount,
  } = model;
  const [newKitItem, setNewKitItem] = useState('');
  return (
    <>
      {quoteConfig.billingMode === 'driver-rental' && (
        <section className="admin-quote-billing admin-quote-card" aria-label={t.billing}>
          <h3>{t.billing}</h3>
          <div className="admin-quote-rental-details" aria-label={t.rentalMaterial}>
            <p>{t.rentalDescription}</p>
            <div className="admin-quote-rental-heading">
              <strong>{t.providedEquipment}</strong>
              {quoteConfig.rentalKit !== null && (
                <button
                  type="button"
                  onClick={() => setQuoteConfig((current) => ({ ...current, rentalKit: null }))}
                >
                  {t.recommendedList}
                </button>
              )}
            </div>
            <div className="admin-quote-rental-items">
              {rentalKit.map((item, index) => (
                <div className="admin-quote-rental-item" key={`${item.id}-${index}`}>
                  <span>{item.label}</span>
                  <button
                    type="button"
                    aria-label={`Diminuer ${item.label}`}
                    disabled={item.quantity <= 0}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.map((entry, itemIndex) =>
                          itemIndex === index
                            ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
                            : entry,
                        ),
                      }))
                    }
                  >
                    −
                  </button>
                  <strong>{item.quantity}</strong>
                  <button
                    type="button"
                    aria-label={`Augmenter ${item.label}`}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.map((entry, itemIndex) =>
                          itemIndex === index ? { ...entry, quantity: entry.quantity + 1 } : entry,
                        ),
                      }))
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${item.label}`}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="admin-quote-rental-add">
              <input
                value={newKitItem}
                onChange={(event) => setNewKitItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addKitItem();
                }}
                placeholder={t.addEquipmentPlaceholder}
                aria-label={t.addMaterial}
              />
              <button type="button" onClick={addKitItem}>
                {t.addEquipment}
              </button>
            </div>
            <div className="admin-quote-rental-summary">
              <div>
                <span>{t.clientCrew}</span>
                <strong>
                  {movingEstimate?.crew || draft.options.labour || 2} {t.mover}
                  {(movingEstimate?.crew || draft.options.labour || 2) === 1 ? '' : 's'}
                </strong>
              </div>
              <div>
                <span>{t.forecastSchedule}</span>
                <strong>
                  {movingEstimate
                    ? `${movingEstimate.startTime} → ${movingEstimate.endTime} (${Math.floor(movingEstimate.totalMinutes / 60)} h${movingEstimate.totalMinutes % 60 ? ` ${String(movingEstimate.totalMinutes % 60).padStart(2, '0')}` : ''})`
                    : 'Remplissez l’inventaire'}
                </strong>
              </div>
            </div>
            <div className="admin-quote-rental-overtime">
              <strong>
                {t.overtimePrefix} {money(catalogue.settings.rentalOvertimeHourlyRate ?? 10000)}{' '}
                {t.overtimeHour}{' '}
                {money(Math.round((catalogue.settings.rentalOvertimeHourlyRate ?? 10000) / 60))}{' '}
                {t.overtimeMinute}
              </strong>
              <span>{t.overtimeObserved}</span>
              <button
                type="button"
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: Math.max(0, (current.overtimeMinutes ?? 0) - 5),
                  }))
                }
              >
                −
              </button>
              <b>
                {quoteConfig.overtimeMinutes ?? 0} {t.minutes}
              </b>
              <button
                type="button"
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: (current.overtimeMinutes ?? 0) + 5,
                  }))
                }
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: (current.overtimeMinutes ?? 0) + 30,
                  }))
                }
              >
                {t.addThirtyMinutes}
              </button>
              <strong>
                {rentalOvertimeAmount ? `+ ${money(rentalOvertimeAmount)}` : 'Aucun dépassement'}
              </strong>
            </div>
          </div>
        </section>
      )}
      <section
        className="admin-quote-team-calculation admin-quote-card"
        aria-label={t.teamAndCalculation}
      >
        <h3>{t.teamAndCalculation}</h3>
        <p>
          {quoteConfig.calcMode === 'manual'
            ? 'Vous fixez les manœuvres, allers-retours et durée de trajet. L’inventaire ne les modifie plus. Le véhicule reste libre.'
            : 'L’inventaire calcule les allers-retours et conseille le nombre de manœuvres. Le véhicule reste libre.'}
        </p>
        <div className="admin-quote-team-values">
          <div className="admin-quote-calculation-value">
            <span>{t.crew}</span>
            <div>
              <button
                type="button"
                aria-label={t.decreaseCrew}
                disabled={(draft.options.labour || movingEstimate?.crew || 1) <= 1}
                onClick={() => updateCrew(-1)}
              >
                −
              </button>
              <strong>{movingEstimate?.crew || draft.options.labour || 1}</strong>
              <button
                type="button"
                aria-label={t.increaseCrew}
                disabled={
                  (draft.options.labour || movingEstimate?.crew || 1) >=
                  catalogue.settings.maxOptions
                }
                onClick={() => updateCrew(1)}
              >
                +
              </button>
            </div>
          </div>
          {quoteConfig.calcMode === 'manual' && (
            <>
              <div className="admin-quote-calculation-value">
                <span>{t.trips}</span>
                <div>
                  <button
                    type="button"
                    aria-label={t.decreaseTrips}
                    disabled={quoteConfig.trips <= 1}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        trips: Math.max(1, current.trips - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <strong>{quoteConfig.trips}</strong>
                  <button
                    type="button"
                    aria-label={t.increaseTrips}
                    disabled={quoteConfig.trips >= Math.min(30, catalogue.settings.maxTrips)}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        trips: Math.min(30, catalogue.settings.maxTrips, current.trips + 1),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
              {Boolean(model.route) && (
                <div className="admin-quote-calculation-value">
                  <span>{t.leg}</span>
                  <div>
                    <button
                      type="button"
                      aria-label={t.decreaseLeg}
                      disabled={quoteConfig.legMinutes <= 5}
                      onClick={() =>
                        setQuoteConfig((current) => ({
                          ...current,
                          legMinutes: Math.max(5, (current.legMinutes || 10) - 5),
                        }))
                      }
                    >
                      −
                    </button>
                    <strong>
                      {quoteConfig.legMinutes || 10} {t.minutes}
                    </strong>
                    <button
                      type="button"
                      aria-label={t.increaseLeg}
                      disabled={quoteConfig.legMinutes >= 600}
                      onClick={() =>
                        setQuoteConfig((current) => ({
                          ...current,
                          legMinutes: Math.min(600, (current.legMinutes || 10) + 5),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {quoteConfig.calcMode === 'manual' && movingEstimate && (
          <span className="admin-quote-team-advice">
            {t.advisedByInventory} {movingEstimate.recommendedCrew} {t.movers}{' '}
            {movingEstimate.trips} {t.roundTrips}
          </span>
        )}
      </section>
    </>
  );

  function addKitItem() {
    const label = newKitItem.trim();
    if (!label) return;
    const configured = catalogue.settings.rentalKitConfiguration?.find(
      (item) => item.label.toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr'),
    );
    setQuoteConfig((current) => ({
      ...current,
      billingMode: 'driver-rental',
      rentalKit: [
        ...rentalKit,
        {
          id: configured?.id ?? `custom-${crypto.randomUUID()}`,
          label: configured?.label ?? label.charAt(0).toLocaleUpperCase('fr') + label.slice(1),
          quantity: configured?.rule === 'fixed' ? (configured.quantity ?? 1) : 1,
          ...(configured?.image ? { image: configured.image } : {}),
        },
      ],
    }));
    setNewKitItem('');
  }

  function updateCrew(delta: number) {
    setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }));
    setDraft((current) => {
      const crew = Math.max(
        1,
        Math.min(
          catalogue.settings.maxOptions,
          (current.options.labour || movingEstimate?.crew || 1) + delta,
        ),
      );
      return {
        ...current,
        options: { ...current.options, labour: crew },
        inventory: { ...current.inventory, crew },
      };
    });
  }
}
