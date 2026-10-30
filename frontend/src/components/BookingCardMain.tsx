import { CalendarDays, MapPin } from 'lucide-react';
import { uiText } from '../content/reference-ui-text';
import { messages } from '../content/fr';
import { dateLabel, money } from '../domain/format';
import type { Booking, Price, Quote } from '../domain/model';
import type { Dispatch, SetStateAction } from 'react';

export function BookingCardMain({
  booking,
  admin,
  driverMode,
  clientPhoneLink,
  finalQuote,
  terminal,
  editingSchedule,
  setEditingSchedule,
  scheduleDate,
  setScheduleDate,
  scheduleSlot,
  setScheduleSlot,
  saveSchedule,
  busy,
  displayedQuote,
  displayedPrice,
}: {
  booking: Booking;
  admin: boolean;
  driverMode: boolean;
  clientPhoneLink: string;
  finalQuote: Quote | null | undefined;
  terminal: boolean;
  editingSchedule: boolean;
  setEditingSchedule: Dispatch<SetStateAction<boolean>>;
  scheduleDate: string;
  setScheduleDate: Dispatch<SetStateAction<string>>;
  scheduleSlot: string;
  setScheduleSlot: Dispatch<SetStateAction<string>>;
  saveSchedule: (date: string, slot: string) => Promise<boolean>;
  busy: boolean;
  displayedQuote: Quote | null | undefined;
  displayedPrice: Price;
}) {
  const b = booking;
  return (
    <div className="booking-card-main">
      <img src={b.vehicle.image} alt={messages.text} />
      <div>
        <h3>{admin || driverMode ? b.customerName : b.vehicle.name}</h3>
        {admin && (
          <p className="muted">
            {b.phone} · {b.vehicle.name}
          </p>
        )}
        {driverMode && (
          <p className="muted booking-driver-contact">
            {uiText['client2']}
            <a href={`tel:${clientPhoneLink}`}>{b.phone}</a> · {b.vehicle.name}
          </p>
        )}
        <p>
          <MapPin size={15} />
          <span>
            {b.fromAddress} → {b.toAddress}
          </span>
        </p>
        <p>
          <CalendarDays size={15} />
          {b.date ? `${dateLabel(b.date)} · ${b.timeSlot}` : 'Sans date de rendez-vous'}
        </p>
        {admin && !finalQuote && !terminal && (
          <button
            className="button text small"
            type="button"
            onClick={() => setEditingSchedule((value) => !value)}
          >
            {editingSchedule ? 'Fermer' : 'Modifier le rendez-vous'}
          </button>
        )}
        {admin && !finalQuote && !terminal && editingSchedule && (
          <form
            className="schedule-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await saveSchedule(scheduleDate, scheduleSlot)) setEditingSchedule(false);
            }}
          >
            <label>
              {uiText['dateDuRendezVous']}
              <input
                type="date"
                value={scheduleDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setScheduleDate(event.target.value)}
              />
            </label>
            {scheduleDate && (
              <label>
                {uiText['heureDuRendezVous']}
                <input
                  type="time"
                  step="60"
                  value={scheduleSlot}
                  onChange={(event) => setScheduleSlot(event.target.value)}
                  required
                />
              </label>
            )}
            <button className="button primary small" disabled={busy} type="submit">
              {uiText['enregistrer']}
            </button>
          </form>
        )}
      </div>
      <div className="booking-amount">
        <span>{displayedQuote ? 'Dernier devis' : 'Estimation'}</span>
        <strong>{money(displayedPrice.total)}</strong>
      </div>
    </div>
  );
}
