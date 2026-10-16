import { messages } from '../../content/fr';
import type { Catalogue } from '../../domain/model';
export function BookingRulesSettings({ catalogue }: { catalogue: Catalogue }) {
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
            ['minNoticeHours', messages.delaiAvantReservationHeures, 0, 720],
            ['maxOptions', messages.quantiteMaximaleParOption, 0, 20],
            ['maxTrips', messages.nombreMaximalDeTrajetsParDevis, 1, 20],
            ['cancellationNoticeHours', messages.preavisDAnnulationClientHeures, 0, 720],
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
        <legend>{messages.creneauxOuvertsAuMoinsUn}</legend>
        {catalogue.settings.enabledSlots.map((slot, index) => (
          <div className="field-pair" key={slot.label}>
            <label className="checkbox-label" htmlFor={`slot-active-${index}`}>
              <input
                type="checkbox"
                id={`slot-active-${index}`}
                name={`slotActive-${index}`}
                defaultChecked
              />
              {messages.creneauActif}
            </label>
            <div>
              <label htmlFor={`slot-label-${index}`}>{messages.creneauSouhaite}</label>
              <input
                id={`slot-label-${index}`}
                name={`slotLabel-${index}`}
                defaultValue={slot.label}
                required
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
                defaultValue={slot.startHour}
                required
              />
            </div>
          </div>
        ))}
      </fieldset>
      <p className="caption">{messages.lesTarifsDejaAcceptesSontConservesDansLa}</p>
    </div>
  );
}
