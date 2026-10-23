export type InventoryItem = {
  key: string;
  label: string;
  plural: string;
  section: string;
  sizeLabel?: string;
  defaultSize?: number;
  hasFormat?: boolean;
  assembly?: 'desk' | 'wardrobe' | 'bed';
  canDismantle?: boolean;
  defaultDismantle?: boolean;
  tip?: string;
  volumeByFormat?: [number, number, number];
  sizeName?: (size: number) => string;
};

const section = (name: string, items: Omit<InventoryItem, 'section'>[]): InventoryItem[] =>
  items.map((item) => ({
    ...item,
    section: name,
    canDismantle: item.canDismantle ?? ['Salon & séjour', 'Chambres'].includes(name),
  }));

export const inventoryItems: InventoryItem[] = [
  ...section('Salon & séjour', [
    {
      key: 'salon',
      label: 'Salon',
      plural: 'Salons',
      sizeLabel: 'places',
      defaultSize: 5,
      tip: 'Protéger le tissu ou le cuir avec une housse.',
      sizeName: (size) =>
        size <= 3 ? 'canapé seul' : size <= 5 ? 'canapé et fauteuils' : 'grand salon en U / angle',
    },
    {
      key: 'table-basse',
      label: 'Table basse',
      plural: 'Tables basses',
      hasFormat: true,
      volumeByFormat: [0.25, 0.4, 0.6],
    },
    {
      key: 'meuble-tv',
      label: 'Meuble TV',
      plural: 'Meubles TV',
      hasFormat: true,
      volumeByFormat: [0.35, 0.6, 1],
    },
    {
      key: 'television',
      label: 'Télévision',
      plural: 'Télévisions',
      hasFormat: true,
      volumeByFormat: [0.15, 0.25, 0.4],
      tip: "Dans son carton d'origine si possible, toujours debout, écran protégé.",
    },
    {
      key: 'table-manger',
      label: 'Table à manger',
      plural: 'Tables à manger',
      sizeLabel: 'places',
      defaultSize: 6,
      sizeName: (size) =>
        size <= 4
          ? 'petite table carrée'
          : size <= 6
            ? 'table rectangulaire'
            : 'grande table familiale',
      canDismantle: true,
    },
    {
      key: 'chaise',
      label: 'Chaise',
      plural: 'Chaises',
      hasFormat: true,
      volumeByFormat: [0.05, 0.25, 0.4],
    },
    {
      key: 'buffet',
      label: 'Buffet',
      plural: 'Buffets',
      hasFormat: true,
      volumeByFormat: [1, 1.5, 2.2],
      tip: 'Vider et caler les tiroirs et portes.',
    },
    {
      key: 'bibliotheque',
      label: 'Bibliothèque',
      plural: 'Bibliothèques',
      hasFormat: true,
      volumeByFormat: [0.6, 1.2, 2],
    },
    {
      key: 'vitrine',
      label: 'Vitrine',
      plural: 'Vitrines',
      hasFormat: true,
      volumeByFormat: [0.6, 1.2, 1.8],
      tip: 'Retirer les vitres et les emballer séparément.',
    },
    {
      key: 'tapis',
      label: 'Tapis',
      plural: 'Tapis',
      hasFormat: true,
      volumeByFormat: [0.05, 0.15, 0.3],
    },
  ]),
  ...section('Chambres', [
    {
      key: 'lit',
      label: 'Lit',
      plural: 'Lits',
      sizeLabel: 'places',
      defaultSize: 2,
      sizeName: (size) =>
        size <= 1
          ? 'lit simple, 90 cm'
          : size === 2
            ? 'lit double, 140–160 cm'
            : 'king size, 180 cm et plus',
      assembly: 'bed',
      defaultDismantle: true,
      tip: 'Démonter le cadre pour réduire le volume et garder la visserie dans un sachet.',
    },
    {
      key: 'matelas',
      label: 'Matelas',
      plural: 'Matelas',
      sizeLabel: 'places',
      defaultSize: 2,
      sizeName: (size) =>
        size <= 1
          ? 'simple, 90 cm'
          : size === 2
            ? 'double, 140–160 cm'
            : 'king size, 180 cm et plus',
      tip: 'Protéger avec une housse plastique.',
    },
    {
      key: 'armoire',
      label: 'Armoire',
      plural: 'Armoires',
      sizeLabel: 'battants',
      defaultSize: 3,
      sizeName: (size) =>
        size <= 2
          ? 'penderie 2 portes'
          : size === 3
            ? 'armoire 3 battants'
            : 'grande armoire, 4 battants et plus',
      assembly: 'wardrobe',
      defaultDismantle: true,
      tip: 'Vider entièrement. Démonter les portes et étagères avant le chargement.',
    },
    {
      key: 'coiffeuse',
      label: 'Coiffeuse',
      plural: 'Coiffeuses',
      hasFormat: true,
      volumeByFormat: [0.4, 0.6, 1],
    },
    {
      key: 'commode',
      label: 'Commode',
      plural: 'Commodes',
      hasFormat: true,
      volumeByFormat: [0.5, 0.7, 1.1],
    },
    {
      key: 'chevet',
      label: 'Table de chevet',
      plural: 'Tables de chevet',
      hasFormat: true,
      volumeByFormat: [0.1, 0.2, 0.3],
    },
    {
      key: 'bureau',
      label: 'Bureau',
      plural: 'Bureaux',
      assembly: 'desk',
      hasFormat: true,
      volumeByFormat: [0.5, 0.9, 1.5],
    },
  ]),
  ...section('Cuisine & électroménager', [
    {
      key: 'frigo',
      label: 'Frigo',
      plural: 'Frigos',
      hasFormat: true,
      volumeByFormat: [0.35, 1, 1.8],
      tip: 'Vider et débrancher 24 h avant. Transporter debout et attendre 4 h avant de rebrancher.',
    },
    {
      key: 'congelateur',
      label: 'Congélateur',
      plural: 'Congélateurs',
      hasFormat: true,
      volumeByFormat: [0.5, 0.9, 1.2],
      tip: 'Dégivrer la veille et transporter debout si possible.',
    },
    {
      key: 'cuisiniere',
      label: 'Cuisinière',
      plural: 'Cuisinières',
      hasFormat: true,
      volumeByFormat: [0.25, 0.6, 0.9],
      tip: 'Débrancher le gaz et fixer la porte du four.',
    },
    {
      key: 'machine-laver',
      label: 'Machine à laver',
      plural: 'Machines à laver',
      hasFormat: true,
      volumeByFormat: [0.4, 0.5, 0.6],
      tip: 'Bloquer le tambour avec ses brides et vidanger le tuyau.',
    },
    { key: 'micro-ondes', label: 'Micro-ondes', plural: 'Micro-ondes' },
    {
      key: 'climatiseur',
      label: 'Climatiseur',
      plural: 'Climatiseurs',
      hasFormat: true,
      volumeByFormat: [0.25, 0.4, 0.7],
      canDismantle: true,
      defaultDismantle: true,
      tip: 'Le démontage doit être réalisé par un technicien, avec récupération du gaz avant déconnexion.',
    },
    { key: 'ventilateur', label: 'Ventilateur', plural: 'Ventilateurs' },
    { key: 'gaz', label: 'Bonbonne de gaz', plural: 'Bonbonnes de gaz' },
  ]),
  ...section('Divers', [
    {
      key: 'carton',
      label: 'Carton',
      plural: 'Cartons',
      hasFormat: true,
      volumeByFormat: [0.04, 0.07, 0.12],
      tip: 'Environ 20 kg maximum par carton ; privilégier les petits cartons pour les livres.',
    },
    {
      key: 'sac',
      label: 'Sac ou valise',
      plural: 'Sacs ou valises',
      hasFormat: true,
      volumeByFormat: [0.05, 0.1, 0.15],
    },
    {
      key: 'velo',
      label: 'Vélo',
      plural: 'Vélos',
      hasFormat: true,
      volumeByFormat: [0.3, 0.5, 0.7],
    },
    {
      key: 'pot',
      label: 'Pot de fleurs',
      plural: 'Pots de fleurs',
      hasFormat: true,
      volumeByFormat: [0.05, 0.15, 0.4],
      tip: 'Protéger le pot et stabiliser la terre et les branches.',
    },
  ]),
];

export type InventoryFormat = 'small' | 'medium' | 'large';
export const inventoryFormats: { value: InventoryFormat; label: string }[] = [
  { value: 'small', label: 'Petit' },
  { value: 'medium', label: 'Moyen' },
  { value: 'large', label: 'Grand' },
];
const formatHints: Record<string, [string, string, string]> = {
  'table-basse': ['petite, ronde', 'standard', 'grande, avec plateau verre'],
  'meuble-tv': ['moins de 1,20 m', '1,20 à 1,80 m', 'plus de 1,80 m'],
  television: ['moins de 40 pouces', '40 à 55 pouces', 'plus de 55 pouces'],
  chaise: ['plastique empilable', 'bois ou métal', 'rembourrée'],
  buffet: ['moins de 1,20 m', '1,20 à 1,80 m', 'plus de 1,80 m'],
  bibliotheque: ['basse', 'environ 1,80 m de haut', 'haute ou très large'],
  vitrine: ['basse', 'environ 1,80 m de haut', 'haute ou très large'],
  tapis: ['descente de lit', 'salon moyen', 'grand tapis'],
  coiffeuse: ['sans miroir', 'avec miroir', 'grande avec rangements'],
  commode: ['3 tiroirs', '4–5 tiroirs', 'large, 6 tiroirs et plus'],
  chevet: ['petite', 'standard', 'grande'],
  bureau: ['petit, sans tiroir', 'standard', 'd’angle / grand'],
  frigo: ['bar / sous-plan', '1 ou 2 portes, environ 1,60 m', 'américain, environ 1,85 m'],
  congelateur: ['petit coffre', 'coffre moyen', 'grand coffre / armoire'],
  cuisiniere: ['réchaud 2 feux', '4 feux avec four', '5–6 feux, grande'],
  'machine-laver': ['top, 5 kg', 'hublot, 7 kg', '10 kg et plus'],
  climatiseur: ['split mural', 'split + unité extérieure', 'armoire / colonne'],
  carton: ['livres (environ 35 L)', 'standard (environ 55 L)', 'linge (environ 100 L)'],
  sac: ['bagage cabine', 'valise moyenne', 'grande valise / gros sac'],
  velo: ['enfant', 'adulte', 'électrique / VTT'],
  pot: ['petit pot', 'pot moyen', 'grand bac / arbuste'],
};
export function inventoryFormatHint(key: string, format: InventoryFormat = 'medium'): string {
  const index = inventoryFormats.findIndex((option) => option.value === format);
  return formatHints[key]?.[index] ?? '';
}

export const inventoryFlags = [
  { key: 'emballage', label: 'Emballage à prévoir' },
  { key: 'fragile', label: 'Objets fragiles' },
  { key: 'escalier', label: 'Escalier étroit' },
  { key: 'acces', label: 'Accès camion difficile' },
  { key: 'nettoyage', label: 'Nettoyage après' },
] as const;

export type InventoryEntry = {
  quantity: number;
  size: number;
  format?: InventoryFormat;
  dismantle: boolean;
};
export type Inventory = {
  dwellingType: string;
  fromFloor: number;
  toFloor: number;
  fromLift: boolean;
  toLift: boolean;
  entries: Record<string, InventoryEntry>;
  variants: {
    id: string;
    itemKey: string;
    quantity: number;
    size: number;
    format?: InventoryFormat;
    dismantle: boolean;
  }[];
  flags: Record<string, boolean>;
  custom: { id: string; label: string; quantity: number; format?: InventoryFormat }[];
  crew?: number;
};

export const blankInventory = (): Inventory => ({
  dwellingType: '',
  fromFloor: 0,
  toFloor: 0,
  fromLift: false,
  toLift: false,
  entries: {},
  variants: [],
  flags: {},
  custom: [],
});

export function inventoryNote(inventory: Inventory): string {
  const selected = inventoryItems.flatMap((item) => {
    const entry = inventory.entries[item.key];
    const lines = [
      entry,
      ...inventory.variants.filter((variant) => variant.itemKey === item.key),
    ].filter((line) => line?.quantity);
    return lines.map((line) => {
      const size = item.sizeLabel ? ` · ${line.size} ${item.sizeLabel}` : '';
      const format = item.hasFormat
        ? ` · ${inventoryFormats.find((option) => option.value === (line.format ?? 'medium'))?.label.toLowerCase()}${inventoryFormatHint(item.key, line.format).trim() ? ` (${inventoryFormatHint(item.key, line.format)})` : ''}`
        : '';
      return `${line.quantity} ${line.quantity > 1 ? item.plural : item.label}${size}${format}${line.dismantle ? ' · démontage/montage' : ''}`;
    });
  });
  selected.push(
    ...inventory.custom
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const format =
          inventoryFormats.find((option) => option.value === (item.format ?? 'medium'))?.label ??
          'Moyen';
        return `${item.quantity} ${item.label} · ${format.toLowerCase()} format`;
      }),
  );
  const flags = inventoryFlags
    .filter((flag) => inventory.flags[flag.key])
    .map((flag) => flag.label);
  const access = (floor: number, lift: boolean) =>
    `${floor === 0 ? 'RDC' : floor === 1 ? '1er étage' : `${floor}e étage`}${lift ? ' · ascenseur' : ''}`;
  return [
    `FICHE D'APPEL · INVENTAIRE`,
    ...(inventory.dwellingType ? [`Type de logement : ${inventory.dwellingType}`] : []),
    `Accès : A · ${access(inventory.fromFloor, inventory.fromLift)} ; B · ${access(inventory.toFloor, inventory.toLift)}`,
    ...selected.map((line) => `- ${line}`),
    ...(flags.length ? [`À noter : ${flags.join(', ')}`] : []),
  ].join('\n');
}
