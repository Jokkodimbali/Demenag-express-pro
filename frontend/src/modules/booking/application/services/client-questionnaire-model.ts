import type { ClientQuestion } from '../../../shared/domain/model';

const fixedAnswerIds = ['key-ready', 'key-stairs'];

export function isClientQuestionAnswered(id: string, answers: Record<string, string>) {
  const answer = answers[id]?.trim();
  return id === 'key-ready' || id === 'key-stairs' ? Boolean(answer) : answer === 'Question posée';
}

export function clientQuestionnaireModel(
  questions: ClientQuestion[],
  answers: Record<string, string>,
  skipped: Record<string, boolean>,
) {
  const activeQuestions = questions.filter((question) => question.active);
  const answered =
    activeQuestions.filter((question) => isClientQuestionAnswered(question.id, answers)).length +
    fixedAnswerIds.filter((id) => answers[id]?.trim()).length;
  const totalQuestions = activeQuestions.length + fixedAnswerIds.length;
  const groups = [...new Set(activeQuestions.map((question) => question.group))].map((name) => {
    const groupQuestions = activeQuestions.filter((question) => question.group === name);
    return {
      name,
      questions: groupQuestions,
      answered: groupQuestions.filter((question) => isClientQuestionAnswered(question.id, answers))
        .length,
    };
  });
  const nextQuestion =
    activeQuestions.find(
      (question) => !isClientQuestionAnswered(question.id, answers) && !skipped[question.id],
    ) ?? activeQuestions.find((question) => !isClientQuestionAnswered(question.id, answers));

  return {
    activeQuestions,
    groups,
    answered,
    totalQuestions,
    nextQuestion,
    progress: totalQuestions ? (answered / totalQuestions) * 100 : 0,
  };
}

export function questionnaireStepFor(title: string) {
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
}
