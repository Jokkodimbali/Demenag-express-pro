import type { ClientQuestion } from './model.js';

type QuestionSeed = [string, string, ('text' | 'yes_no')?];

const groups: [string, QuestionSeed[]][] = [
  [
    'Client',
    [
      ['name', 'Quel est votre nom et prénom ?'],
      ['phone', 'Quel numéro pour vous joindre ? Est-il sur WhatsApp ?'],
      ['date', 'Quelle date souhaitez-vous ?'],
      ['time', 'À quelle heure peut-on commencer ?'],
    ],
  ],
  [
    'Adresses et accès',
    [
      ['from', 'Quelle est l’adresse de départ ?'],
      ['to', 'Quelle est l’adresse d’arrivée ?'],
      ['rep', 'Quels repères pour trouver les lieux (bâtiment, porte, lieu connu) ?'],
      ['floor', 'À quel étage, au départ et à l’arrivée ?'],
      ['lift', 'Y a-t-il un ascenseur assez grand pour les meubles ?', 'yes_no'],
      ['truck', 'Le camion peut-il se garer devant ? À quelle distance de la porte ?'],
    ],
  ],
  [
    'Inventaire',
    [
      ['dwelling', 'Quel type de logement (studio, F2, F3, villa…) ?'],
      ['items', 'Quels meubles et objets faut-il transporter ?'],
      ['assembly', 'Des meubles sont-ils à démonter et remonter ?', 'yes_no'],
      ['fragile', 'Avez-vous des objets fragiles ou de valeur ?', 'yes_no'],
      ['heavy', 'Avez-vous des objets très lourds (frigo américain, coffre, piano) ?', 'yes_no'],
    ],
  ],
  [
    'Jour du déménagement',
    [
      ['packing', 'Faites-vous l’emballage vous-même ou par notre équipe ?', 'yes_no'],
      ['cleaning', 'Besoin de nettoyage, de débarras ou de stockage ?', 'yes_no'],
      ['payment', 'Comment souhaitez-vous payer (Wave, Orange Money, espèces) ?'],
    ],
  ],
];

export const defaultClientQuestions: ClientQuestion[] = groups.flatMap(([group, items]) =>
  items.map(([id, label, answerType]) => ({
    id,
    group,
    label,
    answerType: answerType ?? 'text',
    required: false,
    active: true,
  })),
);
