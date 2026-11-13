import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { money } from '../../../shared/application/presentation/format';
import { AdminQuoteCheaperVehicle } from './AdminQuoteCheaperVehicle';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue } from '../../../shared/domain/model';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminQuoteSettings({ model, catalogue }: { model: Model; catalogue: Catalogue }) {
  const {
    quoteConfig,
    setQuoteConfig,
    draft,
    setDraft,
    estimateInventory,
    quoteKind,
    setQuoteKind,
    selectQuoteKind,
    quoteKindSaving,
    quoteKindNotice,
    setQuoteKindNotice,
    setStageError,
    submitting,
    canSelectFinal,
    movingEstimate,
    formulaPrices,
    cheaperVehicle,
  } = model;
  const heatAvailable = Boolean(
    movingEstimate?.volume && (catalogue.settings.movingLaborPlanning?.heat ?? 0) > 0,
  );
  const heatActive = heatAvailable && !quoteConfig.heatOff;

  function handleQuoteKindSelection(kind: 'provisional' | 'final') {
    const savedQuote = model.editingBooking?.quotes.at(-1);
    const finalCommit =
      kind === 'final' &&
      model.editingBooking &&
      !['completed', 'cancelled'].includes(model.editingBooking.status) &&
      savedQuote?.kind !== 'final';
    const provisionalCommit =
      kind === 'provisional' &&
      model.editingBooking?.status === 'completed' &&
      savedQuote?.kind === 'final';
    if (finalCommit || provisionalCommit) {
      setStageError('');
      setQuoteKindNotice('');
      setQuoteKind(kind);
      window.requestAnimationFrame(() => {
        const form = document.getElementById('admin-quote-form');
        if (form instanceof HTMLFormElement) {
          form.dataset.quoteKindOverride = kind;
          form.dataset.quoteStageCommit = 'true';
          if (savedQuote) form.dataset.quoteStageCommitId = savedQuote.id;
          form.requestSubmit();
          delete form.dataset.quoteKindOverride;
          delete form.dataset.quoteStageCommit;
          delete form.dataset.quoteStageCommitId;
        }
      });
      return;
    }
    void selectQuoteKind(kind);
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
              onClick={() =>
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'driver-rental',
                  menuIncluded: false,
                  overtimeMinutes: 0,
                }))
              }
            >
              <strong>{visibleUiText.quoteEconomicFormula}</strong>
              <b>{money(formulaPrices.economic)}</b>
              <small>{visibleUiText.quoteMoversLabel}</small>
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'standard'}
              className={quoteConfig.billingMode === 'standard' ? 'active' : ''}
              onClick={() =>
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'standard',
                  menuIncluded: false,
                  overtimeMinutes: 0,
                }))
              }
            >
              <strong>{visibleUiText.quoteStandardFormula}</strong>
              <b>{money(formulaPrices.standard)}</b>
              <small>{visibleUiText.quoteRecommendedMovers}</small>
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'complete'}
              className={quoteConfig.billingMode === 'complete' ? 'active' : ''}
              onClick={() =>
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'complete',
                  overtimeMinutes: 0,
                }))
              }
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
        <div className="admin-quote-reference-setting">
          <span>{visibleUiText.text131}</span>
          <div role="group" aria-label={visibleUiText.text132}>
            <button
              type="button"
              aria-pressed={quoteKind === 'provisional'}
              disabled={quoteKindSaving || submitting}
              className={quoteKind === 'provisional' ? 'active' : ''}
              onClick={() => handleQuoteKindSelection('provisional')}
            >
              {visibleUiText.text133}
            </button>
            <button
              type="button"
              aria-pressed={quoteKind === 'final'}
              disabled={quoteKindSaving || submitting}
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
          {quoteKindSaving && <small role="status">{visibleUiText.quoteStageSaving}</small>}
          {quoteKindNotice && <small role="status">{quoteKindNotice}</small>}
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
