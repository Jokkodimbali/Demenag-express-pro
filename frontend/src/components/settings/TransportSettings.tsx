import { messages } from '../../content/fr';
import { tierLabels } from '../../domain/format';
import type { Catalogue } from '../../domain/model';
export function TransportSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div className="panel">
      <h2>{messages.tarifsDeTransport}</h2>
      <p className="muted">{messages.prixEnFcfaParAllerRetourLesDevis}</p>
      <div className="field-pair">
        <div>
          <label htmlFor="labour">{messages.manUvrePersonneFcfa}</label>
          <input
            id="labour"
            name="labour"
            type="number"
            min={0}
            max={1000000}
            step={1}
            required
            defaultValue={catalogue.settings.labourPrice}
          />
        </div>
        <div>
          <label htmlFor="assembly">{messages.menuisierMeubleFcfa}</label>
          <input
            id="assembly"
            name="assembly"
            type="number"
            min={0}
            max={1000000}
            step={1}
            required
            defaultValue={catalogue.settings.assemblyPrice}
          />
        </div>
      </div>
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
            <h3>{v.name}</h3>
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
