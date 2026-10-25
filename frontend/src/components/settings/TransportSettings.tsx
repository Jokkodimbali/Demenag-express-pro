import { messages } from '../../content/fr';
import { tierLabels } from '../../domain/format';
import type { Catalogue } from '../../domain/model';
import { useState } from 'react';
import { createLabourPriceMatrix, labourMatrixScenarios } from '../../domain/labour-price';

const floors = ['RDC', '1er', '2e', '3e', '4e', '5e'];

export function TransportSettings({ catalogue }: { catalogue: Catalogue }) {
  const [scenario, setScenario] = useState('none');
  const labourMatrix = createLabourPriceMatrix(catalogue.settings);
  const planning = {
    maxHandlingHours: 3,
    maxDayHours: 8,
    defaultStartHour: 8,
    maxMoversPerVehicle: 6,
    cubicMetersPerHourPerMover: 2.5,
    pauseMinutes: 30,
    ...catalogue.settings.movingLaborPlanning,
  };
  return (
    <div className="panel">
      <h2>{messages.tarifsDeTransport}</h2>
      <p className="muted">{messages.prixEnFcfaParAllerRetourLesDevis}</p>
      <div className="field-pair">
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
      <section className="manoeuvre-price-grid" aria-labelledby="manoeuvre-grid-title">
        <div>
          <h3 id="manoeuvre-grid-title">Grille de prix des manœuvres</h3>
          <p className="muted">
            Saisissez directement chaque prix en FCFA par personne. Choisissez le scénario
            d’ascenseur, modifiez les cases nécessaires puis enregistrez les paramètres.
          </p>
        </div>
        <div className="manoeuvre-scenarios" role="group" aria-label="Ascenseurs disponibles">
          {labourMatrixScenarios.map((item) => (
            <button
              className={scenario === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              aria-pressed={scenario === item.id}
              onClick={() => setScenario(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {labourMatrixScenarios.map((item) => (
          <div className="manoeuvre-grid-scroll" key={item.id} hidden={scenario !== item.id}>
            <table>
              <caption>
                Prix en FCFA par personne · {item.label} · modifiez directement chaque case
              </caption>
              <thead>
                <tr>
                  <th scope="col">Départ ↓ · Arrivée →</th>
                  {floors.map((floor) => (
                    <th scope="col" key={floor}>
                      {floor}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {floors.map((from, fromFloor) => (
                  <tr key={from}>
                    <th scope="row">{from}</th>
                    {floors.map((to, toFloor) => (
                      <td key={to}>
                        <input
                          aria-label={`Prix par manœuvre, départ ${from}, arrivée ${to}, ${item.label}`}
                          name={`labourMatrix.${item.id}.${fromFloor}.${toFloor}`}
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          required
                          defaultValue={labourMatrix[item.id][fromFloor][toFloor]}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
      <section className="manoeuvre-price-grid" aria-labelledby="moving-plan-settings-title">
        <div>
          <h3 id="moving-plan-settings-title">Paramètres du planning de déménagement</h3>
          <p className="muted">
            Ces paramètres pilotent l’estimation du nombre de manœuvres, du temps de manutention et
            de la durée. Ils ne changent pas le prix des réservations déjà enregistrées.
          </p>
        </div>
        <div className="field-pair">
          <label>
            Plafond chargement + déchargement (heures)
            <input
              name="movingLaborPlanning.maxHandlingHours"
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              required
              defaultValue={planning.maxHandlingHours}
            />
          </label>
          <label>
            Plafond de la journée (heures)
            <input
              name="movingLaborPlanning.maxDayHours"
              type="number"
              min="1"
              max="16"
              step="0.5"
              required
              defaultValue={planning.maxDayHours}
            />
          </label>
          <label>
            Heure de début par défaut
            <input
              name="movingLaborPlanning.defaultStartHour"
              type="number"
              min="0"
              max="23"
              step="1"
              required
              defaultValue={planning.defaultStartHour}
            />
          </label>
          <label>
            Manœuvres maximum par véhicule
            <input
              name="movingLaborPlanning.maxMoversPerVehicle"
              type="number"
              min="2"
              max="20"
              step="1"
              required
              defaultValue={planning.maxMoversPerVehicle}
            />
          </label>
          <label>
            Cadence au RDC (m³ / heure / manœuvre)
            <input
              name="movingLaborPlanning.cubicMetersPerHourPerMover"
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              required
              defaultValue={planning.cubicMetersPerHourPerMover}
            />
          </label>
          <label>
            Pause si la journée dépasse 5 h (minutes)
            <input
              name="movingLaborPlanning.pauseMinutes"
              type="number"
              min="0"
              max="180"
              step="5"
              required
              defaultValue={planning.pauseMinutes}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
