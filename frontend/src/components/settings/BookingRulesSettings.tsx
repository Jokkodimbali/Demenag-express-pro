import type { Catalogue } from '../../domain/model';
export function BookingRulesSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div className="panel">
      <h2>RÈGLES DE RÉSERVATION</h2>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="bookingsEnabled"
          defaultChecked={catalogue.settings.bookingsEnabled !== false}
        />
        Accepter de nouvelles réservations
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="clientCancellation"
          defaultChecked={catalogue.settings.clientCancellation !== false}
        />
        Autoriser l’annulation par le client
      </label>
      <div className="field-pair">
        {(
          [
            ['maxAdvanceDays', 'Horizon de réservation (jours)', 1, 730, 366],
            ['minNoticeHours', 'Délai avant réservation (heures)', 0, 720, 0],
            ['maxOptions', 'Quantité maximale par option', 0, 20, 20],
            ['maxTrips', 'Nombre maximal de trajets par devis', 1, 20, 20],
            ['cancellationNoticeHours', 'Préavis d’annulation client (heures)', 0, 720, 0],
          ] as const
        ).map(([key, label, min, max, fallback]) => (
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
              defaultValue={catalogue.settings[key] ?? fallback}
            />
          </div>
        ))}
      </div>
      <fieldset>
        <legend>Créneaux ouverts (au moins un)</legend>
        {['Matin (8h – 12h)', 'Après-midi (13h – 17h)', 'Soir (17h – 20h)'].map((slot) => (
          <label className="checkbox-label" key={slot}>
            <input
              type="checkbox"
              name="enabledSlots"
              value={slot}
              defaultChecked={
                !catalogue.settings.enabledSlots || catalogue.settings.enabledSlots.includes(slot)
              }
            />
            {slot}
          </label>
        ))}
      </fieldset>
      <p className="caption">
        Les tarifs déjà acceptés sont conservés dans la réservation et ses devis. Les nouvelles
        limites de réservation s’appliquent aux prochaines demandes.
      </p>
    </div>
  );
}
