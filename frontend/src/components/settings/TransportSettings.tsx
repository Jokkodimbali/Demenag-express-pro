import { useState, type CSSProperties } from 'react';
import { FleetVehicleDimensions } from '../FleetVehicleDimensions';
import { useApp } from '../../application/context';
import { errorMessage } from '../../application/error-message';
import { CatalogueService } from '../../application/services/catalogue';
import type { Catalogue, LabourMatrixScenario } from '../../domain/model';
import { inventoryItems } from '../../domain/inventory';
import { ReferenceVehicleSettings } from './ReferenceVehicleSettings';
import { ReferenceWhatsappSettings } from './ReferenceWhatsappSettings';

const tiers = ['Moins de 15 km', '15 – 25 km', '25 – 35 km'];
const scenarios: { id: LabourMatrixScenario; label: string; from: boolean; to: boolean }[] = [
  { id: 'none', label: 'Sans ascenseur', from: false, to: false },
  { id: 'from', label: 'Ascenseur au départ', from: true, to: false },
  { id: 'to', label: "Ascenseur à l'arrivée", from: false, to: true },
  { id: 'both', label: 'Ascenseur des deux côtés', from: true, to: true },
];
const floors = ['RDC', '1er', '2e', '3e', '4e', '5e'];
const planningDefaults = {
  maxHandlingHours: 3,
  maxDayHours: 8,
  defaultStartHour: 8,
  maxMoversPerVehicle: 6,
  cubicMetersPerHourPerMover: 2.5,
  pauseMinutes: 30,
};
const planningFields = [
  [
    'maxHandlingHours',
    'Plafond chargement + déchargement (h)',
    'Le nombre de manœuvres est calculé pour tenir ce temps.',
  ],
  [
    'maxDayHours',
    'Plafond de la journée (h)',
    'Au-delà, la fiche propose un autre véhicule, 2 véhicules ou 2 jours.',
  ],
  [
    'defaultStartHour',
    'Heure de début par défaut',
    'Utilisée si le créneau du devis n’est pas précisé.',
  ],
  [
    'maxMoversPerVehicle',
    'Manœuvres maximum par véhicule',
    'Au-delà, ils se gênent dans l’escalier et le camion.',
  ],
  [
    'cubicMetersPerHourPerMover',
    'Cadence de chargement (m³ / h / manœuvre)',
    'Meubles au rez-de-chaussée. Cartons ×1,4, objets lourds ×0,72.',
  ],
  ['pauseMinutes', 'Pause si la journée dépasse 5 h (min)', '0 pour ne pas compter de pause.'],
] as const;
const sectionStyle: CSSProperties = {
  background: '#272a2e',
  border: '1px solid #3b4046',
  borderRadius: 'clamp(14px, 4vw, 20px)',
  padding: 'clamp(14px, 4vw, 22px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};
const inputStyle: CSSProperties = {
  background: '#1e2023',
  border: '1px solid #3b4046',
  borderRadius: 10,
  padding: 11,
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  outline: 'none',
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
};
const lineStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(90px, 150px)',
  gap: 10,
  alignItems: 'center',
};
const sizeRanges: Record<string, [number, number]> = {
  salon: [1, 10],
  'table-manger': [2, 12],
  lit: [1, 4],
  matelas: [1, 4],
  armoire: [1, 8],
};

function amount(value: number) {
  return Math.round(value || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function TransportSettings({ catalogue }: { catalogue: Catalogue }) {
  const [scenario, setScenario] = useState<LabourMatrixScenario>('none');
  const [dimensionBusy, setDimensionBusy] = useState(false);
  const [dimensionError, setDimensionError] = useState('');
  const { api, setCatalogue } = useApp();
  const selected = scenarios.find((entry) => entry.id === scenario)!;
  const rows = inventoryItems
    .filter((item) => item.key !== 'climatiseur')
    .map((item) => {
      const key = item.key;
      const pricing = catalogue.settings.montageP?.[key] ?? {};
      const range = item.sizeLabel
        ? (sizeRanges[item.key] ?? [1, (item.defaultSize ?? 1) + 3])
        : null;
      return { item, key, pricing, range };
    });
  const floorSupplement = catalogue.settings.labourFloorPrice ?? 500;
  const liftSupplement = catalogue.settings.labourLiftPrice ?? 500;
  const vehicles = catalogue.vehicles;
  const planning = { ...planningDefaults, ...catalogue.settings.movingLaborPlanning };

  async function saveVehicleDimensions(vehicle: Catalogue['vehicles'][number]) {
    setDimensionBusy(true);
    setDimensionError('');
    try {
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, vehicle));
    } catch (cause) {
      setDimensionError(errorMessage(cause));
      throw cause;
    } finally {
      setDimensionBusy(false);
    }
  }

  return (
    <div className="reference-settings-page">
      <div className="reference-settings-grid">
        {catalogue.vehicles.map((vehicle) => (
          <section style={sectionStyle} key={vehicle.id}>
            <span className="reference-settings-card-title">{vehicle.name} · par aller-retour</span>
            {tiers.map((label, index) => (
              <label style={lineStyle} key={label}>
                <span>{label}</span>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  name={`${vehicle.id}-${index}`}
                  defaultValue={vehicle.prices[index]}
                />
              </label>
            ))}
          </section>
        ))}

        <section className="reference-settings-wide" style={sectionStyle}>
          <span className="reference-settings-card-title">Suppléments fixes</span>
          <label style={lineStyle}>
            <span>Manœuvre (par personne)</span>
            <input
              style={inputStyle}
              type="number"
              min="0"
              name="labourPrice"
              defaultValue={catalogue.settings.labourPrice}
            />
          </label>
          <label style={lineStyle}>
            <span>Supplément par étage sans ascenseur (par manœuvre)</span>
            <input
              style={inputStyle}
              type="number"
              min="0"
              name="labourFloorPrice"
              defaultValue={floorSupplement}
            />
          </label>
          <label style={lineStyle}>
            <span>Forfait avec ascenseur, dès le 1er (par manœuvre)</span>
            <input
              style={inputStyle}
              type="number"
              min="0"
              name="labourLiftPrice"
              defaultValue={liftSupplement}
            />
          </label>
          <input type="hidden" name="assembly" value={catalogue.settings.assemblyPrice} />

          <span className="reference-settings-kicker">
            DÉMONTAGE / MONTAGE PAR MEUBLE (PRIX CLIENT)
          </span>
          <div className="reference-settings-price-matrix">
            <span /> <span className="reference-settings-column-title">Local</span>
            <span className="reference-settings-column-title">Importé</span>
            {rows.map(({ item, key, pricing, range }, index) => {
              const previous = rows[index - 1];
              const local = pricing.local ?? catalogue.settings.assemblyPrice;
              const imported = pricing.import ?? Math.round(local * 1.5);
              const sizeLabel = item.sizeLabel ?? '';
              return (
                <div className="reference-settings-item-group" key={key}>
                  {(!previous || previous.item.section !== item.section) && (
                    <strong className="reference-settings-category">
                      {item.section.toUpperCase()}
                    </strong>
                  )}
                  <div className="reference-settings-price-row">
                    <span>
                      {item.label}
                      {range ? ` (${item.defaultSize} ${sizeLabel})` : ''}
                    </span>
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      name={`montageP.${key}.local`}
                      defaultValue={local}
                      aria-label={`${item.label}, local`}
                    />
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      name={`montageP.${key}.import`}
                      defaultValue={imported}
                      aria-label={`${item.label}, importé`}
                    />
                  </div>
                  {range && (
                    <div className="reference-settings-size-row">
                      <div className="reference-settings-size-labels">
                        <span>Local</span>
                        <span>Importé</span>
                      </div>
                      {Array.from({ length: range[1] - range[0] + 1 }, (_, offset) => {
                        const size = range[0] + offset;
                        const savedSize = pricing.sz?.[String(size)];
                        const priceAtSize = (origin: 'local' | 'import') =>
                          savedSize?.[origin] ??
                          (origin === 'local' ? local : imported) +
                            Math.max(0, size - (item.defaultSize ?? 1)) *
                              (origin === 'local'
                                ? (pricing.u ?? 0)
                                : (pricing.uI ?? pricing.u ?? 0));
                        return (
                          <div className="reference-settings-size-card" key={size}>
                            <span>
                              {size} {size === 1 ? sizeLabel.replace(/s$/, '') : sizeLabel}
                            </span>
                            <input
                              style={inputStyle}
                              type="number"
                              min="0"
                              name={`montageP.${key}.sz.${size}.local`}
                              defaultValue={priceAtSize('local')}
                              aria-label={`${item.label}, ${size} ${sizeLabel}, local`}
                            />
                            <input
                              style={inputStyle}
                              type="number"
                              min="0"
                              name={`montageP.${key}.sz.${size}.import`}
                              defaultValue={priceAtSize('import')}
                              aria-label={`${item.label}, ${size} ${sizeLabel}, importé`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="reference-settings-item-group">
              <strong className="reference-settings-category">AUTRES OBJETS</strong>
              <div className="reference-settings-price-row">
                <span>Autre objet</span>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  name="montageP.custom.local"
                  defaultValue={
                    catalogue.settings.montageP?.custom?.local ?? catalogue.settings.assemblyPrice
                  }
                  aria-label="Autre objet, local"
                />
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  name="montageP.custom.import"
                  defaultValue={
                    catalogue.settings.montageP?.custom?.import ??
                    Math.round(catalogue.settings.assemblyPrice * 1.5)
                  }
                  aria-label="Autre objet, importé"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="reference-settings-wide" style={sectionStyle}>
          <div className="reference-settings-section-heading">
            <span className="reference-settings-card-title">Grille de prix des manœuvres</span>
            <span>Base + supplément départ + supplément arrivée</span>
          </div>
          <div
            className="reference-settings-scenarios"
            role="group"
            aria-label="Scénario ascenseur"
          >
            {scenarios.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={scenario === entry.id ? 'active' : ''}
                onClick={() => setScenario(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="reference-settings-grid-scroll">
            <div className="reference-settings-labour-grid">
              <div className="reference-settings-axis">Départ ↓ · Arrivée →</div>
              {floors.map((floor) => (
                <strong className="reference-settings-col" key={floor}>
                  {floor}
                </strong>
              ))}
              {floors.map((fromFloor, fromIndex) => (
                <div className="reference-settings-labour-row" key={fromFloor}>
                  <strong>{fromFloor}</strong>
                  {floors.map((_, toIndex) => {
                    const extra = (floor: number, hasLift: boolean) =>
                      floor <= 0 ? 0 : hasLift ? liftSupplement : floor * floorSupplement;
                    const value =
                      catalogue.settings.labourPrice +
                      extra(fromIndex, selected.from) +
                      extra(toIndex, selected.to);
                    return <span key={toIndex}>{amount(value)}</span>;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="reference-settings-wide" style={sectionStyle}>
          <span className="reference-settings-card-title">Dimensions des véhicules</span>
          {dimensionError && (
            <p role="alert" className="alert error">
              {dimensionError}
            </p>
          )}
          {vehicles.map((vehicle) => (
            <FleetVehicleDimensions
              key={vehicle.id}
              vehicle={vehicle}
              disabled={dimensionBusy}
              onSave={saveVehicleDimensions}
              management={null}
            />
          ))}
        </section>

        <section className="reference-settings-wide" style={sectionStyle}>
          <div className="reference-settings-section-heading">
            <span className="reference-settings-card-title">Main-d'œuvre et durées</span>
          </div>
          <div className="reference-settings-labor-fields">
            {planningFields.map(([key, label, hint]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  style={inputStyle}
                  type="number"
                  min={
                    key === 'maxDayHours'
                      ? 1
                      : key === 'maxMoversPerVehicle'
                        ? 2
                        : key === 'cubicMetersPerHourPerMover'
                          ? 0.1
                          : key === 'pauseMinutes'
                            ? 0
                            : key === 'defaultStartHour'
                              ? 0
                              : 0.5
                  }
                  max={
                    key === 'maxHandlingHours'
                      ? 12
                      : key === 'maxDayHours'
                        ? 16
                        : key === 'defaultStartHour'
                          ? 23
                          : key === 'maxMoversPerVehicle'
                            ? 20
                            : key === 'cubicMetersPerHourPerMover'
                              ? 50
                              : 180
                  }
                  required
                  step={
                    key === 'cubicMetersPerHourPerMover' ||
                    key === 'maxHandlingHours' ||
                    key === 'maxDayHours'
                      ? '0.5'
                      : 1
                  }
                  name={`movingLaborPlanning.${key}`}
                  defaultValue={planning[key]}
                />
                <small>{hint}</small>
              </label>
            ))}
          </div>
          <button
            className="reference-settings-reset"
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.form;
              for (const [key, ,] of planningFields) {
                const input = form?.elements.namedItem(`movingLaborPlanning.${key}`);
                if (input instanceof HTMLInputElement) input.value = String(planningDefaults[key]);
              }
              form?.requestSubmit();
            }}
          >
            Revenir aux valeurs par défaut
          </button>
        </section>

        <ReferenceVehicleSettings catalogue={catalogue} />
        <ReferenceWhatsappSettings catalogue={catalogue} />
      </div>
    </div>
  );
}
