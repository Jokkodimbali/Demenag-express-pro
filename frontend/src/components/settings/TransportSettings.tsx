import { messages } from '../../content/fr';
import { tierLabels } from '../../domain/format';
import type { Catalogue } from '../../domain/model';
export function TransportSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div className="panel">
      <h2>{messages.tarifsDeTransport}</h2>
      <p className="muted">{messages.prixEnFcfaParAllerRetourLesDevis}</p>
      <div className="field-pair">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <label htmlFor={'distance-' + i}>
              {messages.borneDeDistance}
              {i + 1}
              {messages.km3}
            </label>
            <input
              type="number"
              name={'distance-' + i}
              id={'distance-' + i}
              required
              min={1}
              max={1000}
              step={1}
              defaultValue={catalogue.settings.distanceBounds[i]}
            />
          </div>
        ))}
      </div>
      <div className="tariff-grid">
        {catalogue.vehicles.map((v) => (
          <div className="tariff-card" key={v.id}>
            <img src={v.image} alt={messages.text} />
            <label htmlFor={v.id + '-name'}>{messages.nomDuVehicule}</label>
            <input
              id={v.id + '-name'}
              name={v.id + '-name'}
              required
              minLength={2}
              maxLength={100}
              defaultValue={v.name}
            />
            <label className="checkbox-label">
              <input type="checkbox" name={v.id + '-active'} defaultChecked={v.active !== false} />
              {messages.disponibleALaReservation}
            </label>
            {tierLabels(catalogue.settings.distanceBounds)
              .slice(0, 3)
              .map((label, i) => (
                <div key={label}>
                  <label htmlFor={v.id + '-' + i}>{label}</label>
                  <input
                    id={v.id + '-' + i}
                    name={v.id + '-' + i}
                    type="number"
                    min={1}
                    max={10000000}
                    step={1}
                    required
                    defaultValue={v.prices[i]}
                  />
                </div>
              ))}
            <p className="caption">
              {messages.auDelaDe}
              {catalogue.settings.distanceBounds[2]}
              {messages.kmTarifPersonnaliseSurDevis}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
