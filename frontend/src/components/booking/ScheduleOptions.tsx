import { Minus, Plus } from 'lucide-react';
import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';
import { money, today } from '../../domain/format';
import type { Catalogue } from '../../domain/model';
import { TollRateSelector } from '../TollRateSelector';

export function ScheduleOptions({
  catalogue,
  draft,
  setDraft,
  extras,
  option,
  administrativeQuote = false,
  tollLines = [],
  setTollLines,
  referenceMode = false,
}: Pick<BookingViewState, 'catalogue' | 'draft' | 'setDraft' | 'extras' | 'option'> & {
  catalogue: Catalogue;
  administrativeQuote?: boolean;
  tollLines?: { id: string; label: string; quantity: number; unitPrice: number }[];
  setTollLines?: React.Dispatch<
    React.SetStateAction<{ id: string; label: string; quantity: number; unitPrice: number }[]>
  >;
  referenceMode?: boolean;
}) {
  return (
    <section className="panel">
      {!referenceMode && (
        <div className="step-title">
          <span>{messages.text3}</span>
          <div>
            <h3>{messages.dateEtOptions}</h3>
            <p>{messages.unDemenagementQuiSAdapteAVosBesoins}</p>
          </div>
        </div>
      )}
      {referenceMode && <h3 className="reference-edit-options-title">OPTIONS ET QUANTITÉS</h3>}
      <div className="field-pair">
        <div>
          <label htmlFor="booking-date">{messages.dateSouhaitee}</label>
          <input
            id="booking-date"
            type="date"
            min={referenceMode ? undefined : today()}
            max={
              referenceMode
                ? undefined
                : new Date(Date.now() + catalogue.settings.maxAdvanceDays * 86400000)
                    .toISOString()
                    .slice(0, 10)
            }
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="booking-slot">Heure souhaitée</label>
          <input
            id="booking-slot"
            type="time"
            step="60"
            required={Boolean(draft.date)}
            value={draft.timeSlot}
            onChange={(e) => setDraft((d) => ({ ...d, timeSlot: e.target.value }))}
          />
          {!referenceMode && (
            <small className="muted">
              Choisissez l’heure qui vous convient. L’équipe confirmera le rendez-vous.
            </small>
          )}
        </div>
      </div>
      <div className="options">
        {extras.map(([key, label, description]) => (
          <div className="option-row" key={key}>
            <div>
              <strong>{label}</strong>
              <span>
                {description} ·{' '}
                {money(
                  key === 'labour'
                    ? catalogue.settings.labourPrice
                    : catalogue.settings.assemblyPrice,
                )}
              </span>
            </div>
            <div className="stepper">
              <button
                type="button"
                aria-label={'Retirer : ' + label}
                onClick={() => option(key, -1)}
                disabled={draft.options[key] === 0}
              >
                <Minus size={16} />
              </button>
              <output aria-label={label}>{draft.options[key]}</output>
              <button
                type="button"
                aria-label={'Ajouter : ' + label}
                onClick={() => option(key, 1)}
                disabled={draft.options[key] >= catalogue.settings.maxOptions}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {administrativeQuote && setTollLines && (
        <div className="booking-toll-options">
          <TollRateSelector
            lines={tollLines}
            onToggle={(line, selected) =>
              setTollLines((current) =>
                selected
                  ? [...current.filter((existing) => existing.id !== line.id), line]
                  : current.filter((existing) => existing.id !== line.id),
              )
            }
          />
        </div>
      )}
    </section>
  );
}
