import type { Inventory } from '../../domain/inventory/inventory';
import { inventoryItems } from '../../domain/inventory/inventory';
import { estimatedInventoryItemVolume } from '../../domain/estimate/moving-estimate';
import { referenceItemWeight } from '../../domain/estimate/moving-estimate-inventory';
import type { Vehicle } from '../../../shared/domain/model';
import { referenceAnnexVolume } from '../../domain/estimate/reference-inventory-note';

export type SimBox = {
  step: number;
  u: { label: string; c: string; k?: string };
  txt: string;
  tip?: string;
  prot?: boolean;
  protTxt?: string;
  kg?: number;
};
export type SimTrip = {
  boxes: SimBox[];
  walls: { title: string; steps: SimBox[] }[];
  fill: number;
  vol: number;
  nItems: number;
  kg: number;
  left: number;
  front: number;
  need: number;
  stock: number;
  checks: { txt?: string; t?: string; text?: string; ok?: boolean }[];
  blankets?: number;
  straps?: number;
  noProt?: number;
};
export type SimPlan = {
  trips: SimTrip[];
  out: string[];
  V: { net: number };
  colors: Record<string, string>;
};
export type SimView = {
  ok: boolean;
  load: (trip: SimTrip, plan: SimPlan, options: { wrap: boolean }) => void;
  setView: (view: string) => void;
  show: (step: number | null) => void;
  crew?: (config: {
    on: boolean;
    man: number;
    menu: number;
    from: string;
    site: { F: number; lift: boolean };
  }) => void;
  dispose: () => void;
};
type SimEngine = {
  plan: (input: unknown) => SimPlan;
  view: (element: HTMLElement, options: { onPick: (step: number) => void }) => SimView;
  snapshot: (plan: SimPlan, tripIndex: number, options: { wrap: boolean }) => string | null;
  shots?: (key: string) => string[] | null;
  stepShots?: (
    plan: SimPlan,
    tripIndex: number,
    options: { wrap: boolean; bg?: number; aspect?: number },
    key: string,
  ) => string[] | null;
};
type EquipArt = { art: (key: string) => string };
declare global {
  interface Window {
    DemSim?: SimEngine;
    THREE?: unknown;
    EquipArt?: EquipArt;
  }
}

export const format = (value: number) => value.toFixed(1).replace('.', ',');
export const tripLabel = (count: number) =>
  `${count} ${count > 1 ? 'allers-retours' : 'aller-retour'}`;
export const loadingRules = [
  'Arrimage EN 12195-1 / ISO 27956 : la charge doit tenir 0,8 g vers l’avant et 0,5 g sur les côtés et vers l’arrière. Bloquer contre la cloison de cabine, puis sangler chaque mur avec au moins 2 sangles LC 400 daN.',
  'Murs du sol au plafond, serrés, sans vide : combler chaque vide avec cartons, sacs ou matelas.',
  'Centre de gravité bas et centré : lourd au sol contre la cabine, équilibre gauche / droite à ±10 %, charge utile jamais dépassée.',
  'Électroménager toujours debout ; matelas, panneaux et plateaux sur la tranche contre les parois.',
  'Fragile en haut et protégé : écrans, vitres et miroirs sur la tranche, enveloppés, jamais à plat ni sous une charge.',
  'Manutention ISO 11228-1 : 25 kg maximum par personne, port à deux au-delà, aide mécanique (diable, sangles de portage) au-delà de 33 kg.',
  'Dernier chargé, premier déchargé : ce qui sert d’abord à l’arrivée va près des portes.',
];
const dimension = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;
const itemKeys: Record<string, string> = {
  'table-basse': 'tbasse',
  'meuble-tv': 'meubletv',
  television: 'tv',
  'table-manger': 'tablem',
  bibliotheque: 'biblio',
  congelateur: 'congel',
  'machine-laver': 'mal',
  'micro-ondes': 'micro',
  climatiseur: 'clim',
  ventilateur: 'ventilo',
};
const formatKey = { small: 'p', medium: 'm', large: 'g' } as const;
const formatIndex = { small: 0, medium: 1, large: 2 } as const;
const referenceSizeHints: Record<string, readonly [string, string, string]> = {
  frigo: ['bar / sous-plan', '1 ou 2 portes, ~1,60 m', 'américain, ~1,85 m'],
  chaise: ['plastique empilable', 'bois ou métal', 'rembourrée'],
  congel: ['petit coffre', 'coffre moyen', 'grand coffre / armoire'],
  cuisiniere: ['réchaud 2 feux', '4 feux avec four', '5–6 feux, grande'],
  mal: ['top, 5 kg', 'hublot, 7 kg', '10 kg et plus'],
  tv: ['moins de 40 pouces', '40 à 55 pouces', 'plus de 55 pouces'],
  buffet: ['moins de 1,20 m', '1,20 à 1,80 m', 'plus de 1,80 m'],
  biblio: ['basse', '~1,80 m de haut', 'haute ou très large'],
  vitrine: ['basse', '~1,80 m de haut', 'haute ou très large'],
  meubletv: ['moins de 1,20 m', '1,20 à 1,80 m', 'plus de 1,80 m'],
  tbasse: ['petite, ronde', 'standard', 'grande, avec plateau verre'],
  commode: ['3 tiroirs', '4–5 tiroirs', 'large, 6 tiroirs et plus'],
  coiffeuse: ['sans miroir', 'avec miroir', 'grande avec rangements'],
  bureau: ['petit, sans tiroir', 'standard', "d'angle / grand"],
  chevet: ['petite', 'standard', 'grande'],
  carton: ['livres (~35 L)', 'standard (~55 L)', 'linge (~100 L)'],
  sac: ['bagage cabine', 'valise moyenne', 'grande valise / gros sac'],
  tapis: ['descente de lit', 'salon moyen', 'grand tapis'],
  velo: ['enfant', 'adulte', 'électrique / VTT'],
  pot: ['petit pot', 'pot moyen', 'grand bac / arbuste'],
  clim: ['split mural', 'split + unité extérieure', 'armoire / colonne'],
};
export function simulationInput(
  inventory: Inventory,
  vehicle: Vehicle,
  stock: number,
  blanketLengthCm: number,
  blanketWidthCm: number,
) {
  const lines: {
    k: string;
    q: number;
    s: number;
    g: string;
    dm: boolean;
    n: string;
    gl: string;
    v: number;
    dims?: number[];
    kg?: number;
    kgU?: number;
    like?: string;
    up?: boolean;
    frag?: boolean;
    notop?: boolean;
    hkind?: string;
  }[] = [];
  const add = (
    key: string,
    quantity: number,
    size: number,
    format: 'small' | 'medium' | 'large' | undefined,
    dismantle: boolean,
    label?: string,
  ) => {
    if (quantity <= 0) return;
    const definition = inventoryItems.find((item) => item.key === key);
    const simulationKey = itemKeys[key] ?? key;
    const sizeHint = !definition?.sizeLabel
      ? (referenceSizeHints[simulationKey]?.[formatIndex[format ?? 'medium']] ?? '')
      : '';
    lines.push({
      k: simulationKey,
      q: quantity,
      s: size,
      g: formatKey[format ?? 'medium'],
      dm: dismantle,
      n: label || definition?.label || key,
      gl: sizeHint,
      v:
        Math.round(
          (estimatedInventoryItemVolume(key, size, dismantle, format) /
            (key === 'salon' ? 1.25 : 1)) *
            1000,
        ) / 1000,
    });
    const line = lines.at(-1)!;
    if (!definition?.sizeLabel && key !== 'custom') {
      line.kgU = Math.round(referenceItemWeight(key, size, format ?? 'medium', dismantle).max);
    }
  };
  Object.entries(inventory.entries).forEach(([key, entry]) =>
    add(key, entry.quantity, entry.size, entry.format, entry.dismantle),
  );
  inventory.variants.forEach((entry) =>
    add(entry.itemKey, entry.quantity, entry.size, entry.format, entry.dismantle),
  );
  inventory.custom.forEach((entry) => {
    add('custom', entry.quantity, 1, entry.format, !!entry.dismantle, entry.label);
    const line = lines.at(-1);
    if (!line) return;
    const dimensions = [entry.cL, entry.cW, entry.cH].map(Number);
    if (dimensions.every((value) => value > 0)) line.dims = dimensions.map((value) => value / 100);
    if (line.dims) {
      line.v = line.dims.reduce((volume, value) => volume * value, 1) * (entry.dismantle ? 0.8 : 1);
    } else if (entry.like) {
      const likeKey = entry.like;
      const likeDefinition = inventoryItems.find((item) => item.key === likeKey);
      line.v = estimatedInventoryItemVolume(
        likeKey,
        likeDefinition?.defaultSize ?? 1,
        Boolean(entry.dismantle),
        entry.format,
      );
    }
    if (entry.kg && entry.kg > 0) line.kg = entry.kg;
    if (entry.like) {
      line.like = itemKeys[entry.like] ?? entry.like;
      line.hkind = line.like;
      if (!(entry.kg && entry.kg > 0)) {
        const likeKey = entry.like;
        const likeDefinition = inventoryItems.find((item) => item.key === likeKey);
        line.kg = Math.round(
          referenceItemWeight(
            likeKey,
            likeDefinition?.defaultSize ?? 1,
            entry.format ?? 'medium',
            Boolean(entry.dismantle),
          ).max,
        );
      }
    }
    line.up = Boolean(entry.up);
    line.frag = Boolean(entry.frag);
    line.notop = Boolean(entry.notop);
  });
  return {
    veh: {
      L: dimension(vehicle.length),
      W: dimension(vehicle.width),
      H: dimension(vehicle.height),
      P: dimension(vehicle.wheelWidth) || dimension(vehicle.width),
      archH: 0.3,
      archL: 0.95,
    },
    lines,
    annex: Math.round(referenceAnnexVolume(inventory) * 100) / 100,
    stock,
    blk: { L: blanketLengthCm / 100, W: blanketWidthCm / 100 },
  };
}

export function referencePlannedTrips(
  inventory: Inventory,
  vehicle: Vehicle,
  laborPlanning?: Partial<import('../../../shared/domain/model').MovingLaborPlanningSettings>,
): number | null {
  if (typeof window === 'undefined' || !window.DemSim?.plan) return null;
  try {
    const plan = window.DemSim.plan(
      simulationInput(
        inventory,
        vehicle,
        laborPlanning?.blanketStock ?? 20,
        laborPlanning?.blanketLengthCm ?? 204,
        laborPlanning?.blanketWidthCm ?? 184,
      ),
    );
    return plan.trips.length || null;
  } catch {
    return null;
  }
}

export function loadingSimulationWarnings(
  inventory: Inventory,
  vehicle: Vehicle,
  stock: number,
  blanketLengthCm: number,
  blanketWidthCm: number,
): string[] | null {
  if (typeof window === 'undefined') return null;
  const engine = window.DemSim;
  if (!engine) return null;
  try {
    return engine.plan(simulationInput(inventory, vehicle, stock, blanketLengthCm, blanketWidthCm))
      .out;
  } catch {
    return null;
  }
}
