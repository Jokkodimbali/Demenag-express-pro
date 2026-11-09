import { ClientQuestionnaire } from './booking/ClientQuestionnaire';
import type { ClientQuestion } from '../domain/model';
import type { Draft } from '../application/booking-draft';

export function AdminQuoteQuestionnaire({
  questions,
  draft,
  setDraft,
  open,
  onToggle,
}: {
  questions: ClientQuestion[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <ClientQuestionnaire
      questions={questions}
      answers={draft.questionnaireAnswers}
      open={open}
      onToggle={onToggle}
      onNavigate={(step) => {
        const targets = [
          '#admin-quote-client-fields',
          '#admin-quote-route-fields',
          '.call-inventory',
          '.admin-quote-vehicle-panel',
          '#admin-quote-option-fields',
          '.admin-quote-aside',
        ];
        window.requestAnimationFrame(() =>
          document
            .querySelector(targets[step - 1])
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
      }}
      onChange={(id, value) =>
        setDraft((current) => {
          const inventory = { ...current.inventory };
          if (id === 'key-ready') {
            inventory.ready = value.startsWith('Oui')
              ? 'oui'
              : value.startsWith('Non')
                ? 'non'
                : '';
          }
          if (id === 'key-stairs') {
            inventory.stairs = value.startsWith('Non, par le balcon')
              ? 'balcon'
              : value.startsWith('Non')
                ? 'non'
                : value.startsWith('Oui')
                  ? 'oui'
                  : value.startsWith('À vérifier')
                    ? 'verif'
                    : '';
          }
          return {
            ...current,
            inventory,
            questionnaireAnswers: { ...current.questionnaireAnswers, [id]: value },
          };
        })
      }
    />
  );
}
