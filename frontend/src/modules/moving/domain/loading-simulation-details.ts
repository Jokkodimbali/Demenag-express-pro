import type { Inventory } from './inventory/inventory';
import type { MovingEstimate } from './estimate/moving-estimate';
import { referenceAnnexVolume } from './estimate/reference-inventory-note';

export type SimulationLine = {
  k: string;
  q: number;
  s: number;
  g: string;
  dm: boolean;
  n: string;
};
export type SimulationTripDetails = { straps?: number; blankets?: number };
export type EquipmentAdvice = {
  key: string;
  name: string;
  quantity: string;
  norm: string;
  why: string;
};

const weights: Record<string, number | number[] | string> = {
  salon: 'S18',
  matelas: 'M',
  lit: 'L',
  armoire: 'A',
  tablem: 'T',
  frigo: [30, 65, 110],
  congel: [35, 50, 70],
  cuisiniere: [8, 45, 60],
  mal: [55, 70, 80],
  micro: 12,
  clim: [30, 40, 55],
  ventilo: 5,
  gaz: 15,
  velo: 15,
  pot: [8, 20, 40],
  tv: [8, 15, 25],
  tbasse: 20,
  meubletv: 35,
  chaise: 6,
  buffet: [40, 60, 90],
  biblio: 45,
  vitrine: 50,
  tapis: 10,
  coiffeuse: 35,
  commode: 45,
  chevet: 12,
  bureau: 40,
  carton: [12, 15, 18],
  sac: [8, 12, 18],
  custom: 25,
};
export function simulationLineWeight(line: SimulationLine) {
  const value = weights[line.k] ?? 25;
  const size = line.s || 0;
  if (value === 'S18') {
    const groups: Record<number, number[]> = {
      1: [1],
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 2, 1],
      7: [3, 2, 1, 1],
      8: [3, 3, 1, 1],
      9: [3, 3, 2, 1],
      10: [3, 3, 2, 2],
    };
    const pieces = groups[Math.min(10, Math.max(1, size || 5))] || [3, 2];
    return {
      total: pieces.reduce((sum, part) => sum + 20 + part * 12, 0),
      max: 20 + Math.max(...pieces) * 12,
    };
  }
  if (value === 'M') {
    const kg = 10 + 8 * (size || 2);
    return { total: kg, max: kg };
  }
  if (value === 'L') {
    const kg = 30 + 10 * (size || 2);
    return { total: kg, max: line.dm ? Math.round(kg * 0.4) : kg };
  }
  if (value === 'A') {
    const groups: Record<number, number[]> = {
      1: [1],
      2: [2],
      3: [3],
      4: [2, 2],
      5: [3, 2],
      6: [3, 3],
      7: [3, 2, 2],
      8: [3, 3, 2],
    };
    const parts = groups[Math.min(8, Math.max(1, size || 3))] || [3];
    return {
      total: parts.reduce((sum, part) => sum + 30 + 25 * part, 0),
      max: line.dm ? 30 : 30 + 25 * Math.max(...parts),
    };
  }
  if (value === 'T') {
    const kg = 25 + 3 * (size || 6);
    return { total: kg, max: line.dm ? Math.round(kg * 0.6) : kg };
  }
  const kg = Array.isArray(value)
    ? value[{ p: 0, m: 1, g: 2 }[line.g as 'p' | 'm' | 'g'] ?? 1]
    : Number(value);
  return { total: kg, max: kg };
}

const kinds: Record<string, string> = {
  frigo: 'app',
  congel: 'app',
  mal: 'app',
  cuisiniere: 'app',
  clim: 'app',
  micro: 'small',
  armoire: 'case',
  buffet: 'case',
  biblio: 'case',
  commode: 'case',
  vitrine: 'glass',
  coiffeuse: 'glass',
  salon: 'sofa',
  matelas: 'mat',
  lit: 'bed',
  tablem: 'table',
  bureau: 'table',
  tv: 'tv',
  carton: 'box',
  sac: 'box',
  gaz: 'gas',
  velo: 'misc',
  pot: 'misc',
  tapis: 'roll',
};
export type HandlingAdvice = {
  name: string;
  kg: number;
  carriers: number;
  tool: string;
  position: string;
  quantity: number;
};
export function handlingAdvice(lines: SimulationLine[], inventory: Inventory): HandlingAdvice[] {
  const stairs =
    (inventory.fromFloor > 0 && !inventory.fromLift) ||
    (inventory.toFloor > 0 && !inventory.toLift);
  return lines
    .map((line) => {
      const kg = Math.round(simulationLineWeight(line).max);
      const kind = kinds[line.k] || 'misc';
      let carriers = Math.min(4, Math.max(1, Math.ceil(kg / 25)));
      let tool: string;
      let position: string;
      if (kind === 'app') {
        carriers = Math.max(2, carriers);
        tool = 'Diable à sangle (sangles de portage dans l’escalier)';
        position =
          'Toujours debout ; centre de gravité bas (moteur en bas), porte scotchée ; dans l’escalier, le porteur du bas soutient la charge.';
      } else if (kind === 'case') {
        if (!line.dm) carriers = Math.max(2, carriers);
        tool = line.dm
          ? 'Panneaux portés à deux'
          : 'Sangles de portage ; chariot rouleur sur sol plat';
        position = line.dm
          ? 'Panneaux sur la tranche.'
          : 'Vidé, portes et tiroirs scotchés ; debout, ou couché sur le dos dans les virages ; le côté le plus lourd en bas dans l’escalier.';
      } else if (kind === 'glass') {
        carriers = Math.max(2, carriers);
        tool = 'Serviettes, porté à la main';
        position = 'Toujours debout, vitre côté porteur, jamais sur la face vitrée.';
      } else if (kind === 'sofa') {
        carriers = Math.max(2, carriers);
        tool = 'Sangles de portage';
        position =
          'À plat sur ses pieds ; sur la tranche, accoudoir en avant, dans les virages d’escalier.';
      } else if (kind === 'mat') {
        carriers = (line.s || 2) >= 2 ? 2 : 1;
        tool = 'Serviette ou housse';
        position = 'Sur la tranche, jamais plié.';
      } else if (kind === 'bed' || kind === 'table') {
        carriers = Math.max(line.dm ? 1 : 2, carriers);
        tool = line.dm ? 'Visserie en sachet' : 'Chariot rouleur sur sol plat';
        position = line.dm
          ? 'Panneaux et plateau sur la tranche.'
          : 'Plateau protégé, pieds vers le haut dans le camion si possible.';
      } else if (kind === 'tv') {
        carriers = kg > 15 || line.g === 'g' ? 2 : 1;
        tool = 'Serviette pliée en deux';
        position = 'Toujours debout, écran vers le porteur, jamais à plat.';
      } else if (kind === 'box') {
        carriers = 1;
        tool = 'Diable pour les piles de 3 à 4 cartons';
        position = 'Lourds en bas, légers en haut ; porté contre le corps.';
      } else if (kind === 'gas') {
        carriers = 1;
        tool = 'Diable';
        position = 'Debout, robinet fermé, jamais couchée.';
      } else if (kind === 'roll') {
        carriers = kg > 25 ? 2 : 1;
        tool = '—';
        position = 'Roulé, porté sur l’épaule, à deux si long.';
      } else {
        tool = carriers > 1 ? 'À plusieurs' : '—';
        position = 'Charge collée au corps, dos droit.';
      }
      if (stairs && kg > 33 && (kind === 'app' || kind === 'case'))
        carriers = Math.min(4, carriers + 1);
      if (kg > 75)
        tool = `${tool && tool !== '—' ? `${tool} · ` : ''}aide mécanique fortement conseillée`;
      return {
        name: `${line.n.replace(/^./u, (letter) => letter.toUpperCase())}${line.q > 1 ? ` ×${line.q}` : ''}`,
        kg,
        carriers,
        tool,
        position,
        quantity: line.q,
      };
    })
    .sort((a, b) => b.kg * 100 + b.carriers - (a.kg * 100 + a.carriers));
}

const postTools: Record<string, string> = {
  heavy: 'Sangles de portage, diable à sangle, gants',
  inside: 'Serviettes, film, diable si plain-pied',
  relay: 'Gants, sangles de portage (épaule)',
  street: 'Diable, chariot rouleur',
  liftTop: 'Serviettes pour la cabine, cale-porte',
  liftBot: 'Diable, cale-porte',
  pair: 'Sangles de portage, gants, diable',
};
export type CrewPost = { label: string; count: number; job: string; tools: string };
export function crewPosts(
  floor: number,
  hasLift: boolean,
  loading: boolean,
  crew: number,
  handling: HandlingAdvice[],
) {
  const F = Math.max(0, floor);
  const lift = hasLift && F > 0;
  const men = Math.max(1, crew - 1);
  let left = men;
  const posts: CrewPost[] = [];
  const push = (key: string, label: string, count: number, job: string) => {
    const assigned = Math.min(count, left);
    if (assigned <= 0) return;
    left -= assigned;
    posts.push({ label, count: assigned, job, tools: postTools[key] });
  };
  const inside = loading
    ? 'Sort chaque objet protégé jusqu’au palier, dans l’ordre du plan de chargement'
    : 'Pose chaque objet dans sa pièce selon l’étiquette, retire les protections';
  const street = loading
    ? 'Prend au pied de l’immeuble, monte la rampe, remet au chauffeur dans le camion'
    : 'Prend dans le camion des mains du chauffeur et porte jusqu’à l’entrée';
  if (!F) {
    push('inside', 'Intérieur du logement', Math.max(1, Math.ceil(men / 2)), inside);
    push('street', 'Porte → camion', left, street);
  } else if (lift) {
    if (men <= 1)
      push(
        'pair',
        'Trajet complet (seul avec le chef)',
        1,
        'Fait tout le trajet, aidé par le chef d’équipe pour les objets lourds',
      );
    else {
      push(
        'liftTop',
        `Étage ${F} · logement → ascenseur`,
        men >= 4 ? 2 : 1,
        loading
          ? 'Amène les objets à l’ascenseur et le charge sans dépasser sa charge maximale'
          : 'Vide l’ascenseur et porte dans les pièces',
      );
      push(
        'liftBot',
        'Rez-de-chaussée · ascenseur → porte',
        men >= 3 ? 1 : 0,
        loading ? 'Vide l’ascenseur et le renvoie aussitôt' : 'Charge l’ascenseur et le renvoie',
      );
      push('street', 'Porte → camion', left, street);
    }
  } else if (men <= 2)
    push(
      'pair',
      `Binôme · étage ${F} → camion`,
      men,
      'Portent ensemble sur tout le trajet, le plus expérimenté en bas de la charge dans l’escalier',
    );
  else {
    const heavy = handling.filter((item) => item.carriers >= 2);
    if (heavy.length && men >= 5)
      push(
        'heavy',
        `Binôme objets lourds · étage ${F} → camion`,
        2,
        `Descend ensemble, de bout en bout, les ${heavy.length} objet(s) à porter à plusieurs (${heavy
          .slice(0, 3)
          .map((item) => item.name)
          .join(
            ', ',
          )}${heavy.length > 3 ? '…' : ''}) avec sangles de portage ; le porteur du bas soutient la charge`,
      );
    const available = left;
    const relays = Math.max(0, Math.min(F, available - 2));
    push(
      'inside',
      `Étage ${F} · logement → palier`,
      1 + Math.max(0, available - 2 - relays),
      inside,
    );
    for (let index = 0; index < relays; index++) {
      const high = Math.round(F - (index * F) / relays);
      const low = Math.round(F - ((index + 1) * F) / relays);
      const ord = (value: number) => (value === 0 ? 'RDC' : value === 1 ? '1er' : `${value}e`);
      posts.push({
        label: `Relais escalier · ${ord(high)} → ${ord(low)}`,
        count: 1,
        job: loading
          ? 'Reçoit la charge sur son palier haut, la descend, la passe au relais suivant, remonte à vide'
          : 'Monte la charge d’un palier à l’autre et revient à vide',
        tools: postTools.relay,
      });
      left--;
    }
    push('street', 'Porte → camion', left, street);
  }
  return { where: F ? `Étage ${F} ${lift ? 'avec' : 'sans'} ascenseur` : 'Rez-de-chaussée', posts };
}

const isoLimit = (distance: number) =>
  distance <= 1
    ? 10000
    : distance <= 20
      ? 10000 - ((distance - 1) * 4000) / 19
      : (6000 * 20) / distance;
const isoSite = (floor: number, lift: boolean, access: boolean) => {
  const distance = Math.round(15 * (access ? 2 : 1) + (lift ? 2 : 15) * floor);
  return { distance, limit: Math.round(isoLimit(distance)) };
};
export function fatigueAdvice(
  lines: SimulationLine[],
  inventory: Inventory,
  crew: number,
  estimate?: MovingEstimate | null,
) {
  const access = Boolean(inventory.flags.acces);
  const fromFallback = isoSite(inventory.fromFloor, inventory.fromLift, access);
  const toFallback = isoSite(inventory.toFloor, inventory.toLift, access);
  const from = estimate
    ? { distance: estimate.fromIsoDistanceMeters, limit: estimate.fromIsoLimitKg }
    : fromFallback;
  const to = estimate
    ? { distance: estimate.toIsoDistanceMeters, limit: estimate.toIsoLimitKg }
    : toFallback;
  const kg =
    estimate?.totalWeightKg ??
    lines.reduce((sum, line) => sum + simulationLineWeight(line).total * line.q, 0) +
      Math.round(referenceAnnexVolume(inventory) * 110);
  const classLevel =
    Math.max(
      inventory.fromLift ? 0 : inventory.fromFloor,
      inventory.toLift ? 0 : inventory.toFloor,
    ) >= 2
      ? 4
      : 3;
  const heat = estimate?.heat;
  const effort = estimate?.fatigueEffort;
  const heatFactor = heat ? 1 + Math.max(0, heat.wbgt - heat.reference) * 0.08 : 1;
  const scoreFor = (people: number) =>
    Math.round(((kg / from.limit + kg / to.limit) / people) * 100 * heatFactor);
  const effectiveCrew = Math.max(1, crew);
  const heavy25 = lines
    .filter((line) => simulationLineWeight(line).max > 25 && simulationLineWeight(line).max <= 33)
    .reduce((sum, line) => sum + line.q, 0);
  const heavy33 = lines
    .filter((line) => simulationLineWeight(line).max > 33)
    .reduce((sum, line) => sum + line.q, 0);
  const handlingScore = Math.round(scoreFor(effectiveCrew) * (1 + heavy25 * 0.02 + heavy33 * 0.04));
  const effortScore = effort?.percentage ?? 0;
  const heatScore = estimate?.heatPenalty ?? 0;
  const score = Math.max(effortScore, handlingScore, heatScore);
  const level =
    score < 50
      ? ['Faible', '#3DDC84']
      : score < 80
        ? ['Modérée', '#FFD23F']
        : score < 100
          ? ['Élevée', '#FF9F5A']
          : ['Excessive', '#FF5A5F'];
  const over33 = heavy33;
  const over25 = heavy25;
  let recommended = crew;
  while (recommended < 12 && scoreFor(recommended) >= 80) recommended++;
  const recommendations: string[] = [];
  if (recommended > crew)
    recommendations.push(
      `Passer à ${recommended} manœuvres ramène la charge sous 80 % de la limite ISO (${scoreFor(recommended)} %).`,
    );
  if (over33)
    recommendations.push(
      `${over33} objet${over33 > 1 ? 's' : ''} de plus de 33 kg : aide mécanique obligatoire (diable, sangles de portage), jamais à bras.`,
    );
  else if (over25)
    recommendations.push(
      `${over25} objet${over25 > 1 ? 's' : ''} de plus de 25 kg : toujours à deux.`,
    );
  if (classLevel >= 4)
    recommendations.push(
      'Escalier sans ascenseur : un porteur par palier, rotation des postes toutes les 30 min.',
    );
  if (heat && heat.rest > 15)
    recommendations.push(
      `Chaleur : ${heat.rest} min de récupération à l’ombre après ${heat.work} min de portage, environ 1 L d’eau par heure et par personne.`,
    );
  if (!recommendations.length)
    recommendations.push('Charge de travail dans les limites ISO pour l’équipe prévue.');
  const number = (value: number) => Math.round(value).toLocaleString('fr-FR');
  const floorLabel = (floor: number, lift: boolean) =>
    !floor ? 'RDC' : `${floor}${floor > 1 ? 'e' : 'er'} étage ${lift ? 'avec' : 'sans'} ascenseur`;
  return {
    score,
    level: level[0],
    color: level[1],
    gauges: [
      {
        label: 'Effort physique · ISO 8996',
        score: effortScore,
        detail: `Portage ${effort?.carrying ?? 0} % · trajets ${effort?.travel ?? 0} % · autres étapes ${effort?.other ?? 0} %`,
      },
      {
        label: 'Manutention · ISO 11228-1',
        score: handlingScore,
        detail: `≈ ${number((kg * 2) / effectiveCrew)} kg portés par manœuvre`,
      },
      {
        label: 'Chaleur · ISO 7243',
        score: heatScore,
        detail: heatScore
          ? 'Pauses chaleur désactivées alors que la chaleur dépasse la référence'
          : heat
            ? `${heat.rest} min de repos après ${heat.work} min de portage`
            : 'Chaleur sous la référence',
      },
    ],
    recommendations,
    rows: [
      ['Poids total à porter', `≈ ${number(kg)} kg`],
      [
        'Durée totale prévue',
        estimate && Number.isFinite(estimate.totalMinutes)
          ? `${number(estimate.totalMinutes / 60)} h`
          : 'Non calculée',
      ],
      ['Effort départ · arrivée', `${effort?.from ?? 200} · ${effort?.to ?? 200} W/m²`],
      ['Masse portée par manœuvre', `≈ ${number((kg * 2) / effectiveCrew)} kg`],
      [
        'Limite ISO 11228-1 au départ',
        `${number(from.limit)} kg / jour (${from.distance} m équivalents)`,
      ],
      [
        'Limite ISO 11228-1 à l’arrivée',
        `${number(to.limit)} kg / jour (${to.distance} m équivalents)`,
      ],
      [
        'Métabolisme ISO 8996',
        classLevel >= 4 ? 'Classe 4 · très élevé (escalier)' : 'Classe 3 · élevé',
      ],
      [
        'Chaleur ISO 7243',
        heat
          ? `WBGT ${String(heat.wbgt).replace('.', ',')} °C · réf. ${heat.reference} °C · ${heat.work < 150 ? `${Math.round((heat.work / (heat.work + heat.rest)) * 100)} % de travail` : 'sans restriction'}`
          : 'non prise en compte',
      ],
      [
        'Départ · arrivée',
        `${floorLabel(inventory.fromFloor, inventory.fromLift)} · ${floorLabel(inventory.toFloor, inventory.toLift)}`,
      ],
      ['Objets > 25 kg · > 33 kg', `${over25} · ${over33}`],
    ] as [string, string][],
  };
}

export function equipmentAdvice(
  lines: SimulationLine[],
  inventory: Inventory,
  crew: number,
  trips: SimulationTripDetails[],
  estimate?: MovingEstimate | null,
): EquipmentAdvice[] {
  const count = (keys: string[]) =>
    lines.filter((line) => keys.includes(line.k)).reduce((sum, line) => sum + line.q, 0);
  const appliances = count(['frigo', 'congel', 'mal', 'cuisiniere', 'clim']);
  const heavy = lines
    .filter((line) => simulationLineWeight(line).max > 33)
    .reduce((sum, line) => sum + line.q, 0);
  const big = count([
    'armoire',
    'buffet',
    'biblio',
    'commode',
    'salon',
    'lit',
    'tablem',
    'vitrine',
    'bureau',
  ]);
  const stairs =
    (inventory.fromFloor > 0 && !inventory.fromLift) ||
    (inventory.toFloor > 0 && !inventory.toLift);
  const dismantling = lines.some((line) => line.dm);
  const straps = trips.length ? Math.max(...trips.map((trip) => trip.straps ?? 0)) : 4;
  const blankets = trips.length ? Math.max(...trips.map((trip) => trip.blankets ?? 0)) : 0;
  const hours = estimate ? estimate.totalMinutes / 60 : 4;
  const hot = estimate?.heat && estimate.heat.work < 150;
  const rows: EquipmentAdvice[] = [];
  const add = (key: string, name: string, quantity: string, norm: string, why: string) =>
    rows.push({ key, name, quantity, norm, why });
  if (appliances || heavy)
    add(
      'diable',
      'Diable de manutention',
      `${appliances + heavy >= 4 ? 2 : 1} par véhicule`,
      'ISO 11228-1 · aide mécanique',
      `${appliances ? `${appliances} électroménager${appliances > 1 ? 's' : ''}` : `${heavy} objet${heavy > 1 ? 's' : ''} lourd${heavy > 1 ? 's' : ''}`} à rouler, jamais à porter à bras.`,
    );
  if (heavy || stairs)
    add(
      'portage',
      'Sangles de portage',
      `${Math.max(1, Math.ceil(crew / 2))} paire${Math.ceil(crew / 2) > 1 ? 's' : ''}`,
      'ISO 11228-1 · port en équipe',
      'Reportent la charge sur les épaules et les jambes, dos droit, surtout dans l’escalier.',
    );
  if (big)
    add(
      'rouleur',
      'Rouleurs à meubles',
      '2',
      'EN 12522 · manutention',
      'Déplacer armoires, buffets et canapés à plat, sans les soulever.',
    );
  if (appliances)
    add(
      'rampe',
      'Rampe de chargement',
      '1',
      'ISO 11228-2 · pousser, tirer',
      'Monter le diable dans le camion sans soulever la charge.',
    );
  add(
    'cliquet',
    'Sangles à cliquet',
    String(straps),
    'EN 12195-1 / EN 12195-2',
    'Arrimer chaque mur : la charge doit tenir 0,8 g au freinage.',
  );
  add(
    'tapis',
    'Tapis antidérapant',
    '1 par véhicule',
    'EN 12195-1 · frottement',
    'Double le frottement au sol : la charge glisse moins, moins de sangles.',
  );
  if (blankets)
    add(
      'serviette',
      'Serviettes de déménagement',
      String(blankets),
      'EN 12522 · protection des biens',
      'Écrans, vitres, façades et angles en priorité.',
    );
  add(
    'film',
    'Film étirable et ruban',
    '1 rouleau',
    'EN 12522 · protection des biens',
    'Bloquer portes et tiroirs, protéger les tissus.',
  );
  if (dismantling)
    add(
      'visseuse',
      'Visseuse et sachets',
      '1',
      'EN 12522 · démontage',
      'Démontage et remontage, visserie en sachets étiquetés par meuble.',
    );
  add(
    'gants',
    'Gants de manutention',
    `${crew + 1} paires`,
    'EN 388',
    'Prise sûre, protection contre coupures et pincements.',
  );
  add(
    'chaussures',
    'Chaussures de sécurité',
    `${crew + 1} paires`,
    'EN ISO 20345 · S3',
    'Embout contre l’écrasement, semelle antidérapante.',
  );
  add(
    'eau',
    'Eau potable',
    `≈ ${Math.max(crew * 2, Math.ceil(crew * hours * (hot ? 1 : 0.6)))} L`,
    'ISO 7243 · chaleur',
    'Environ 1 L par heure et par personne par forte chaleur, pauses à l’ombre.',
  );
  return rows;
}
