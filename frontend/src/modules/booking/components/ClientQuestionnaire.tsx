import { uiText } from '../../shared/content/reference-ui-text';
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import type { ClientQuestion } from '../../shared/domain/model';
import { visibleUiText } from '../../shared/content/visible-ui-text';
import {
  clientQuestionnaireModel,
  isClientQuestionAnswered,
  questionnaireStepFor,
} from '../application/services/client-questionnaire-model';

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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const { activeQuestions, groups, answered, totalQuestions, nextQuestion, progress } =
    clientQuestionnaireModel(questions, answers, skipped);
  const toggleQuestion = (id: string, checked: boolean) => {
    onChange(id, checked ? 'Question posée' : 'À poser');
  };
  const readyChoices = ['Oui, tout est prêt', 'Non, emballage par l’équipe'];
  const stairsChoices = [
    'Oui, tout passe',
    'Non, certains objets',
    'Non, par le balcon',
    'À vérifier',
  ];
  return (
    <>
      {open && (
        <button
          type="button"
          className="questionnaire-backdrop"
          aria-label={visibleUiText.text169}
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
                    <small>{visibleUiText.text170}</small>
                  )}
                  {answers['key-stairs'] === stairsChoices[3] && (
                    <small>{uiText['demandezLaLargeurDeLEscalierEtDesPortesOuUnePhoto']}</small>
                  )}
                </label>
              </section>
              {groups.map(
                (
                  { name: group, questions: groupQuestions, answered: groupAnswered },
                  groupIndex,
                ) => {
                  const expanded = openGroups[group] ?? groupIndex === 0;
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
                            onClick={() => onNavigate(questionnaireStepFor(group))}
                          >
                            {visibleUiText.text171}
                            {questionnaireStepFor(group)} →
                          </button>
                        )}
                      </div>
                      {expanded && (
                        <div className="questionnaire-group-questions">
                          {groupQuestions.map((question) => {
                            const checked = isClientQuestionAnswered(question.id, answers);
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
                },
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
