import type { ClientQuestion } from './model';

type QuestionSeed = [string, string, boolean?];

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
      ['floor', 'À quel étage, et y a-t-il un ascenseur, au départ et à l’arrivée ?'],
      ['lift', 'L’ascenseur est-il assez grand pour un canapé ?', true],
      ['truck', 'Le camion peut-il se garer devant ? À quelle distance de la porte ?'],
    ],
  ],
  [
    'Inventaire',
    [
      ['dwelling', 'Quel type de logement (studio, F2, F3, villa…) ?'],
      ['items', 'Quels meubles et objets faut-il transporter ?'],
      ['assembly', 'Des meubles sont-ils à démonter et remonter ?', true],
      ['fragile', 'Avez-vous des objets fragiles ou de valeur ?', true],
      ['heavy', 'Avez-vous des objets très lourds (frigo américain, coffre, piano) ?', true],
    ],
  ],
  [
    'Jour du déménagement',
    [
      ['packing', 'Faites-vous l’emballage vous-même ou par notre équipe ?', true],
      ['cleaning', 'Besoin de nettoyage, de débarras ou de stockage ?', true],
      ['payment', 'Comment souhaitez-vous payer (Wave, Orange Money, espèces) ?'],
    ],
  ],
];

export const defaultClientQuestions: ClientQuestion[] = groups.flatMap(([group, items]) =>
  items.map(([id, label, yesNo]) => ({
    id,
    group,
    label,
    answerType: yesNo ? 'yes_no' : 'text',
    required: false,
    active: true,
  })),
);
