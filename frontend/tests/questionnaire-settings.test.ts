import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientQuestion } from '../src/domain/model';
import { questionnaireFromForm } from '../src/application/validation/forms';

const original: ClientQuestion[] = [
  {
    id: 'q1',
    group: 'Client',
    label: 'Nom du client ?',
    hint: 'Nom complet.',
    answerType: 'text',
    required: true,
    active: true,
  },
  {
    id: 'q2',
    group: 'Départ',
    label: 'Adresse de départ ?',
    answerType: 'yes_no',
    required: false,
    active: false,
  },
];

function questionFields(data: FormData, index: number, question: ClientQuestion): void {
  for (const [key, value] of Object.entries(question)) {
    if (value !== undefined) data.set(`questionnaire.${index}.${key}`, String(value));
  }
}

test('questionnaire settings retain identifiers and metadata when edited and reordered', () => {
  const data = new FormData();
  data.set('questionnaire.count', '2');
  questionFields(data, 0, { ...original[1], group: 'Arrivée', label: 'Adresse exacte ?' });
  questionFields(data, 1, { ...original[0], hint: 'Conseil modifié.' });

  assert.deepEqual(questionnaireFromForm(data, original), [
    { ...original[1], group: 'Arrivée', label: 'Adresse exacte ?' },
    { ...original[0], hint: 'Conseil modifié.' },
  ]);
});

test('questionnaire settings accept an empty list and ignore a missing count', () => {
  const empty = new FormData();
  empty.set('questionnaire.count', '0');
  assert.deepEqual(questionnaireFromForm(empty, original), []);
  assert.deepEqual(questionnaireFromForm(new FormData(), original), original);
});
