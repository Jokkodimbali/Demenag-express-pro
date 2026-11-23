import { useEffect, useState } from 'react';
import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import { useApp } from '../../../shared/application/context';
import { AdminQuoteCheaperVehicle } from './AdminQuoteCheaperVehicle';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue } from '../../../shared/domain/model';
import { quoteConfigWithManualTaxiFee } from '../application/services/admin-quote-form-policy';
import { taxiPaidLegCount, taxiRotationCount } from '../application/services/admin-quote-taxi';
import { estimatedManoeuvreOvertimeHours } from '../application/services/manoeuvre-overtime';
import {
  taxiDistanceTariffFor,
  taxiFareForDistance,
} from '../../../../../../shared/taxi-distance-tariffs.js';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminQuoteSettings({ model, catalogue }: { model: Model; catalogue: Catalogue }) {
  const { showSuccessToast } = useApp();
  const [taxiAmountDraft, setTaxiAmountDraft] = useState<string | null>(null);
  const [taxiCompanyApproachAmountDraft, setTaxiCompanyApproachAmountDraft] = useState<
    string | null
  >(null);
  const {
    quoteConfig,
    setTaxiConfig,
    resetVersion,
    setQuoteConfig,
    effectiveDistance,
    draft,
    setDraft,
    estimateInventory,
    editingBooking,
    quoteKind,
    selectQuoteKind,
    submitting,
    canSelectFinal,
    movingEstimate,
    manoeuvreEmployees,
    economicCrew,
    taxiCrew,
    taxiCompanyApproachDistanceKm,
    taxiCompanyApproachBusy,
    taxiCompanyApproachError,
    formulaPrices,
    cheaperVehicle,
  } = model;
  const heatAvailable = Boolean(
    movingEstimate?.volume && (catalogue.settings.movingLaborPlanning?.heat ?? 0) > 0,
  );
  const heatActive = heatAvailable && !quoteConfig.heatOff;
  const quoteSettings = model.quoteSettings ?? catalogue.settings;
  const taxiDistanceKm = Math.max(0, effectiveDistance ?? 0);
  const taxiRate = Math.max(0, quoteSettings.taxiFeePerKm ?? 0);
  const configuredTaxiTariffs = quoteSettings.taxiDistanceTariffs ?? [];
  const taxiRouteTariff =
    effectiveDistance == null
      ? null
      : taxiDistanceTariffFor(effectiveDistance, configuredTaxiTariffs);
  const taxiRotations = taxiRotationCount(
    movingEstimate?.trips,
    quoteConfig.trips,
    quoteConfig.calcMode,
  );
  const taxiPaidLegs = taxiPaidLegCount(taxiRotations);
  const taxiCalculatedAmount = configuredTaxiTariffs.length
    ? (taxiFareForDistance(effectiveDistance, configuredTaxiTariffs) ?? 0)
    : Math.round(taxiDistanceKm * taxiRate);
  const companyLocationConfigured =
    quoteSettings.businessLatitude != null && quoteSettings.businessLongitude != null;
  const taxiCompanyApproachCalculatedAmount = configuredTaxiTariffs.length
    ? (taxiFareForDistance(taxiCompanyApproachDistanceKm, configuredTaxiTariffs) ?? 0)
    : Math.round(Math.max(0, taxiCompanyApproachDistanceKm ?? 0) * taxiRate);
  const taxiAvailable =
    quoteConfig.billingMode !== 'driver-rental' &&
    taxiCrew > 0 &&
    companyLocationConfigured &&
    (taxiCompanyApproachDistanceKm != null ||
      quoteConfig.taxiCompanyApproachAmountOverride != null);
  const taxiManualApproachAvailable =
    quoteConfig.billingMode !== 'driver-rental' && taxiCrew > 0 && companyLocationConfigured;
  const taxiAmount = quoteConfig.taxiFeeAmountOverride ?? taxiCalculatedAmount;
  const taxiCompanyApproachAmount =
    quoteConfig.taxiCompanyApproachAmountOverride ?? taxiCompanyApproachCalculatedAmount;
  const taxiTotalAmount = taxiAmount * taxiPaidLegs + taxiCompanyApproachAmount;
  const displayedTaxiTotalAmount = model.preservedTaxiFeeAmount ?? taxiTotalAmount;
  const manoeuvreOvertimeRate =
    quoteConfig.manoeuvreOvertimeHourlyRateOverride ??
    model.accountingConfiguration?.overtimeHourlyRate ??
    quoteSettings.movingLaborPlanning?.manoeuvreOvertimeHourlyRate ??
    0;
  const manoeuvreOvertimeHours =
    quoteConfig.manoeuvreOvertimeHours ??
    estimatedManoeuvreOvertimeHours(movingEstimate, draft.timeSlot);
  const selectedOvertimePersonIds = quoteConfig.manoeuvreOvertimePersonIds ?? [];
  const additionalOvertimePeople =
    quoteConfig.manoeuvreOvertimeAdditionalPeople ??
    quoteConfig.manoeuvreOvertimeCrewCount ??
    (quoteConfig.manoeuvreOvertimePersonIds === null ? (movingEstimate?.crew ?? 0) : 0);
  const manoeuvreOvertimeCrewCount = selectedOvertimePersonIds.length + additionalOvertimePeople;
  const additionalOvertimePeopleMax = Math.max(0, 100 - selectedOvertimePersonIds.length);
  const manoeuvreOvertimeTotal =
    manoeuvreOvertimeCrewCount * manoeuvreOvertimeHours * manoeuvreOvertimeRate;
  const manoeuvreOvertimeEnabled =
    quoteConfig.manoeuvreOvertimeEnabled ??
    (manoeuvreOvertimeHours > 0 && manoeuvreOvertimeRate > 0);
  const taxiDistanceLabel = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(taxiDistanceKm);
  const taxiCompanyApproachDistanceLabel =
    taxiCompanyApproachDistanceKm == null
      ? '—'
      : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(
          taxiCompanyApproachDistanceKm,
        );
  useEffect(() => {
    setTaxiAmountDraft(null);
    setTaxiCompanyApproachAmountDraft(null);
  }, [
    taxiCalculatedAmount,
    taxiCompanyApproachCalculatedAmount,
    taxiDistanceKm,
    taxiRate,
    taxiRotations,
    taxiCompanyApproachDistanceKm,
    resetVersion,
  ]);

  function handleQuoteKindSelection(kind: 'provisional' | 'final') {
    if (kind === quoteKind) return;
    if (kind === 'final' && !canSelectFinal) {
      selectQuoteKind(kind);
      return;
    }
    selectQuoteKind(kind);
    showSuccessToast(
      `Devis ${kind === 'final' ? 'final' : 'provisoire'} sélectionné. Cliquez sur « Enregistrer » pour appliquer le changement.`,
    );
  }

  return (
    <>
      <section className="admin-quote-reference-settings" aria-label={visibleUiText.text124}>
        <strong>{visibleUiText.text125}</strong>
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.quoteFormulaLabel}</span>
          <div
            className="admin-quote-formula-options"
            role="group"
            aria-label={visibleUiText.text213}
          >
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'driver-rental'}
              className={quoteConfig.billingMode === 'driver-rental' ? 'active' : ''}
              onClick={() => {
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'driver-rental',
                  menuIncluded: false,
                  overtimeMinutes: 0,
                  taxiFeeApplied: false,
                }));
                if (quoteConfig.billingMode !== 'driver-rental')
                  showSuccessToast('Formule économique sélectionnée. Le devis a été recalculé.');
              }}
            >
              <strong>{visibleUiText.quoteEconomicFormula}</strong>
              <b>{money(formulaPrices.economic)}</b>
              <small>
                {visibleUiText.quoteMoversLabel} · {economicCrew || 0}
              </small>
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'standard'}
              className={quoteConfig.billingMode === 'standard' ? 'active' : ''}
              onClick={() => {
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'standard',
                  menuIncluded: false,
                  overtimeMinutes: 0,
                }));
                if (quoteConfig.billingMode !== 'standard')
                  showSuccessToast('Formule standard sélectionnée. Le devis a été recalculé.');
              }}
            >
              <strong>{visibleUiText.quoteStandardFormula}</strong>
              <b>{money(formulaPrices.standard)}</b>
              <small>{visibleUiText.quoteRecommendedMovers}</small>
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'complete'}
              className={quoteConfig.billingMode === 'complete' ? 'active' : ''}
              onClick={() => {
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'complete',
                  overtimeMinutes: 0,
                }));
                if (quoteConfig.billingMode !== 'complete')
                  showSuccessToast('Formule complète sélectionnée. Le devis a été recalculé.');
              }}
            >
              <strong>{visibleUiText.quoteCompleteFormula}</strong>
              <b>{money(formulaPrices.complete)}</b>
              <small>{visibleUiText.quoteCarpenterIncluded}</small>
            </button>
          </div>
        </div>
        <AdminQuoteCheaperVehicle
          suggestion={cheaperVehicle}
          onSelect={(vehicleId, trips) => {
            setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
            setQuoteConfig((current) =>
              current.calcMode === 'manual' ? current : { ...current, trips },
            );
          }}
        />
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.text130}</span>
          <div role="group" aria-label={visibleUiText.text3}>
            <button
              type="button"
              aria-pressed={quoteConfig.calcMode === 'auto'}
              className={quoteConfig.calcMode === 'auto' ? 'active' : ''}
              onClick={() => {
                setQuoteConfig((current) => ({ ...current, calcMode: 'auto', legMinutes: 0 }));
                setDraft((current) => ({
                  ...current,
                  inventory: { ...current.inventory, crew: 0 },
                }));
              }}
            >
              {visibleUiText.text4}
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.calcMode === 'manual'}
              className={quoteConfig.calcMode === 'manual' ? 'active' : ''}
              onClick={() => {
                const crew = movingEstimate?.crew || draft.options.labour || 2;
                setQuoteConfig((current) => ({
                  ...current,
                  calcMode: 'manual',
                  legMinutes: Math.max(0, Math.round((movingEstimate?.travelLegMinutes ?? 0) - 10)),
                }));
                setDraft((current) => ({
                  ...current,
                  options: { ...current.options, labour: crew },
                  inventory: { ...current.inventory, crew },
                }));
              }}
            >
              {visibleUiText.text5}
            </button>
          </div>
        </div>
        <div className="admin-quote-reference-setting admin-quote-stage-setting">
          <span>{visibleUiText.text131}</span>
          <div
            className="admin-quote-stage-selector"
            role="group"
            aria-label={visibleUiText.text132}
          >
            <button
              type="button"
              aria-pressed={quoteKind === 'provisional'}
              disabled={submitting || editingBooking?.status === 'cancelled'}
              className={quoteKind === 'provisional' ? 'active' : ''}
              onClick={() => handleQuoteKindSelection('provisional')}
            >
              {visibleUiText.text133}
            </button>
            <button
              type="button"
              aria-pressed={quoteKind === 'final'}
              disabled={submitting || editingBooking?.status === 'cancelled'}
              className={quoteKind === 'final' ? 'active final' : ''}
              title={
                !canSelectFinal
                  ? 'Une date est nécessaire pour enregistrer un devis final.'
                  : undefined
              }
              onClick={() => handleQuoteKindSelection('final')}
            >
              {visibleUiText.text134}
            </button>
          </div>
        </div>
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.text140}</span>
          <div role="group" aria-label={visibleUiText.text141}>
            <button
              type="button"
              aria-pressed={!quoteConfig.trafficOff}
              className={!quoteConfig.trafficOff ? 'active' : ''}
              onClick={() =>
                setQuoteConfig((current) => ({ ...current, trafficOff: !current.trafficOff }))
              }
            >
              {quoteConfig.trafficOff ? 'Ignorés' : 'Pris en compte'}
            </button>
          </div>
        </div>
        {heatAvailable && (
          <div className="admin-quote-reference-setting">
            <span>{visibleUiText.text57}</span>
            <div role="group" aria-label={visibleUiText.text142}>
              <button
                type="button"
                aria-pressed={heatActive}
                className={heatActive ? 'active' : ''}
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    heatOff: heatActive,
                    heatRest: heatActive ? current.heatRest : current.heatRest || 15,
                  }))
                }
              >
                {heatActive ? `Comptée · ${quoteConfig.heatRest || 15} min/h` : 'Non comptée'}
              </button>
            </div>
          </div>
        )}
        {quoteConfig.billingMode === 'driver-rental' && model.availableMenuLines.length > 0 && (
          <div className="admin-quote-reference-setting">
            <span>{visibleUiText.text216}</span>
            <button
              type="button"
              aria-pressed={quoteConfig.menuIncluded}
              onClick={() =>
                setQuoteConfig((current) => ({ ...current, menuIncluded: !current.menuIncluded }))
              }
            >
              {quoteConfig.menuIncluded ? visibleUiText.text217 : visibleUiText.text218}
            </button>
          </div>
        )}
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.text135}</span>
          <div role="group" aria-label={visibleUiText.text136}>
            {(['oui', 'non'] as const).map((value) => {
              const active = estimateInventory.ready === value;
              return (
                <button
                  type="button"
                  key={value}
                  aria-pressed={active}
                  className={active ? 'active' : ''}
                  onClick={() =>
                    setDraft((current) => {
                      const nextValue = current.inventory.ready === value ? '' : value;
                      const answer =
                        nextValue === 'oui'
                          ? 'Oui, tout est prêt'
                          : nextValue === 'non'
                            ? 'Non, emballage par l’équipe'
                            : '';
                      return {
                        ...current,
                        inventory: { ...current.inventory, ready: nextValue },
                        questionnaireAnswers: {
                          ...current.questionnaireAnswers,
                          'key-ready': answer,
                        },
                      };
                    })
                  }
                >
                  {value === 'oui' ? 'Prêt' : 'À emballer'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.text137}</span>
          <div role="group" aria-label={visibleUiText.text138}>
            {(
              [
                ['oui', 'Escalier'],
                ['balcon', 'Balcon'],
                ['verif', 'À vérifier'],
              ] as const
            ).map(([value, label]) => {
              const active = estimateInventory.stairs === value;
              return (
                <button
                  type="button"
                  key={value}
                  aria-pressed={active}
                  className={active ? 'active' : ''}
                  onClick={() =>
                    setDraft((current) => {
                      const nextValue = current.inventory.stairs === value ? '' : value;
                      const answer =
                        nextValue === 'oui'
                          ? 'Oui, tout passe'
                          : nextValue === 'balcon'
                            ? 'Non, par le balcon'
                            : nextValue === 'verif'
                              ? 'À vérifier'
                              : '';
                      return {
                        ...current,
                        inventory: { ...current.inventory, stairs: nextValue },
                        questionnaireAnswers: {
                          ...current.questionnaireAnswers,
                          'key-stairs': answer,
                        },
                      };
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {quoteSettings.taxiFeeEnabled && (
          <section className="admin-quote-taxi-card" aria-labelledby="admin-quote-taxi-title">
            <div className="admin-quote-taxi-header">
              <div>
                <strong id="admin-quote-taxi-title">Frais taxi</strong>
                <span>
                  {!taxiAvailable
                    ? quoteConfig.billingMode === 'driver-rental'
                      ? 'Indisponibles pour la location avec chauffeur.'
                      : !companyLocationConfigured
                        ? 'Renseignez la position des locaux dans Paramètres.'
                        : taxiCrew <= 0
                          ? 'Indisponibles sans manœuvre estimée.'
                          : taxiCompanyApproachBusy || taxiCompanyApproachDistanceKm == null
                            ? 'Distance indisponible : saisissez le montant du trajet depuis les locaux pour activer les frais.'
                            : 'Indisponibles pour ce devis.'
                    : 'Calculés selon la distance et les chargements et déchargements estimés.'}
                </span>
              </div>
              <button
                type="button"
                aria-pressed={quoteConfig.taxiFeeApplied}
                disabled={!taxiAvailable}
                className={`admin-quote-taxi-toggle${quoteConfig.taxiFeeApplied ? ' active' : ''}`}
                onClick={() => {
                  const enabled = !quoteConfig.taxiFeeApplied;
                  setTaxiConfig((current) => ({ ...current, taxiFeeApplied: enabled }));
                  showSuccessToast(
                    enabled
                      ? 'Frais taxi activés. Le devis a été recalculé.'
                      : 'Frais taxi désactivés. Le devis a été recalculé.',
                  );
                }}
              >
                {quoteConfig.taxiFeeApplied ? 'Activés' : 'Activer'}
              </button>
            </div>
            <div className="admin-quote-taxi-fields" aria-label="Calcul des frais taxi">
              <div className="admin-quote-taxi-field">
                <span>Distance estimée</span>
                <strong>{taxiDistanceLabel} km</strong>
              </div>
              <div className="admin-quote-taxi-field">
                <span>Tarif d’une course selon la distance</span>
                <strong>
                  {money(taxiCalculatedAmount)}
                  {taxiRouteTariff ? ` · ${taxiRouteTariff.label}` : ''}
                </strong>
              </div>
              <div className="admin-quote-taxi-field">
                <span>
                  {quoteConfig.calcMode === 'manual'
                    ? 'Rotations de chargement et déchargement saisies'
                    : 'Rotations de chargement et déchargement estimées'}
                </span>
                <strong>
                  {taxiRotations} rotation{taxiRotations === 1 ? '' : 's'} · {taxiPaidLegs} trajet
                  taxi facturé{taxiPaidLegs === 1 ? '' : 's'}
                </strong>
              </div>
              {companyLocationConfigured && (
                <div className="admin-quote-taxi-field">
                  <span>Locaux → départ client</span>
                  <strong>{taxiCompanyApproachDistanceLabel} km</strong>
                </div>
              )}
              <label className="admin-quote-taxi-field admin-quote-taxi-amount">
                <span>{visibleUiText.quoteTaxiPerLegLabel}</span>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  inputMode="numeric"
                  aria-label={visibleUiText.quoteTaxiPerLegAriaLabel}
                  disabled={!taxiAvailable}
                  value={
                    taxiAmountDraft ?? quoteConfig.taxiFeeAmountOverride ?? taxiCalculatedAmount
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setTaxiAmountDraft(value);
                    setTaxiConfig((current) => quoteConfigWithManualTaxiFee(current, value));
                  }}
                  onBlur={(event) => {
                    if (event.currentTarget.value === '') {
                      setTaxiConfig((current) => ({ ...current, taxiFeeAmountOverride: null }));
                      setTaxiAmountDraft(null);
                    }
                  }}
                />
              </label>
              {companyLocationConfigured && (
                <label className="admin-quote-taxi-field admin-quote-taxi-amount">
                  <span>Trajet locaux → client (FCFA, une fois)</span>
                  <input
                    type="number"
                    min="0"
                    max="10000000"
                    step="1"
                    inputMode="numeric"
                    aria-label="Frais du trajet depuis les locaux en FCFA"
                    disabled={!taxiManualApproachAvailable}
                    value={
                      taxiCompanyApproachAmountDraft ??
                      quoteConfig.taxiCompanyApproachAmountOverride ??
                      taxiCompanyApproachCalculatedAmount
                    }
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setTaxiCompanyApproachAmountDraft(value);
                      if (value === '') return;
                      setTaxiConfig((current) => ({
                        ...current,
                        taxiFeeApplied: true,
                        taxiCompanyApproachAmountOverride: Math.min(
                          10_000_000,
                          Math.max(0, Math.round(Number(value) || 0)),
                        ),
                      }));
                    }}
                    onBlur={(event) => {
                      if (event.currentTarget.value === '') {
                        setTaxiConfig((current) => ({
                          ...current,
                          taxiCompanyApproachAmountOverride: null,
                        }));
                        setTaxiCompanyApproachAmountDraft(null);
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div className="admin-quote-taxi-summary">
              <span>
                {model.preservedTaxiFeeAmount != null && quoteConfig.taxiFeeApplied
                  ? `Montant taxi conservé dans le devis enregistré : ${money(model.preservedTaxiFeeAmount)}. Les champs tarifaires affichent la grille actuelle.`
                  : quoteConfig.taxiFeeApplied && taxiAvailable
                    ? `(${money(taxiAmount)} × (2 × ${taxiRotations} rotation${taxiRotations === 1 ? '' : 's'} − 1 retour final non facturé) + ${money(taxiCompanyApproachAmount)} trajet local, une fois) = ${money(taxiTotalAmount)} à répartir sur ${taxiCrew} manœuvre${taxiCrew > 1 ? 's' : ''}`
                    : 'Montant non appliqué au devis'}
              </span>
              {quoteConfig.taxiFeeApplied &&
                (model.preservedTaxiFeeAmount != null || taxiAvailable) && (
                  <strong>
                    {model.preservedTaxiFeeAmount != null
                      ? `Total enregistré : ${money(displayedTaxiTotalAmount)}`
                      : `≈ ${money(displayedTaxiTotalAmount / taxiCrew)} en moyenne par manœuvre`}
                  </strong>
                )}
            </div>
            {taxiCompanyApproachError && <small role="alert">{taxiCompanyApproachError}</small>}
          </section>
        )}
        {quoteConfig.billingMode !== 'driver-rental' && (movingEstimate?.crew ?? 0) > 0 && (
          <section
            className="admin-quote-overtime-card"
            aria-labelledby="admin-quote-overtime-title"
          >
            <div className="admin-quote-overtime-header">
              <div>
                <strong id="admin-quote-overtime-title">
                  Heures supplémentaires des manœuvres
                </strong>
                <span>Salariés : 08 h–20 h · tarif par heure et par personne</span>
              </div>
              <button
                type="button"
                aria-pressed={manoeuvreOvertimeEnabled}
                className={manoeuvreOvertimeEnabled ? 'active' : ''}
                onClick={() => {
                  const enabled = !manoeuvreOvertimeEnabled;
                  setQuoteConfig((current) => ({ ...current, manoeuvreOvertimeEnabled: enabled }));
                  showSuccessToast(
                    enabled
                      ? 'Heures supplémentaires activées sur le devis.'
                      : 'Heures supplémentaires retirées du devis.',
                  );
                }}
              >
                {manoeuvreOvertimeEnabled ? 'Activées' : 'Activer le supplément'}
              </button>
            </div>
            <div className="admin-quote-overtime-controls">
              <div className="admin-quote-overtime-hours">
                <span>Heures au-delà de 20 h, par personne concernée</span>
                <button
                  type="button"
                  aria-label="Retirer une heure supplémentaire"
                  disabled={manoeuvreOvertimeHours <= 0}
                  onClick={() => {
                    const hours = Math.max(0, manoeuvreOvertimeHours - 1);
                    setQuoteConfig((current) => ({ ...current, manoeuvreOvertimeHours: hours }));
                    showSuccessToast(
                      `Heures supplémentaires : ${String(hours).replace('.', ',')} h par personne concernée.`,
                    );
                  }}
                >
                  −
                </button>
                <strong>{String(manoeuvreOvertimeHours).replace('.', ',')} h</strong>
                <button
                  type="button"
                  aria-label="Ajouter une heure supplémentaire"
                  disabled={manoeuvreOvertimeHours >= 24}
                  onClick={() => {
                    const hours = Math.min(24, manoeuvreOvertimeHours + 1);
                    setQuoteConfig((current) => ({ ...current, manoeuvreOvertimeHours: hours }));
                    showSuccessToast(
                      `Heures supplémentaires : ${String(hours).replace('.', ',')} h par personne concernée.`,
                    );
                  }}
                >
                  +
                </button>
              </div>
              <label>
                <span>Tarif par heure (FCFA)</span>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  value={manoeuvreOvertimeRate}
                  onChange={(event) =>
                    setQuoteConfig((current) => ({
                      ...current,
                      manoeuvreOvertimeHourlyRateOverride:
                        event.target.value === ''
                          ? 0
                          : Math.min(
                              10_000_000,
                              Math.max(0, Math.round(Number(event.target.value))),
                            ),
                    }))
                  }
                  onBlur={() =>
                    showSuccessToast(
                      `Tarif des heures supplémentaires : ${money(manoeuvreOvertimeRate)} / heure.`,
                    )
                  }
                />
              </label>
              <strong className="admin-quote-overtime-total">
                {manoeuvreOvertimeEnabled ? money(manoeuvreOvertimeTotal) : money(0)}
              </strong>
            </div>
            <div className="admin-quote-overtime-people">
              <div className="admin-quote-overtime-people-list">
                <strong>Personnes concernées</strong>
                <div className="admin-quote-overtime-person-fields">
                  {manoeuvreEmployees.length ? (
                    <label className="admin-quote-overtime-profile-picker">
                      <span>Ajouter un profil manœuvre</span>
                      <select
                        value=""
                        aria-label="Choisir un profil manœuvre pour la majoration de nuit"
                        onChange={(event) => {
                          const employeeId = event.target.value;
                          if (!employeeId || selectedOvertimePersonIds.includes(employeeId)) return;
                          setQuoteConfig((current) => {
                            const currentIds =
                              current.manoeuvreOvertimePersonIds ?? selectedOvertimePersonIds;
                            if (currentIds.includes(employeeId)) return current;
                            const selectedIds = [...currentIds, employeeId];
                            const legacyCount = current.manoeuvreOvertimeCrewCount;
                            const additionalPeople =
                              current.manoeuvreOvertimePersonIds === null && legacyCount != null
                                ? Math.max(0, legacyCount - selectedIds.length)
                                : (current.manoeuvreOvertimeAdditionalPeople ?? 0);
                            return {
                              ...current,
                              manoeuvreOvertimePersonIds: selectedIds,
                              manoeuvreOvertimeAdditionalPeople: additionalPeople,
                              manoeuvreOvertimeCrewCount: null,
                            };
                          });
                        }}
                      >
                        <option value="">Sélectionner un profil…</option>
                        {manoeuvreEmployees
                          .filter((employee) => !selectedOvertimePersonIds.includes(employee.id))
                          .map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : (
                    <small>Aucun profil manœuvre enregistré.</small>
                  )}
                  <label className="admin-quote-overtime-unregistered">
                    <span>Personnes non enregistrées</span>
                    <input
                      type="number"
                      min="0"
                      max={additionalOvertimePeopleMax}
                      step="1"
                      inputMode="numeric"
                      value={additionalOvertimePeople}
                      onChange={(event) =>
                        setQuoteConfig((current) => ({
                          ...current,
                          manoeuvreOvertimeAdditionalPeople:
                            event.target.value === ''
                              ? 0
                              : Math.min(
                                  additionalOvertimePeopleMax,
                                  Math.max(0, Math.round(Number(event.target.value) || 0)),
                                ),
                          manoeuvreOvertimeCrewCount: null,
                        }))
                      }
                    />
                  </label>
                </div>
                {selectedOvertimePersonIds.length > 0 && (
                  <div
                    className="admin-quote-overtime-selected-profiles"
                    aria-label="Profils sélectionnés"
                  >
                    {selectedOvertimePersonIds.map((employeeId) => {
                      const employee = manoeuvreEmployees.find((item) => item.id === employeeId);
                      return (
                        <span key={employeeId}>
                          {employee?.name ?? 'Profil non disponible'}
                          <button
                            type="button"
                            aria-label={`Retirer ${employee?.name ?? 'ce profil'} de la majoration`}
                            onClick={() =>
                              setQuoteConfig((current) => ({
                                ...current,
                                manoeuvreOvertimePersonIds: (
                                  current.manoeuvreOvertimePersonIds ?? selectedOvertimePersonIds
                                ).filter((id) => id !== employeeId),
                                manoeuvreOvertimeCrewCount: null,
                              }))
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <small>
              {manoeuvreOvertimeEnabled
                ? `${manoeuvreOvertimeCrewCount} personne${manoeuvreOvertimeCrewCount > 1 ? 's' : ''} × ${String(manoeuvreOvertimeHours).replace('.', ',')} h × ${money(manoeuvreOvertimeRate)} = ${money(manoeuvreOvertimeTotal)} ajouté au devis.`
                : manoeuvreOvertimeHours > 0
                  ? 'Le supplément est désactivé pour ce devis.'
                  : 'Calcul automatique selon l’heure de début et la fin prévue, après 20 h.'}
            </small>
          </section>
        )}
        {(draft.questionnaireAnswers['key-stairs']?.startsWith('Non, par le balcon') ||
          draft.inventory.stairs === 'balcon') && (
          <label className="admin-quote-reference-setting">
            <span>{visibleUiText.text139}</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={draft.inventory.balcPx ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((current) => ({
                  ...current,
                  inventory: {
                    ...current.inventory,
                    balcPx: value === '' ? undefined : Math.max(0, Math.round(Number(value))),
                  },
                }));
              }}
            />
          </label>
        )}
        <span className="admin-quote-reference-settings-note">
          {visibleUiText.quoteLoadingConditionsNote}
        </span>
      </section>
    </>
  );
}
