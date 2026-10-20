import { useState } from 'react';
import { messages } from '../../content/fr';
import type { Catalogue } from '../../domain/model';
export function BookingRulesSettings({ catalogue }: { catalogue: Catalogue }) {
  const [slots, setSlots] = useState(() =>
    catalogue.settings.enabledSlots.map((slot, id) => ({ ...slot, id })),
  );
  return (
    <div className="panel">
      <h2>{messages.reglesDeReservation}</h2>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="bookingsEnabled"
          defaultChecked={catalogue.settings.bookingsEnabled !== false}
        />
        {messages.accepterDeNouvellesReservations}
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="clientCancellation"
          defaultChecked={catalogue.settings.clientCancellation !== false}
        />
        {messages.autoriserLAnnulationParLeClient}
      </label>
      <div className="field-pair">
        {(
          [
            ['maxAdvanceDays', messages.horizonDeReservationJours, 1, 730],
            ['maxOptions', messages.quantiteMaximaleParOption, 0, 20],
            ['maxTrips', messages.nombreMaximalDeTrajetsParDevis, 1, 20],
          ] as const
        ).map(([key, label, min, max]) => (
          <div key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              type="number"
              id={key}
              name={key}
              min={min}
              max={max}
              step={1}
              required
              defaultValue={catalogue.settings[key]}
            />
          </div>
        ))}
      </div>
      <fieldset>
        <legend>Horaires de référence</legend>
        <p className="muted">
          Ces horaires servent de repères. Le client peut choisir librement une autre heure.
        </p>
        <input type="hidden" name="slotCount" value={slots.length} />
        {slots.map((slot, index) => (
          <div className="field-pair" key={slot.id}>
            <div>
              <label htmlFor={`slot-label-${index}`}>{messages.creneauSouhaite}</label>
              <input
                id={`slot-label-${index}`}
                name={`slotLabel-${index}`}
                defaultValue={slot.label}
                required
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor={`slot-hour-${index}`}>{messages.heureDeDebut}</label>
              <input
                id={`slot-hour-${index}`}
                name={`slotHour-${index}`}
                type="number"
                min={0}
                max={23}
                step={1}
                defaultValue={slot.startHour}
                required
              />
            </div>
            <button
              type="button"
              className="button secondary small"
              onClick={() =>
                setSlots((current) => current.filter((currentSlot) => currentSlot.id !== slot.id))
              }
            >
              Supprimer
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary small"
          disabled={slots.length >= 24}
          onClick={() =>
            setSlots((current) => [
              ...current,
              { id: Math.max(-1, ...current.map((slot) => slot.id)) + 1, label: '', startHour: 12 },
            ])
          }
        >
          Ajouter une heure suggérée
        </button>
      </fieldset>
      <p className="caption">{messages.lesTarifsDejaAcceptesSontConservesDansLa}</p>
    </div>
  );
}
