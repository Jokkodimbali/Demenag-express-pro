import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import { defaultClientQuestions } from '../domain/questionnaire';
import type { ClientQuestion } from '../domain/model';

export function AdminQuestionnaireSettings() {
  const { api, catalogue, setCatalogue } = useApp();
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (catalogue) {
      setQuestions(catalogue.settings.questionnaire ?? defaultClientQuestions);
    }
  }, [catalogue]);

  function updateQuestion(index: number, patch: Partial<ClientQuestion>) {
    setQuestions((current) =>
      current.map((question, position) =>
        position === index ? { ...question, ...patch } : question,
      ),
    );
    setSaved(false);
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      {
        id: crypto.randomUUID().replaceAll('-', ''),
        group: 'Nouvelle rubrique',
        label: '',
        answerType: 'text',
        required: false,
        active: true,
      },
    ]);
    setSaved(false);
  }

  async function saveQuestions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.updateCatalogue({
        ...catalogue,
        settings: { ...catalogue.settings, questionnaire: questions },
      });
      setCatalogue(updated);
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!catalogue) return null;

  return (
    <form className="settings-form questionnaire-settings" onSubmit={saveQuestions}>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Questionnaire client</h2>
            <p>
              Personnalisez les questions posées pendant l’appel. Les réponses restent attachées au
              devis créé, même si vous modifiez ensuite le questionnaire.
            </p>
          </div>
          <button type="button" className="button secondary" onClick={addQuestion}>
            <Plus size={17} /> Ajouter une question
          </button>
        </div>
        {questions.map((question, index) => (
          <fieldset className="questionnaire-setting-row" key={question.id}>
            <legend>Question {index + 1}</legend>
            <label>
              Rubrique
              <input
                required
                maxLength={100}
                value={question.group}
                onChange={(event) => updateQuestion(index, { group: event.target.value })}
              />
            </label>
            <label className="questionnaire-setting-label">
              Question
              <input
                required
                minLength={3}
                maxLength={500}
                value={question.label}
                onChange={(event) => updateQuestion(index, { label: event.target.value })}
              />
            </label>
            <label>
              Type de réponse
              <select
                value={question.answerType}
                onChange={(event) =>
                  updateQuestion(index, {
                    answerType: event.target.value === 'yes_no' ? 'yes_no' : 'text',
                  })
                }
              >
                <option value="text">Texte libre</option>
                <option value="yes_no">Oui / non / à vérifier</option>
              </select>
            </label>
            <label className="questionnaire-setting-check">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(event) => updateQuestion(index, { required: event.target.checked })}
              />
              Réponse obligatoire
            </label>
            <label className="questionnaire-setting-check">
              <input
                type="checkbox"
                checked={question.active}
                onChange={(event) => updateQuestion(index, { active: event.target.checked })}
              />
              Active dans les nouveaux devis
            </label>
            <button
              type="button"
              className="button text danger small"
              aria-label={'Supprimer la question ' + question.label}
              onClick={() => {
                setQuestions((current) => current.filter((_, position) => position !== index));
                setSaved(false);
              }}
            >
              <Trash2 size={16} /> Supprimer
            </button>
          </fieldset>
        ))}
        {questions.length === 0 && (
          <p className="muted">Aucune question. Ajoutez une question pour commencer.</p>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="alert success" role="status">
            Questionnaire enregistré.
          </p>
        )}
        <button className="button primary" disabled={busy || questions.length > 100}>
          <Save size={17} /> {busy ? 'Enregistrement…' : 'Enregistrer le questionnaire'}
        </button>
      </section>
    </form>
  );
}
