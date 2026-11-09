import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue } from '../domain/model';

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
    canCreateFinal,
    setStageError,
    movingEstimate,
  } = model;
  const heatAvailable = Boolean(
    movingEstimate?.volume && (catalogue.settings.movingLaborPlanning?.heat ?? 0) > 0,
  );
  const heatActive = heatAvailable && !quoteConfig.heatOff;

  return (
    <>
      <section className="admin-quote-reference-settings" aria-label="Réglages du devis">
        <strong>RÉGLAGES DU DEVIS</strong>
        <div className="admin-quote-reference-setting">
          <span>Facturation</span>
          <div role="group" aria-label="Mode de facturation">
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode !== 'driver-rental'}
              className={quoteConfig.billingMode !== 'driver-rental' ? 'active' : ''}
              onClick={() =>
                setQuoteConfig((current) => ({
                  ...current,
                  billingMode: 'complete',
                  overtimeMinutes: 0,
                }))
              }
            >
              Déménagement complet
            </button>
            <button
              type="button"
              aria-pressed={quoteConfig.billingMode === 'driver-rental'}
              className={quoteConfig.billingMode === 'driver-rental' ? 'active' : ''}
              onClick={() =>
                setQuoteConfig((current) => ({ ...current, billingMode: 'driver-rental' }))
              }
            >
              Location avec chauffeur
            </button>
          </div>
        </div>
        <div className="admin-quote-reference-setting">
          <span>Calcul</span>
          <div role="group" aria-label="Mode de calcul">
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
              Automatique
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
              Manuel
            </button>
          </div>
        </div>
        <div className="admin-quote-reference-setting">
          <span>Étape</span>
          <div role="group" aria-label="Étape du devis">
            <button
              type="button"
              aria-pressed={quoteKind === 'provisional'}
              className={quoteKind === 'provisional' ? 'active' : ''}
              onClick={() => setQuoteKind('provisional')}
            >
              Provisoire
            </button>
            <button
              type="button"
              aria-pressed={quoteKind === 'final'}
              className={quoteKind === 'final' ? 'active' : ''}
              title={
                !canCreateFinal
                  ? 'Une date est nécessaire pour enregistrer un devis final.'
                  : undefined
              }
              onClick={() => {
                setQuoteKind('final');
                setStageError('');
              }}
            >
              Final
            </button>
          </div>
        </div>
        <div className="admin-quote-reference-setting">
          <span>Matériel</span>
          <div role="group" aria-label="État de préparation du matériel">
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
          <span>Passage</span>
          <div role="group" aria-label="Passage par les escaliers ou le balcon">
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
            <span>Supplément passage par le balcon (FCFA)</span>
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
        <div className="admin-quote-reference-setting">
          <span>Embouteillages</span>
          <div role="group" aria-label="Prise en compte des embouteillages">
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
            <span>Récupération chaleur</span>
            <div role="group" aria-label="Récupération liée à la chaleur">
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
      </section>
    </>
  );
}
