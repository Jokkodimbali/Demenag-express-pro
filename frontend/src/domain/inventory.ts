export type InventoryItem = {
  key: string;
  label: string;
  plural: string;
  section: string;
  sizeLabel?: string;
  defaultSize?: number;
  assembly?: 'desk' | 'wardrobe' | 'bed';
  canDismantle?: boolean;
  defaultDismantle?: boolean;
};

const section = (name: string, items: Omit<InventoryItem, 'section'>[]): InventoryItem[] =>
  items.map((item) => ({
    ...item,
    section: name,
    canDismantle: item.canDismantle ?? ['Salon & séjour', 'Chambres'].includes(name),
  }));

export const inventoryItems: InventoryItem[] = [
  ...section('Salon & séjour', [
    { key: 'salon', label: 'Salon', plural: 'Salons', sizeLabel: 'places', defaultSize: 5 },
    { key: 'table-basse', label: 'Table basse', plural: 'Tables basses' },
    { key: 'meuble-tv', label: 'Meuble TV', plural: 'Meubles TV' },
    { key: 'television', label: 'Télévision', plural: 'Télévisions' },
    { key: 'table-manger', label: 'Table à manger', plural: 'Tables à manger', canDismantle: true },
    { key: 'chaise', label: 'Chaise', plural: 'Chaises' },
    { key: 'buffet', label: 'Buffet', plural: 'Buffets' },
    { key: 'bibliotheque', label: 'Bibliothèque', plural: 'Bibliothèques' },
    { key: 'vitrine', label: 'Vitrine', plural: 'Vitrines' },
    { key: 'tapis', label: 'Tapis', plural: 'Tapis' },
  ]),
  ...section('Chambres', [
    {
      key: 'lit',
      label: 'Lit',
      plural: 'Lits',
      sizeLabel: 'places',
      defaultSize: 2,
      assembly: 'bed',
      defaultDismantle: true,
    },
    { key: 'matelas', label: 'Matelas', plural: 'Matelas' },
    {
      key: 'armoire',
      label: 'Armoire',
      plural: 'Armoires',
      sizeLabel: 'battants',
      defaultSize: 3,
      assembly: 'wardrobe',
      defaultDismantle: true,
    },
    { key: 'coiffeuse', label: 'Coiffeuse', plural: 'Coiffeuses' },
    { key: 'commode', label: 'Commode', plural: 'Commodes' },
    { key: 'chevet', label: 'Table de chevet', plural: 'Tables de chevet' },
    { key: 'bureau', label: 'Bureau', plural: 'Bureaux', assembly: 'desk' },
  ]),
  ...section('Cuisine & électroménager', [
    { key: 'frigo', label: 'Frigo', plural: 'Frigos' },
    { key: 'congelateur', label: 'Congélateur', plural: 'Congélateurs' },
    { key: 'cuisiniere', label: 'Cuisinière', plural: 'Cuisinières' },
    { key: 'machine-laver', label: 'Machine à laver', plural: 'Machines à laver' },
    { key: 'micro-ondes', label: 'Micro-ondes', plural: 'Micro-ondes' },
    {
      key: 'climatiseur',
      label: 'Climatiseur',
      plural: 'Climatiseurs',
      canDismantle: true,
      defaultDismantle: true,
    },
    { key: 'ventilateur', label: 'Ventilateur', plural: 'Ventilateurs' },
    { key: 'gaz', label: 'Bonbonne de gaz', plural: 'Bonbonnes de gaz' },
  ]),
  ...section('Divers', [
    { key: 'carton', label: 'Carton', plural: 'Cartons' },
    { key: 'sac', label: 'Sac ou valise', plural: 'Sacs ou valises' },
    { key: 'velo', label: 'Vélo', plural: 'Vélos' },
    { key: 'pot', label: 'Pot de fleurs', plural: 'Pots de fleurs' },
  ]),
];

export const inventoryFlags = [
  { key: 'emballage', label: 'Emballage à prévoir' },
  { key: 'fragile', label: 'Objets fragiles' },
  { key: 'escalier', label: 'Escalier étroit' },
  { key: 'acces', label: 'Accès camion difficile' },
  { key: 'nettoyage', label: 'Nettoyage après' },
] as const;

export type InventoryEntry = { quantity: number; size: number; dismantle: boolean };
export type Inventory = {
  fromFloor: number;
  toFloor: number;
  fromLift: boolean;
  toLift: boolean;
  entries: Record<string, InventoryEntry>;
  variants: { id: string; itemKey: string; quantity: number; size: number; dismantle: boolean }[];
  flags: Record<string, boolean>;
  custom: { id: string; label: string; quantity: number }[];
};

export const blankInventory = (): Inventory => ({
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
      return `${line.quantity} ${line.quantity > 1 ? item.plural : item.label}${size}${line.dismantle ? ' · démontage/montage' : ''}`;
    });
  });
  selected.push(
    ...inventory.custom
      .filter((item) => item.quantity > 0)
      .map((item) => `${item.quantity} ${item.label}`),
  );
  const flags = inventoryFlags
    .filter((flag) => inventory.flags[flag.key])
    .map((flag) => flag.label);
  const access = (floor: number, lift: boolean) =>
    `${floor === 0 ? 'RDC' : floor === 1 ? '1er étage' : `${floor}e étage`}${lift ? ' · ascenseur' : ''}`;
  return [
    `FICHE D'APPEL · INVENTAIRE`,
    `Accès : A · ${access(inventory.fromFloor, inventory.fromLift)} ; B · ${access(inventory.toFloor, inventory.toLift)}`,
    ...selected.map((line) => `- ${line}`),
    ...(flags.length ? [`À noter : ${flags.join(', ')}`] : []),
  ].join('\n');
}
