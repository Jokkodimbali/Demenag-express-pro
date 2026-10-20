import { Minus, Plus } from 'lucide-react';
import type { BookingViewState } from '../../application/contracts/booking-view';
import { messages } from '../../content/fr';
import { money, today } from '../../domain/format';
import type { Catalogue } from '../../domain/model';

export function ScheduleOptions({
  catalogue,
  draft,
  setDraft,
  extras,
  option,
}: Pick<BookingViewState, 'catalogue' | 'draft' | 'setDraft' | 'extras' | 'option'> & {
  catalogue: Catalogue;
}) {
  return (
    <section className="panel">
      <div className="step-title">
        <span>{messages.text3}</span>
        <div>
          <h3>{messages.dateEtOptions}</h3>
          <p>{messages.unDemenagementQuiSAdapteAVosBesoins}</p>
        </div>
      </div>
      <div className="field-pair">
        <div>
          <label htmlFor="booking-date">{messages.dateSouhaitee}</label>
          <input
            id="booking-date"
            type="date"
            min={today()}
            max={new Date(Date.now() + catalogue.settings.maxAdvanceDays * 86400000)
              .toISOString()
              .slice(0, 10)}
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="booking-slot">Heure souhaitée</label>
          <input
            id="booking-slot"
            type="time"
            list="booking-time-suggestions"
            required={Boolean(draft.date)}
            value={/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.timeSlot) ? draft.timeSlot : ''}
            onChange={(e) => setDraft((d) => ({ ...d, timeSlot: e.target.value }))}
          />
          <datalist id="booking-time-suggestions">
            {catalogue.settings.enabledSlots.map((slot) => (
              <option
                key={slot.label}
                value={`${String(slot.startHour).padStart(2, '0')}:00`}
                label={slot.label}
              />
            ))}
          </datalist>
          <small className="muted">Choisissez une heure au format 24 h.</small>
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
    </section>
  );
}
