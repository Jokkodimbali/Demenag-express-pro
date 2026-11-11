import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ClientQuestion } from '../../../shared/domain/model';
import { defaultClientQuestions } from '../../../booking/domain/questionnaire';
import { visibleUiText } from '../../../shared/content/visible-ui-text';

export function QuestionnaireSettings({ questions }: { questions: ClientQuestion[] }) {
  const defaults = () => defaultClientQuestions.map((question) => ({ ...question }));
  const [items, setItems] = useState(() => (questions.length ? questions : defaults()));
  const [expanded, setExpanded] = useState(false);
  const pendingForm = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = pendingForm.current;
    pendingForm.current = null;
    form?.requestSubmit();
  }, [items]);

  function move(index: number, offset: -1 | 1, form: HTMLFormElement | null) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    pendingForm.current = form;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addQuestion(form: HTMLFormElement | null) {
    if (items.length >= 100) return;
    pendingForm.current = form;
    setItems((current) => [
      ...current,
      {
        id: `q-${crypto.randomUUID()}`,
        group: current.at(-1)?.group || visibleUiText.text109,
        label: visibleUiText.text110,
        hint: '',
        answerType: 'text',
        required: false,
        active: true,
      },
    ]);
  }

  function resetQuestions(form: HTMLFormElement | null) {
    pendingForm.current = form;
    setItems(defaults());
  }

  function removeQuestion(index: number, form: HTMLFormElement | null) {
    pendingForm.current = form;
    setItems((current) => {
      const remaining = current.filter((_, itemIndex) => itemIndex !== index);
      return remaining.length ? remaining : defaults();
    });
  }

  return (
    <section className="reference-settings-questionnaire">
      <div className="reference-settings-questionnaire-heading">
        <button
          className="reference-settings-questionnaire-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls="reference-settings-questionnaire-panel"
          onClick={() => setExpanded((current) => !current)}
        >
          <ChevronDown size={16} aria-hidden="true" />
          <strong className="reference-settings-card-title">{visibleUiText.text95}</strong>
        </button>
        <span>
          {items.length}
          {visibleUiText.text97}
        </span>
      </div>
      <div
        id="reference-settings-questionnaire-panel"
        className="reference-settings-questionnaire-panel"
        hidden={!expanded}
      >
        <span className="reference-settings-questionnaire-description">{visibleUiText.text96}</span>
        <input type="hidden" name="questionnaire.count" value={items.length} readOnly />
        <div className="reference-settings-questionnaire-list">
          {items.map((question, index) => (
            <div className="reference-settings-questionnaire-row" key={question.id}>
              <span className="reference-settings-questionnaire-index">{index + 1}</span>
              <div className="reference-settings-questionnaire-fields">
                <input
                  aria-label={visibleUiText.text98 + (index + 1)}
                  name={`questionnaire.${index}.group`}
                  value={question.group}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, group: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder={visibleUiText.text101}
                  maxLength={100}
                  required
                />
                <input
                  aria-label={visibleUiText.text99 + (index + 1)}
                  name={`questionnaire.${index}.label`}
                  value={question.label}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder={visibleUiText.text102}
                  maxLength={500}
                  minLength={3}
                  required
                />
                <input
                  aria-label={visibleUiText.text100 + (index + 1)}
                  name={`questionnaire.${index}.hint`}
                  value={question.hint ?? ''}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, hint: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder={visibleUiText.text103}
                  maxLength={1000}
                />
                <input type="hidden" name={`questionnaire.${index}.id`} value={question.id} />
                <input
                  type="hidden"
                  name={`questionnaire.${index}.answerType`}
                  value={question.answerType}
                />
                <input
                  type="hidden"
                  name={`questionnaire.${index}.required`}
                  value={String(question.required)}
                />
                <input
                  type="hidden"
                  name={`questionnaire.${index}.active`}
                  value={String(question.active)}
                />
              </div>
              <div className="reference-settings-questionnaire-actions">
                <button
                  type="button"
                  title={visibleUiText.text104 + (index + 1)}
                  aria-label={visibleUiText.text104 + (index + 1)}
                  disabled={index === 0}
                  onClick={(event) => move(index, -1, event.currentTarget.form)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title={visibleUiText.text105 + (index + 1)}
                  aria-label={visibleUiText.text105 + (index + 1)}
                  disabled={index === items.length - 1}
                  onClick={(event) => move(index, 1, event.currentTarget.form)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  title={visibleUiText.text106 + (index + 1)}
                  aria-label={visibleUiText.text106 + (index + 1)}
                  onClick={(event) => removeQuestion(index, event.currentTarget.form)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="reference-settings-questionnaire-footer">
          <button
            type="button"
            className="reference-settings-questionnaire-add"
            disabled={items.length >= 100}
            onClick={(event) => addQuestion(event.currentTarget.form)}
          >
            {visibleUiText.text107}
          </button>
          <button
            type="button"
            className="reference-settings-reset"
            onClick={(event) => resetQuestions(event.currentTarget.form)}
          >
            {visibleUiText.text108}
          </button>
        </div>
      </div>
    </section>
  );
}
