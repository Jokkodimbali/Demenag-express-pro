import { uiText } from '../../content/reference-ui-text';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FleetVehicleDimensions } from '../FleetVehicleDimensions';
import { useApp } from '../../application/context';
import { errorMessage } from '../../application/error-message';
import { labourUnitPrice } from '../../domain/labour-price';
import { referenceAssemblyPriceDefaults } from '../../../../shared/reference-assembly-price-defaults.js';
import { defaultMovingLaborPlanning } from '../../domain/moving-estimate';
import { CatalogueService } from '../../application/services/catalogue';
import type { Catalogue, LabourMatrixScenario } from '../../domain/model';
import { inventoryItems } from '../../domain/inventory';
import { referenceInventoryKey } from '../../domain/inventory-assembly';
import { ReferenceVehicleSettings } from './ReferenceVehicleSettings';
import { PaymentSettings } from './PaymentSettings';
import { ReferenceWhatsappSettings } from './ReferenceWhatsappSettings';
import { ReferenceGoogleMapsSettings } from './ReferenceGoogleMapsSettings';
import { QuestionnaireSettings } from './QuestionnaireSettings';
import { visibleUiText } from '../../content/visible-ui-text';
import { CompanyQuoteSettings } from './CompanyQuoteSettings';
import { RentalKitSettings } from './RentalKitSettings';
import { QuoteTermsSettings } from './QuoteTermsSettings';
import { ClaudeSettings } from './ClaudeSettings';
import { InventoryCatalogSettings } from './InventoryCatalogSettings';
import { TariffDocumentsSettings } from './TariffDocumentsSettings';
import { AssemblyResetButton } from './AssemblyResetButton';
import { useIntegrationSummary } from '../../application/controllers/useIntegrationSummary';
import type { CustomInventoryType } from '../../domain/model';

const tiers = ['Moins de 15 km', '15 – 25 km', '25 – 35 km'];
const scenarios: { id: LabourMatrixScenario; label: string; from: boolean; to: boolean }[] = [
  { id: 'none', label: 'Sans ascenseur', from: false, to: false },
  { id: 'from', label: 'Ascenseur au départ', from: true, to: false },
  { id: 'to', label: "Ascenseur à l'arrivée", from: false, to: true },
  { id: 'both', label: 'Ascenseur des deux côtés', from: true, to: true },
];
const floors = ['RDC', '1er', '2e', '3e', '4e', '5e'];
const planningDefaults = {
  ...defaultMovingLaborPlanning,
  blanketLengthCm: 204,
  blanketWidthCm: 184,
  blanketStock: 20,
};
const planningFields = [
  [
    'heat',
    'Pauses chaleur ISO 7243 (1 = oui, 0 = non)',
    'Pauses de récupération selon la chaleur (WBGT) du mois à Dakar.',
  ],
  [
    'wbgtAdj',
    'Correction WBGT (°C)',
    'Ajoutée aux valeurs mensuelles de Dakar (ex. +1 en plein soleil, −1 à l’ombre).',
  ],
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
    'maxTotalHours',
    'Durée maximale avant proposition de relève (h)',
    'Au-delà, prévoir une relève, deux véhicules ou deux jours.',
  ],
  [
    'metabolicReference',
    'Effort de référence (W/m²)',
    'Base ISO 8996 utilisée pour calculer le pourcentage d’effort.',
  ],
  [
    'effortGround',
    'Effort au rez-de-chaussée (W/m²)',
    'Intensité estimée du portage sur sol plat.',
  ],
  ['effortLift', 'Effort avec ascenseur (W/m²)', 'Intensité estimée du portage avec ascenseur.'],
  [
    'effortStairs',
    'Effort dans les escaliers (W/m²)',
    'Intensité de base du portage sans ascenseur.',
  ],
  [
    'effortPerFloor',
    'Majoration par étage (W/m²)',
    'Ajoutée à l’effort de base dans les escaliers.',
  ],
  ['effortMaximum', 'Effort maximal (W/m²)', 'Plafond appliqué au portage dans les escaliers.'],
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
  [
    'teamVolumePerMover',
    'Volume de base par manœuvre (m³)',
    'Utilisé pour le premier calcul de l’effectif conseillé.',
  ],
  [
    'tripSetupMinutes',
    'Mise en place par voyage (min)',
    'Ce temps est ajouté au chargement et au déchargement de chaque voyage.',
  ],
  [
    'handlingCalibration',
    'Coefficient de calage',
    'Multiplie les durées de chargement et de déchargement.',
  ],
  [
    'carryDistanceMeters',
    'Distance de portage de référence (m)',
    'Distance utilisée avec le poids transporté pour estimer l’effectif ISO.',
  ],
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
  tablem: [2, 12],
  lit: [1, 4],
  matelas: [1, 4],
  armoire: [1, 8],
};

function amount(value: number) {
  return Math.round(value || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function TransportSettings({
  catalogue,
  onSaveInventoryCatalog,
  onResetTariffs,
  onResetAssembly,
  resetRevision,
}: {
  catalogue: Catalogue;
  onSaveInventoryCatalog: (types: CustomInventoryType[], hiddenKeys: string[]) => Promise<void>;
  onResetTariffs: () => Promise<boolean>;
  onResetAssembly: () => Promise<boolean>;
  resetRevision: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState<LabourMatrixScenario>('none');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [dimensionBusy, setDimensionBusy] = useState(false);
  const [dimensionError, setDimensionError] = useState('');
  const [resettingTariffs, setResettingTariffs] = useState(false);
  const [resetTariffsStatus, setResetTariffsStatus] = useState('');
  const [resetTariffsError, setResetTariffsError] = useState('');
  const { api, setCatalogue, requestConfirmation } = useApp();
  const { claudeConnected, mapsConfigured, setClaudeConnected, setMapsConfigured } =
    useIntegrationSummary();
  const selected = scenarios.find((entry) => entry.id === scenario)!;
  const customConfigured = catalogue.settings.montageP?.custom;
  const customPricing =
    typeof customConfigured === 'number'
      ? { local: customConfigured, import: Math.round(customConfigured * 1.5) }
      : (customConfigured ?? {});
  const rows = inventoryItems
    .filter((item) => item.key !== 'climatiseur')
    .map((item) => {
      const key = referenceInventoryKey(item.key);
      const configuredValue =
        catalogue.settings.montageP?.[key] ?? catalogue.settings.montageP?.[item.key];
      const configured =
        typeof configuredValue === 'number'
          ? { local: configuredValue, import: Math.round(configuredValue * 1.5) }
          : configuredValue;
      const referencePricing =
        referenceAssemblyPriceDefaults[key as keyof typeof referenceAssemblyPriceDefaults];
      const pricing = (configured ?? referencePricing ?? {}) as {
        local?: number;
        import?: number;
        u?: number;
        uI?: number;
        sz?: Record<string, { local?: number; import?: number }>;
      };
      const range = item.sizeLabel ? (sizeRanges[key] ?? [1, (item.defaultSize ?? 1) + 3]) : null;
      return { item, key, pricing, range };
    });
  const assemblySections = Array.from(
    new Map(
      rows.map(({ item }) => [
        item.section,
        rows.filter((row) => row.item.section === item.section),
      ]),
    ),
  );
  const assemblyColumns = [
    [assemblySections[0], assemblySections[3]].filter(Boolean),
    [assemblySections[1], assemblySections[2]].filter(Boolean),
  ];
  const floorSupplement = catalogue.settings.labourFloorPrice ?? 500;
  const liftSupplement = catalogue.settings.labourLiftPrice ?? 500;
  const referenceVehicleOrder = ['sprinter', 'trafic', 'master'];
  const vehicles = [...catalogue.vehicles].sort((left, right) => {
    const leftIndex = referenceVehicleOrder.indexOf(left.id);
    const rightIndex = referenceVehicleOrder.indexOf(right.id);
    return (
      (leftIndex < 0 ? referenceVehicleOrder.length : leftIndex) -
      (rightIndex < 0 ? referenceVehicleOrder.length : rightIndex)
    );
  });
  const planning = { ...planningDefaults, ...catalogue.settings.movingLaborPlanning };
  const [blanketLengthCm, setBlanketLengthCm] = useState(planning.blanketLengthCm);
  const [blanketWidthCm, setBlanketWidthCm] = useState(planning.blanketWidthCm);
  const [blanketStock, setBlanketStock] = useState(planning.blanketStock);
  useEffect(() => {
    setBlanketLengthCm(planning.blanketLengthCm);
    setBlanketWidthCm(planning.blanketWidthCm);
    setBlanketStock(planning.blanketStock);
  }, [planning.blanketLengthCm, planning.blanketWidthCm, planning.blanketStock]);
  useEffect(() => {
    if (resetRevision) rootRef.current?.closest('form')?.reset();
  }, [resetRevision]);

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

  const groupLabels = [
    ['tarifs', 'Tarifs'],
    ['veh', 'Véhicules'],
    ['ops', 'Opérations'],
    ['docs', 'Documents'],
    ['integ', 'Intégrations'],
  ] as const;
  const anyGroupOpen = groupLabels.some(([key]) => openGroups[key]);
  const paymentMethods =
    [
      catalogue.settings.paymentWave !== false ? 'Wave' : '',
      catalogue.settings.paymentCash !== false ? 'espèces' : '',
    ]
      .filter(Boolean)
      .join(' et ') || 'aucun mode de paiement';
  const openGroup = (key: string) => {
    setOpenGroups((current) => ({ ...current, [key]: true }));
    window.setTimeout(
      () =>
        document
          .getElementById(`settings-${key}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50,
    );
  };
  async function resetReferenceTariffs() {
    const confirmed = await requestConfirmation({
      titleId: 'reference-tariff-reset-confirmation',
      eyebrow: visibleUiText.pricingResetConfirmEyebrow,
      title: visibleUiText.pricingResetConfirmTitle,
      description: visibleUiText.pricingResetConfirmDescription,
      confirmLabel: visibleUiText.pricingResetConfirmLabel,
    });
    if (!confirmed) return;
    setResettingTariffs(true);
    setResetTariffsStatus('');
    setResetTariffsError('');
    try {
      const succeeded = await onResetTariffs();
      if (succeeded) setResetTariffsStatus(visibleUiText.pricingResetSuccess);
    } catch (cause) {
      setResetTariffsError(errorMessage(cause));
    } finally {
      setResettingTariffs(false);
    }
  }
  const group = (
    key: string,
    number: number,
    title: string,
    summary: string,
    children: React.ReactNode,
  ) => (
    <section className="reference-settings-group" id={`settings-${key}`} key={key}>
      <button
        type="button"
        className="reference-settings-group-toggle"
        aria-expanded={Boolean(openGroups[key])}
        onClick={() => setOpenGroups((current) => ({ ...current, [key]: !current[key] }))}
      >
        <span aria-hidden="true">{openGroups[key] ? '⌄' : '›'}</span>
        <span>
          <strong>
            {number} · {title}
          </strong>
          <small>{summary}</small>
        </span>
      </button>
      {openGroups[key] && <div className="reference-settings-group-content">{children}</div>}
    </section>
  );

  return (
    <div className="reference-settings-page" ref={rootRef}>
      <nav className="reference-settings-quick-nav" aria-label={visibleUiText.text199}>
        <span>{visibleUiText.text200}</span>
        {groupLabels.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={openGroups[key] ? 'active' : ''}
            onClick={() => openGroup(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="reference-settings-open-all"
          onClick={() =>
            setOpenGroups(
              anyGroupOpen ? {} : Object.fromEntries(groupLabels.map(([key]) => [key, true])),
            )
          }
        >
          {anyGroupOpen ? 'Tout fermer' : 'Tout ouvrir'}
        </button>
      </nav>
      <div className="reference-settings-reset-defaults">
        <div>
          <strong>{visibleUiText.pricingResetHeading}</strong>
          <span>{visibleUiText.pricingResetDescription}</span>
        </div>
        <button
          type="button"
          disabled={resettingTariffs}
          onClick={() => void resetReferenceTariffs()}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {resettingTariffs
            ? visibleUiText.pricingResetButtonBusy
            : visibleUiText.pricingResetButton}
        </button>
      </div>
      {resetTariffsStatus && (
        <p role="status" className="reference-settings-reset-status">
          {resetTariffsStatus}
        </p>
      )}
      {resetTariffsError && (
        <p role="alert" className="alert error">
          {resetTariffsError}
        </p>
      )}
      <p className="reference-settings-data-hint">{visibleUiText.text201}</p>
      <div className="reference-settings-grid">
        {group(
          'tarifs',
          1,
          'Tarifs',
          `${vehicles.length} véhicules · manœuvre ${amount(catalogue.settings.labourPrice)} FCFA · dépassement ${amount(catalogue.settings.rentalOvertimeHourlyRate ?? 10000)} FCFA / h`,
          <>
            {vehicles.map((vehicle) => (
              <section style={sectionStyle} key={vehicle.id}>
                <span className="reference-settings-card-title">
                  {vehicle.name} {uiText['parAllerRetour']}
                </span>
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
              <span className="reference-settings-card-title">{uiText['supplementsFixes']}</span>
              <div className="reference-settings-fixed-fields">
                <label>
                  <span>{visibleUiText.text202}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    name="rentalOvertimeHourlyRate"
                    defaultValue={catalogue.settings.rentalOvertimeHourlyRate ?? 10000}
                  />
                </label>
                <label>
                  <span>{uiText['manœuvreParPersonne']}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    name="labourPrice"
                    defaultValue={catalogue.settings.labourPrice}
                  />
                </label>
                <label>
                  <span>{uiText['supplementParEtageSansAscenseurParManœuvre']}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    name="labourFloorPrice"
                    defaultValue={floorSupplement}
                  />
                </label>
                <label>
                  <span>{uiText['forfaitAvecAscenseurDesLe1erParManœuvre']}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    name="labourLiftPrice"
                    defaultValue={liftSupplement}
                  />
                </label>
                <label>
                  <span>{visibleUiText.pricingManoeuvreIncludedHours}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    name="movingLaborPlanning.manoeuvreOvertimeThresholdHours"
                    defaultValue={planning.manoeuvreOvertimeThresholdHours}
                  />
                </label>
                <label>
                  <span>{visibleUiText.pricingManoeuvreOvertimeHourly}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    name="movingLaborPlanning.manoeuvreOvertimeHourlyRate"
                    defaultValue={planning.manoeuvreOvertimeHourlyRate}
                  />
                </label>
                <span className="reference-settings-kicker">
                  {visibleUiText.pricingAutomaticDiscounts}
                </span>
                <label>
                  <span>{visibleUiText.pricingFollowingTrips}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="10"
                    max="100"
                    name="movingLaborPlanning.followingTripDiscountPercent"
                    defaultValue={planning.followingTripDiscountPercent}
                  />
                </label>
                <label>
                  <span>{visibleUiText.pricingLowDemand}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="50"
                    name="movingLaborPlanning.lowDemandDiscountPercent"
                    defaultValue={planning.lowDemandDiscountPercent}
                  />
                </label>
              </div>
              <input type="hidden" name="assembly" value={catalogue.settings.assemblyPrice} />

              <div className="reference-settings-assembly-heading">
                <span className="reference-settings-kicker">
                  {uiText['demontageMONTAGEPARMEUBLEPRIXCLIENT']}
                </span>
                <AssemblyResetButton onReset={onResetAssembly} />
              </div>
              <div className="reference-settings-assembly-columns">
                {assemblyColumns.map((sections, columnIndex) => (
                  <div className="reference-settings-assembly-column" key={columnIndex}>
                    <div className="reference-settings-price-head">
                      <span />
                      <span className="reference-settings-column-title">{uiText['local']}</span>
                      <span className="reference-settings-column-title">{uiText['importe']}</span>
                    </div>
                    {sections.map(([section, sectionRows]) => (
                      <div className="reference-settings-assembly-category" key={section}>
                        <strong className="reference-settings-category">
                          {section.toUpperCase()}
                        </strong>
                        <div className="reference-settings-price-matrix">
                          {sectionRows.map(({ item, key, pricing, range }) => {
                            const local = pricing.local ?? 0;
                            const imported = pricing.import ?? local;
                            const sizeLabel = item.sizeLabel ?? '';
                            return (
                              <div className="reference-settings-item-group" key={key}>
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
                                      <span>{uiText['local']}</span>
                                      <span>{uiText['importe']}</span>
                                    </div>
                                    <div className="reference-settings-size-increment">
                                      <span>
                                        {uiText['supplementPar']}
                                        {sizeLabel.replace(/s$/u, '')} {uiText['enPlus']}
                                      </span>
                                      <label>
                                        <span>{uiText['local']}</span>
                                        <input
                                          style={inputStyle}
                                          type="number"
                                          min="0"
                                          name={`montageP.${key}.u`}
                                          defaultValue={pricing.u ?? 0}
                                          aria-label={`${item.label}, supplément local par ${sizeLabel.replace(/s$/u, '')}`}
                                        />
                                      </label>
                                      <label>
                                        <span>{uiText['importe']}</span>
                                        <input
                                          style={inputStyle}
                                          type="number"
                                          min="0"
                                          name={`montageP.${key}.uI`}
                                          defaultValue={pricing.uI ?? pricing.u ?? 0}
                                          aria-label={`${item.label}, supplément importé par ${sizeLabel.replace(/s$/u, '')}`}
                                        />
                                      </label>
                                    </div>
                                    {Array.from(
                                      { length: range[1] - range[0] + 1 },
                                      (_, offset) => {
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
                                              {size}{' '}
                                              {size === 1 ? sizeLabel.replace(/s$/, '') : sizeLabel}
                                            </span>
                                            <label>
                                              <span>{uiText['local']}</span>
                                              <input
                                                style={inputStyle}
                                                type="number"
                                                min="0"
                                                name={`montageP.${key}.sz.${size}.local`}
                                                defaultValue={priceAtSize('local')}
                                                aria-label={`${item.label}, ${size} ${sizeLabel}, local`}
                                              />
                                            </label>
                                            <label>
                                              <span>{uiText['importe']}</span>
                                              <input
                                                style={inputStyle}
                                                type="number"
                                                min="0"
                                                name={`montageP.${key}.sz.${size}.import`}
                                                defaultValue={priceAtSize('import')}
                                                aria-label={`${item.label}, ${size} ${sizeLabel}, importé`}
                                              />
                                            </label>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {columnIndex === 0 && (
                      <div className="reference-settings-assembly-category">
                        <strong className="reference-settings-category">
                          {uiText['autresOBJETS']}
                        </strong>
                        <div className="reference-settings-price-matrix">
                          <div className="reference-settings-price-row">
                            <span>{uiText['autreObjet']}</span>
                            <input
                              style={inputStyle}
                              type="number"
                              min="0"
                              name="montageP.custom.local"
                              defaultValue={customPricing.local ?? catalogue.settings.assemblyPrice}
                              aria-label={uiText['autreObjetLocal']}
                            />
                            <input
                              style={inputStyle}
                              type="number"
                              min="0"
                              name="montageP.custom.import"
                              defaultValue={
                                customPricing.import ??
                                Math.round(catalogue.settings.assemblyPrice * 1.5)
                              }
                              aria-label={uiText['autreObjetImporte']}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="reference-settings-wide" style={sectionStyle}>
              <div className="reference-settings-section-heading">
                <span className="reference-settings-card-title">
                  {uiText['grilleDePrixDesManœuvres']}
                </span>
                <span>{uiText['baseSupplementDepartSupplementArrivee']}</span>
              </div>
              <div
                className="reference-settings-scenarios"
                role="group"
                aria-label={uiText['scenarioAscenseur']}
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
                  <div className="reference-settings-axis">{uiText['departArrivee']}</div>
                  {floors.map((floor) => (
                    <strong className="reference-settings-col" key={floor}>
                      {floor}
                    </strong>
                  ))}
                  {floors.map((fromFloor, fromIndex) => (
                    <div className="reference-settings-labour-row" key={fromFloor}>
                      <strong>{fromFloor}</strong>
                      {floors.map((_, toIndex) => {
                        const value = labourUnitPrice(catalogue.settings, {
                          fromFloor: fromIndex,
                          toFloor: toIndex,
                          fromLift: selected.from,
                          toLift: selected.to,
                        });
                        return <span key={toIndex}>{amount(value)}</span>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>,
        )}
        {group(
          'veh',
          2,
          'Véhicules',
          `${vehicles.length} véhicules · dimensions, volume utile et photos`,
          <>
            <section className="reference-settings-wide" style={sectionStyle}>
              <span className="reference-settings-card-title">
                {uiText['dimensionsDesVehicules']}
              </span>
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

            <ReferenceVehicleSettings catalogue={catalogue} />
          </>,
        )}
        {group(
          'ops',
          3,
          'Opérations',
          'Main-d’œuvre et durées · serviettes · matériel de la location · questionnaire',
          <>
            <section className="reference-settings-wide" style={sectionStyle}>
              <div className="reference-settings-section-heading">
                <span className="reference-settings-card-title">
                  {uiText['mainDŒuvreEtDurees']}
                </span>
              </div>
              <div className="reference-settings-labor-fields">
                {planningFields.map(([key, label, hint]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      style={inputStyle}
                      type="number"
                      min={
                        key === 'wbgtAdj'
                          ? -10
                          : key === 'heat'
                            ? 0
                            : key === 'maxDayHours'
                              ? 1
                              : key === 'maxMoversPerVehicle'
                                ? 2
                                : key === 'cubicMetersPerHourPerMover'
                                  ? 0.1
                                  : key === 'pauseMinutes'
                                    ? 0
                                    : key === 'handlingCalibration'
                                      ? 0.5
                                      : key === 'carryDistanceMeters'
                                        ? 1
                                        : key === 'defaultStartHour'
                                          ? 0
                                          : 0.5
                      }
                      max={
                        [
                          'metabolicReference',
                          'effortGround',
                          'effortLift',
                          'effortStairs',
                          'effortMaximum',
                        ].includes(key)
                          ? 1500
                          : key === 'effortPerFloor'
                            ? 200
                            : key === 'maxTotalHours'
                              ? 48
                              : key === 'wbgtAdj'
                                ? 10
                                : key === 'heat'
                                  ? 1
                                  : key === 'maxHandlingHours'
                                    ? 12
                                    : key === 'maxDayHours'
                                      ? 16
                                      : key === 'defaultStartHour'
                                        ? 23
                                        : key === 'maxMoversPerVehicle'
                                          ? 20
                                          : key === 'cubicMetersPerHourPerMover'
                                            ? 50
                                            : key === 'teamVolumePerMover'
                                              ? 100
                                              : key === 'handlingCalibration'
                                                ? 5
                                                : key === 'carryDistanceMeters'
                                                  ? 200
                                                  : 180
                      }
                      required
                      step={
                        key === 'cubicMetersPerHourPerMover' ||
                        key === 'teamVolumePerMover' ||
                        key === 'handlingCalibration'
                          ? '0.1'
                          : key === 'wbgtAdj' || key === 'maxHandlingHours' || key === 'maxDayHours'
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
                    if (input instanceof HTMLInputElement)
                      input.value = String(planningDefaults[key]);
                  }
                  form?.requestSubmit();
                }}
              >
                {uiText['revenirAuxValeursParDefaut']}
              </button>
            </section>

            <InventoryCatalogSettings
              types={catalogue.settings.customInventoryTypes ?? []}
              hiddenKeys={catalogue.settings.hiddenInventoryKeys ?? []}
              onSave={onSaveInventoryCatalog}
            />

            <section style={sectionStyle}>
              <span className="reference-settings-card-title">{visibleUiText.text67}</span>
              <div className="reference-settings-blanket-fields">
                <label>
                  <span>{visibleUiText.text68}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    required
                    name="movingLaborPlanning.blanketLengthCm"
                    value={blanketLengthCm}
                    onChange={(event) => setBlanketLengthCm(Number(event.target.value) || 0)}
                  />
                </label>
                <label>
                  <span>{visibleUiText.text69}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    required
                    name="movingLaborPlanning.blanketWidthCm"
                    value={blanketWidthCm}
                    onChange={(event) => setBlanketWidthCm(Number(event.target.value) || 0)}
                  />
                </label>
                <label>
                  <span>{visibleUiText.text70}</span>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    step={1}
                    required
                    name="movingLaborPlanning.blanketStock"
                    value={blanketStock}
                    onChange={(event) => setBlanketStock(Number(event.target.value) || 0)}
                  />
                </label>
              </div>
              <small>
                {visibleUiText.text71}
                {((blanketLengthCm * blanketWidthCm) / 10000).toFixed(2).replace('.', ',')}{' '}
                {visibleUiText.text72}
              </small>
              <button
                className="reference-settings-reset"
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  for (const key of [
                    'blanketLengthCm',
                    'blanketWidthCm',
                    'blanketStock',
                  ] as const) {
                    const input = form?.elements.namedItem(`movingLaborPlanning.${key}`);
                    if (input instanceof HTMLInputElement)
                      input.value = String(planningDefaults[key]);
                  }
                  setBlanketLengthCm(planningDefaults.blanketLengthCm);
                  setBlanketWidthCm(planningDefaults.blanketWidthCm);
                  setBlanketStock(planningDefaults.blanketStock);
                  form?.requestSubmit();
                }}
              >
                {visibleUiText.text73}
              </button>
            </section>

            <TariffDocumentsSettings catalogue={catalogue} />
            <RentalKitSettings catalogue={catalogue} />
            <QuestionnaireSettings questions={catalogue.settings.questionnaire ?? []} />
          </>,
        )}
        {group(
          'docs',
          4,
          'Documents et communication',
          `Entreprise · conditions générales · paiement ${paymentMethods} · WhatsApp`,
          <>
            <CompanyQuoteSettings catalogue={catalogue} />
            <QuoteTermsSettings catalogue={catalogue} />
            <PaymentSettings catalogue={catalogue} />
            <ReferenceWhatsappSettings catalogue={catalogue} />
          </>,
        )}
        {group(
          'integ',
          5,
          'Intégrations',
          `${claudeConnected ? 'Claude connecté' : 'Claude non connecté'} · ${mapsConfigured ? 'clé Google Maps enregistrée' : 'sans clé Google Maps'}`,
          <>
            <ClaudeSettings onConnectionChange={setClaudeConnected} />
            <ReferenceGoogleMapsSettings onKeyChange={setMapsConfigured} />
          </>,
        )}
      </div>
    </div>
  );
}
