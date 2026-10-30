import { uiText } from '../../content/reference-ui-text';
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import type { ClientQuestion } from '../../domain/model';

export function ClientQuestionnaire({
  questions,
  answers,
  onChange,
  open,
  onToggle,
  autoAnswers,
  autoQuestionIds,
}: {
  questions: ClientQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  open: boolean;
  onToggle: () => void;
  autoAnswers: Record<string, boolean>;
  autoQuestionIds: string[];
}) {
  const activeQuestions = questions.filter((question) => question.active);
  const keyAnswers = ['key-ready', 'key-stairs'];
  const isAnswered = (id: string) => {
    const answer = answers[id]?.trim();
    if (answer === 'À poser') return false;
    return answer === 'Question posée' || Boolean(answer || autoAnswers[id]);
  };
  const answered =
    activeQuestions.filter((question) => isAnswered(question.id)).length +
    keyAnswers.filter((id) => answers[id]?.trim()).length;
  const totalQuestions = activeQuestions.length + keyAnswers.length;
  const groups = [...new Set(activeQuestions.map((question) => question.group))];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const progress = totalQuestions ? (answered / totalQuestions) * 100 : 0;
  const toggleQuestion = (id: string, checked: boolean) => {
    onChange(id, checked ? 'Question posée' : 'À poser');
  };
  const readyChoices = ['Oui, tout est prêt', 'Non, emballage par l’équipe'];
  const stairsChoices = ['Oui, tout passe', 'Non, certains objets', 'À vérifier'];

  return (
    <div className={`questionnaire-drawer ${open ? 'is-open' : ''}`}>
      <button type="button" className="questionnaire-tab" onClick={onToggle} aria-expanded={open}>
        {uiText['questionnaire']}
        {answered}/{totalQuestions}
      </button>
      {open && (
        <section className="questionnaire-panel" aria-label={uiText['questionnaireClient']}>
          <header>
            <div className="questionnaire-panel-title">
              <strong>{uiText['questionnaireClient']}</strong>
              <span>{uiText['lesCasesSeCochentAvecLesInformationsDuDevisVousPouvezL']}</span>
            </div>
            <button
              type="button"
              className="questionnaire-close"
              onClick={onToggle}
              aria-label={uiText['fermerLeQuestionnaire']}
            >
              <X size={18} />
            </button>
            <div
              className="questionnaire-progress"
              aria-label={`${answered} informations réunies sur ${totalQuestions}`}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong className="questionnaire-progress-label">
              {answered}/{totalQuestions} {uiText['informationsReunies']}
            </strong>
          </header>
          <div className="questionnaire-groups">
            {!activeQuestions.length && <p>{uiText['aucuneQuestionActive']}</p>}
            <section className="questionnaire-key-questions">
              <strong>{uiText['questionsCLES']}</strong>
              <label>
                <span>{uiText['leMaterielSeraTIlPretAEtreCharge']}</span>
                <span
                  className="questionnaire-key-choices"
                  role="group"
                  aria-label={uiText['leMaterielSeraTIlPretAEtreCharge']}
                >
                  {readyChoices.map((choice) => (
                    <button
                      type="button"
                      key={choice}
                      className={answers['key-ready'] === choice ? 'active' : ''}
                      aria-pressed={answers['key-ready'] === choice}
                      onClick={() =>
                        onChange('key-ready', answers['key-ready'] === choice ? '' : choice)
                      }
                    >
                      {choice}
                    </button>
                  ))}
                </span>
                {answers['key-ready'] === readyChoices[1] && (
                  <small>{uiText['leTempsDEmballageEstAjouteAuPlanningPensezAPrevoirCart']}</small>
                )}
              </label>
              <label>
                <span>{uiText['toutLeMaterielPasseTIlDansLesEscaliers']}</span>
                <span
                  className="questionnaire-key-choices"
                  role="group"
                  aria-label={uiText['toutLeMaterielPasseTIlDansLesEscaliers']}
                >
                  {stairsChoices.map((choice) => (
                    <button
                      type="button"
                      key={choice}
                      className={answers['key-stairs'] === choice ? 'active' : ''}
                      aria-pressed={answers['key-stairs'] === choice}
                      onClick={() =>
                        onChange('key-stairs', answers['key-stairs'] === choice ? '' : choice)
                      }
                    >
                      {choice}
                    </button>
                  ))}
                </span>
                {answers['key-stairs'] === stairsChoices[1] && (
                  <small>{uiText['prevoirDemontageOuUnAutrePassageNotezLesObjetsConcerne']}</small>
                )}
                {answers['key-stairs'] === stairsChoices[2] && (
                  <small>{uiText['demandezLaLargeurDeLEscalierEtDesPortesOuUnePhoto']}</small>
                )}
              </label>
            </section>
            {groups.map((group) => {
              const groupQuestions = activeQuestions.filter((question) => question.group === group);
              const groupAnswered = groupQuestions.filter((question) =>
                isAnswered(question.id),
              ).length;
              const expanded = openGroups[group] ?? group === groups[0];
              return (
                <section className="questionnaire-group" key={group}>
                  <button
                    type="button"
                    className="questionnaire-group-toggle"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroups((current) => ({ ...current, [group]: !expanded }))}
                  >
                    <span>
                      <ChevronDown size={16} />
                      {group}
                    </span>
                    <small>
                      {groupAnswered}/{groupQuestions.length}
                    </small>
                  </button>
                  {expanded && (
                    <div className="questionnaire-group-questions">
                      {groupQuestions.map((question) => {
                        const answer = answers[question.id] ?? '';
                        const checked = isAnswered(question.id);
                        const autoTracked = autoQuestionIds.includes(question.id);
                        const manuallyUnchecked = answer.trim() === 'À poser';
                        const status = checked
                          ? answer.trim() === 'Question posée'
                            ? 'Question posée'
                            : 'Réponse saisie dans le devis'
                          : autoTracked && !manuallyUnchecked
                            ? 'Réponse à saisir dans le devis'
                            : 'Cochez une fois la question posée';
                        return (
                          <div
                            className={`questionnaire-question ${answer.trim() ? 'is-answered' : ''}`}
                            key={question.id}
                          >
                            <input
                              className="questionnaire-check"
                              type="checkbox"
                              aria-label={`Marquer comme posé : ${question.label}`}
                              checked={checked}
                              onChange={(event) =>
                                toggleQuestion(question.id, event.target.checked)
                              }
                            />
                            <div>
                              <span className="questionnaire-question-label">{question.label}</span>
                              <span
                                className={
                                  autoAnswers[question.id] &&
                                  !['À poser', 'Question posée'].includes(answer.trim())
                                    ? 'questionnaire-auto-status'
                                    : 'questionnaire-question-status'
                                }
                              >
                                {status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
