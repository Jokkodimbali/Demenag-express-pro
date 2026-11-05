import { uiText } from '../../content/reference-ui-text';
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import type { ClientQuestion } from '../../domain/model';
import { visibleUiText } from '../../content/visible-ui-text';

export function ClientQuestionnaire({
  questions,
  answers,
  onChange,
  open,
  onToggle,
  onNavigate,
}: {
  questions: ClientQuestion[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  open: boolean;
  onToggle: () => void;
  onNavigate?: (step: number) => void;
}) {
  const activeQuestions = questions.filter((question) => question.active);
  const keyAnswers = ['key-ready', 'key-stairs'];
  const isAnswered = (id: string) => {
    const answer = answers[id]?.trim();
    return answer === 'Question posée';
  };
  const answered =
    activeQuestions.filter((question) => isAnswered(question.id)).length +
    keyAnswers.filter((id) => answers[id]?.trim()).length;
  const totalQuestions = activeQuestions.length + keyAnswers.length;
  const groups = [...new Set(activeQuestions.map((question) => question.group))];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const nextQuestion =
    activeQuestions.find((question) => !isAnswered(question.id) && !skipped[question.id]) ??
    activeQuestions.find((question) => !isAnswered(question.id));
  const progress = totalQuestions ? (answered / totalQuestions) * 100 : 0;
  const toggleQuestion = (id: string, checked: boolean) => {
    onChange(id, checked ? 'Question posée' : 'À poser');
  };
  const readyChoices = ['Oui, tout est prêt', 'Non, emballage par l’équipe'];
  const stairsChoices = ['Oui, tout passe', 'Non, certains objets', 'À vérifier'];
  const stepFor = (title: string) => {
    const value = title.toLocaleLowerCase('fr');
    if (/client|contact|date|disponib|connu|source/.test(value)) return 1;
    if (
      /adresse|accès|acces|trajet|étage|etage|ascenseur|stationnement|départ|arrivée|logement/.test(
        value,
      )
    )
      return 2;
    if (
      /inventaire|meuble|objet|carton|électro|electro|fragile|démont|demont|prêt|pret|escalier|chargement/.test(
        value,
      )
    )
      return 3;
    if (/véhicule|vehicule|équipe|equipe|manœuvre|manoeuvre|horaire|heure/.test(value)) return 4;
    if (/prix|paiement|péage|peage|option|remise|budget|tarif/.test(value)) return 5;
    return 6;
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="questionnaire-backdrop"
          aria-label="Fermer le questionnaire"
          onClick={onToggle}
        />
      )}
      <div className={`questionnaire-drawer ${open ? 'is-open' : ''}`}>
        <button type="button" className="questionnaire-tab" onClick={onToggle} aria-expanded={open}>
          {uiText['questionnaire']}
          {answered}/{totalQuestions}
        </button>
        {open && (
          <section className="questionnaire-panel" aria-label={uiText['questionnaireClient']}>
            <header>
              <div className="questionnaire-panel-heading">
                <strong>{uiText['questionnaireClient']}</strong>
                <button
                  type="button"
                  className="questionnaire-close"
                  onClick={onToggle}
                  aria-label={uiText['fermerLeQuestionnaire']}
                >
                  <X size={18} />
                </button>
              </div>
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
              {nextQuestion && (
                <div className="questionnaire-guided">
                  <span>
                    {visibleUiText.text14}
                    {activeQuestions.indexOf(nextQuestion) + 1} {visibleUiText.text15}
                    {activeQuestions.length} · {nextQuestion.group}
                  </span>
                  <strong>{nextQuestion.label}</strong>
                  {nextQuestion.hint && <small>{nextQuestion.hint}</small>}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(nextQuestion.id, 'Question posée');
                        setSkipped((current) => {
                          const next = { ...current };
                          delete next[nextQuestion.id];
                          return next;
                        });
                      }}
                    >
                      {visibleUiText.text16}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSkipped((current) => ({ ...current, [nextQuestion.id]: true }))
                      }
                    >
                      {visibleUiText.text17}
                    </button>
                  </div>
                </div>
              )}
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
                    <small>
                      {uiText['leTempsDEmballageEstAjouteAuPlanningPensezAPrevoirCart']}
                    </small>
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
                    <small>
                      {uiText['prevoirDemontageOuUnAutrePassageNotezLesObjetsConcerne']}
                    </small>
                  )}
                  {answers['key-stairs'] === stairsChoices[2] && (
                    <small>{uiText['demandezLaLargeurDeLEscalierEtDesPortesOuUnePhoto']}</small>
                  )}
                </label>
              </section>
              {groups.map((group) => {
                const groupQuestions = activeQuestions.filter(
                  (question) => question.group === group,
                );
                const groupAnswered = groupQuestions.filter((question) =>
                  isAnswered(question.id),
                ).length;
                const expanded = openGroups[group] ?? group === groups[0];
                return (
                  <section className="questionnaire-group" key={group}>
                    <div className="questionnaire-group-heading">
                      <button
                        type="button"
                        className="questionnaire-group-toggle"
                        aria-expanded={expanded}
                        onClick={() =>
                          setOpenGroups((current) => ({ ...current, [group]: !expanded }))
                        }
                      >
                        <span>
                          <ChevronDown size={16} />
                          {group}
                        </span>
                        <small>
                          <span
                            style={{
                              color:
                                groupAnswered === groupQuestions.length ? '#3ddc84' : '#aeb4bb',
                            }}
                          >
                            {groupAnswered}/{groupQuestions.length}
                          </span>
                        </small>
                      </button>
                      {onNavigate && (
                        <button
                          type="button"
                          className="questionnaire-step-link"
                          onClick={() => onNavigate(stepFor(group))}
                        >
                          Étape {stepFor(group)} →
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="questionnaire-group-questions">
                        {groupQuestions.map((question) => {
                          const checked = isAnswered(question.id);
                          const status =
                            question.hint ||
                            (checked ? visibleUiText.text112 : visibleUiText.text113);
                          return (
                            <label
                              className={`questionnaire-question ${checked ? 'is-answered' : ''}`}
                              key={question.id}
                            >
                              <input
                                className="questionnaire-check"
                                type="checkbox"
                                aria-label={visibleUiText.text111 + question.label}
                                checked={checked}
                                onChange={(event) =>
                                  toggleQuestion(question.id, event.target.checked)
                                }
                              />
                              <div>
                                <span className="questionnaire-question-label">
                                  {question.label}
                                </span>
                                <span className="questionnaire-question-status">{status}</span>
                              </div>
                            </label>
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
    </>
  );
}
