import { useEffect, useState } from 'react';
import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import { useApp } from '../../../shared/application/context';
import { AdminQuoteCheaperVehicle } from './AdminQuoteCheaperVehicle';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue } from '../../../shared/domain/model';
import { quoteConfigWithManualTaxiFee } from '../application/services/admin-quote-form-policy';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminQuoteSettings({ model, catalogue }: { model: Model; catalogue: Catalogue }) {
  const { showSuccessToast } = useApp();
  const [taxiAmountDraft, setTaxiAmountDraft] = useState<string | null>(null);
  const {
    quoteConfig,
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
    economicCrew,
    taxiCrew,
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
  const taxiTrips = Math.max(1, quoteConfig.trips);
  const taxiCalculatedAmount = Math.round(taxiDistanceKm * taxiRate);
  const taxiAvailable = quoteConfig.billingMode !== 'driver-rental' && taxiCrew > 0;
  const taxiAmount = quoteConfig.taxiFeeAmountOverride ?? taxiCalculatedAmount;
  const taxiDistanceLabel = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(taxiDistanceKm);
  useEffect(() => setTaxiAmountDraft(null), [taxiDistanceKm, taxiRate, taxiTrips]);

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
                      : 'Indisponibles sans manœuvre estimé.'
                    : 'Calculés selon la distance et les allers-retours estimés.'}
                </span>
              </div>
              <button
                type="button"
                aria-pressed={quoteConfig.taxiFeeApplied}
                disabled={!taxiAvailable}
                className={`admin-quote-taxi-toggle${quoteConfig.taxiFeeApplied ? ' active' : ''}`}
                onClick={() => {
                  const enabled = !quoteConfig.taxiFeeApplied;
                  setQuoteConfig((current) => ({ ...current, taxiFeeApplied: enabled }));
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
                <span>Tarif kilométrique</span>
                <strong>{money(taxiRate)} / km</strong>
              </div>
              <div className="admin-quote-taxi-field">
                <span>Allers-retours</span>
                <strong>{taxiTrips}</strong>
              </div>
              <label className="admin-quote-taxi-field admin-quote-taxi-amount">
                <span>Montant taxi par aller-retour (FCFA)</span>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  inputMode="numeric"
                  aria-label="Montant des frais taxi par aller-retour en FCFA"
                  disabled={!taxiAvailable}
                  value={
                    taxiAmountDraft ?? quoteConfig.taxiFeeAmountOverride ?? taxiCalculatedAmount
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setTaxiAmountDraft(value);
                    setQuoteConfig((current) => quoteConfigWithManualTaxiFee(current, value));
                  }}
                  onBlur={(event) => {
                    if (event.currentTarget.value === '') {
                      setQuoteConfig((current) => ({ ...current, taxiFeeAmountOverride: null }));
                      setTaxiAmountDraft(null);
                    }
                  }}
                />
              </label>
            </div>
            <div className="admin-quote-taxi-summary">
              <span>
                {quoteConfig.taxiFeeApplied && taxiAvailable
                  ? `${money(taxiAmount)} × ${taxiTrips} aller(s)-retour(s), répartis sur ${taxiCrew} manœuvre${taxiCrew > 1 ? 's' : ''}`
                  : 'Montant non appliqué au devis'}
              </span>
              {quoteConfig.taxiFeeApplied && taxiAvailable && (
                <strong>+{money((taxiAmount * taxiTrips) / taxiCrew)} par manœuvre</strong>
              )}
            </div>
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
