import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Draft } from '../../application/booking-draft';
import type { AdminQuoteConfig } from '../../application/admin-quote-draft-storage';
import type { Inventory } from '../../domain/inventory';
import { inventoryItems } from '../../domain/inventory';
import { estimatedInventoryItemVolume } from '../../domain/moving-estimate';
import type { MovingEstimate } from '../../domain/moving-estimate';
import {
  crewPosts,
  equipmentAdvice,
  fatigueAdvice,
  handlingAdvice,
} from '../../domain/loading-simulation-details';
import { referenceAnnexVolume } from '../../domain/reference-inventory-note';
import type { Vehicle } from '../../domain/model';
import { useApp } from '../../application/context';
import { errorMessage } from '../../application/error-message';

type SimBox = {
  step: number;
  u: { label: string; c: string; k?: string };
  txt: string;
  tip?: string;
  prot?: boolean;
  protTxt?: string;
  kg?: number;
};
type SimTrip = {
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
type SimPlan = {
  trips: SimTrip[];
  out: string[];
  V: { net: number };
  colors: Record<string, string>;
};
type SimView = {
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

function pdfLines(
  pdf: InstanceType<(typeof import('jspdf'))['jsPDF']>,
  value: string,
  width: number,
) {
  const result: unknown = pdf.splitTextToSize(value, width);
  if (typeof result === 'string') return [result];
  return Array.isArray(result) && result.every((line): line is string => typeof line === 'string')
    ? result
    : [value];
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  const pending = scripts.get(src);
  if (pending) return pending;
  const next = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scripts.delete(src);
      script.remove();
      reject(new Error(`Chargement impossible : ${src}`));
    };
    document.head.appendChild(script);
  });
  scripts.set(src, next);
  return next;
}

async function imageDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const image = new Image();
    image.src = URL.createObjectURL(await response.blob());
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
    URL.revokeObjectURL(image.src);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const format = (value: number) => value.toFixed(1).replace('.', ',');
const tripLabel = (count: number) => `${count} ${count > 1 ? 'allers-retours' : 'aller-retour'}`;
const loadingRules = [
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
function simulationInput(
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
  };
  Object.entries(inventory.entries).forEach(([key, entry]) =>
    add(key, entry.quantity, entry.size, entry.format, entry.dismantle),
  );
  inventory.variants.forEach((entry) =>
    add(entry.itemKey, entry.quantity, entry.size, entry.format, entry.dismantle),
  );
  inventory.custom.forEach((entry) =>
    add('custom', entry.quantity, 1, entry.format, !!entry.dismantle, entry.label),
  );
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

export function LoadingSimulation({
  draft,
  vehicles,
  quoteConfig,
  crew,
  estimate,
  setDraft,
  setQuoteConfig,
}: {
  draft: Draft;
  vehicles: Vehicle[];
  quoteConfig: AdminQuoteConfig;
  crew: number;
  estimate?: MovingEstimate | null;
  setDraft: Dispatch<SetStateAction<Draft>>;
  setQuoteConfig: Dispatch<SetStateAction<AdminQuoteConfig>>;
}) {
  const { api, catalogue, setCatalogue } = useApp();
  const laborSettings = catalogue?.settings.movingLaborPlanning;
  const blanketLengthCm = laborSettings?.blanketLengthCm ?? 204;
  const blanketWidthCm = laborSettings?.blanketWidthCm ?? 184;
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [vehicleId, setVehicleId] = useState(draft.vehicleId);
  const [tripIndex, setTripIndex] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState('iso');
  const [wrap, setWrap] = useState(true);
  const [stock, setStock] = useState(laborSettings?.blanketStock ?? 20);
  const [stockError, setStockError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ veh: true, v3d: true });
  const [methodOpen, setMethodOpen] = useState(false);
  const [crewVisible, setCrewVisible] = useState(false);
  const [stepImages, setStepImages] = useState<string[]>([]);
  const canvas = useRef<HTMLDivElement>(null);
  const viewer = useRef<SimView | null>(null);
  const vehicle = vehicles.find((item) => item.id === vehicleId) ?? vehicles[0];
  const input = useMemo(
    () =>
      vehicle
        ? simulationInput(draft.inventory, vehicle, stock, blanketLengthCm, blanketWidthCm)
        : null,
    [draft.inventory, vehicle, stock, blanketLengthCm, blanketWidthCm],
  );
  const hasItems = Boolean(input && (input.lines.length || input.annex > 0));

  useEffect(() => {
    if (!open || !hasItems) return;
    let active = true;
    void Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'),
      loadScript('/reference/loading-sim.js'),
      loadScript('/reference/equip-art.js'),
    ])
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setLoadingError('La vue 3D est indisponible sur cet appareil.');
      });
    return () => {
      active = false;
    };
  }, [open, hasItems]);

  const plan = useMemo(() => {
    if (!ready || !input || !window.DemSim || !hasItems) return null;
    try {
      return window.DemSim.plan(input);
    } catch {
      return null;
    }
  }, [ready, input, hasItems]);
  const vehiclePlans = useMemo(() => {
    if (!ready || !window.DemSim || !hasItems) return {} as Record<string, SimPlan>;
    const result: Record<string, SimPlan> = {};
    vehicles.forEach((item) => {
      if (item.active === false) return;
      try {
        result[item.id] = window.DemSim!.plan(
          simulationInput(draft.inventory, item, stock, blanketLengthCm, blanketWidthCm),
        );
      } catch {
        // A vehicle with incomplete dimensions is omitted, as in the reference.
      }
    });
    return result;
  }, [ready, hasItems, vehicles, draft.inventory, stock, blanketLengthCm, blanketWidthCm]);
  const trip = plan?.trips[Math.min(tripIndex, plan.trips.length - 1)] ?? null;
  const currentStep = step === null ? null : Math.min(step, trip?.boxes.length ?? 0);
  const currentStepRef = useRef(currentStep);
  const selectedBox = currentStep ? trip?.boxes[currentStep - 1] : null;
  useEffect(() => {
    if (draft.vehicleId && vehicles.some((item) => item.id === draft.vehicleId))
      setVehicleId(draft.vehicleId);
  }, [draft.vehicleId, vehicles]);
  useEffect(() => {
    setStock(laborSettings?.blanketStock ?? 20);
  }, [laborSettings?.blanketStock]);
  useEffect(() => {
    if (!ready || !plan || !trip || !window.DemSim?.stepShots) return;
    const key = `${vehicle?.id}|${tripIndex}|${JSON.stringify(input)}|${wrap}`;
    const cached = window.DemSim.shots?.(key);
    if (cached) {
      setStepImages(cached);
      return;
    }
    setStepImages([]);
    const timer = window.setTimeout(() => {
      setStepImages(window.DemSim?.stepShots?.(plan, tripIndex, { wrap }, key) ?? []);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [ready, plan, trip, vehicle?.id, tripIndex, input, wrap]);
  const details = useMemo(() => {
    const lines = input?.lines ?? [];
    const handling = handlingAdvice(lines, draft.inventory);
    return {
      handling,
      from: crewPosts(draft.inventory.fromFloor, draft.inventory.fromLift, true, crew, handling),
      to: crewPosts(draft.inventory.toFloor, draft.inventory.toLift, false, crew, handling),
      fatigue: fatigueAdvice(lines, draft.inventory, crew, estimate),
      equipment: equipmentAdvice(lines, draft.inventory, crew, plan?.trips ?? [], estimate).map(
        (item) => ({
          ...item,
          image: window.EquipArt?.art(item.key) || '',
        }),
      ),
    };
  }, [input, draft.inventory, crew, estimate, plan]);

  useEffect(() => {
    viewer.current?.dispose();
    viewer.current = null;
    if (!open || !sections.v3d || !ready || !plan || !trip || !canvas.current || !window.DemSim)
      return;
    const next = window.DemSim.view(canvas.current, { onPick: (value) => setStep(value) });
    if (!next?.ok) return;
    next.load(trip, plan, { wrap: false });
    viewer.current = next;
    return () => {
      next.dispose();
      if (viewer.current === next) viewer.current = null;
    };
  }, [open, sections.v3d, ready, plan, trip]);
  const section = (key: string, title: string, subtitle = '') => (
    <button
      type="button"
      className="loading-simulation-section-heading"
      aria-expanded={Boolean(sections[key])}
      onClick={() => setSections((current) => ({ ...current, [key]: !current[key] }))}
    >
      <span className={sections[key] ? '' : 'closed'} aria-hidden="true">
        ⌄
      </span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
    </button>
  );
  useEffect(() => {
    viewer.current?.setView(viewMode);
  }, [viewMode, plan, trip]);
  useEffect(() => {
    currentStepRef.current = currentStep;
    viewer.current?.show(currentStep);
  }, [currentStep, plan, trip]);
  useEffect(() => {
    if (!viewer.current || !trip || !plan) return;
    viewer.current.load(trip, plan, { wrap });
    viewer.current.show(currentStepRef.current);
  }, [wrap, plan, trip]);
  useEffect(() => {
    viewer.current?.crew?.({
      on: crewVisible,
      man: Math.max(1, crew - 1),
      menu: input?.lines.some((item) => item.dm) ? 1 : 0,
      from: 'LOGEMENT',
      site: { F: draft.inventory.fromFloor, lift: draft.inventory.fromLift },
    });
  }, [crewVisible, crew, draft.inventory, input, plan, trip, sections.v3d, wrap]);

  useEffect(() => {
    if (!playing || !trip?.boxes.length) return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current === null || current >= trip.boxes.length) return 1;
        return current + 1;
      });
    }, 750);
    return () => window.clearInterval(timer);
  }, [playing, trip]);

  async function downloadPlan() {
    if (!plan || !window.DemSim) return;
    setPdfError('');
    try {
      const { default: JsPDF } = await import('jspdf');
      const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const margin = 16;
      const maxY = 284;
      let y = 18;
      const safe = (value: unknown) =>
        String(value ?? '')
          .normalize('NFC')
          .replace(/[\u2009\u202f\u00a0\u2007]/g, ' ')
          .replace(/[≈]/g, '~')
          .replace(/[·•]/g, '-')
          .replace(/[’‘]/g, "'")
          .replace(/[“”«»]/g, '"')
          .replace(/×/g, 'x')
          .replace(/[−]/g, '-')
          .replace(/→/g, '>')
          .replace(/[—–]/g, '-');
      const addSpace = (height: number) => {
        if (y + height > maxY) {
          pdf.addPage();
          y = 18;
        }
      };
      const imageData = await imageDataUrl('/assets/logo.png');
      const trips = plan.trips;
      const tripTotal = (count: number) =>
        `${count} ${count > 1 ? 'allers-retours' : 'aller-retour'}`;
      const number = (value: number) => (Math.round(value * 10) / 10).toString().replace('.', ',');
      const duration = (minutes: number) => {
        const rounded = Math.max(5, Math.round(minutes / 5) * 5);
        const hours = Math.floor(rounded / 60);
        const remainder = rounded % 60;
        return hours
          ? `${hours} h${remainder ? ` ${String(remainder).padStart(2, '0')}` : ''}`
          : `${remainder} min`;
      };

      if (imageData) pdf.addImage(imageData, 'PNG', margin, y - 4, 14, 14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 32, 35);
      pdf.text('Plan de chargement', margin + (imageData ? 18 : 0), y + 3);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(90, 97, 104);
      pdf.text(safe(`${draft.fromAddress || '-'}  >  ${draft.toAddress || '-'}`), margin, y + 9);
      pdf.text(
        safe(
          `${vehicle?.shortName || vehicle?.name || ''} · ${tripTotal(trips.length)} · volume utile ${number(plan.V.net)} m³`,
        ),
        margin,
        y + 14,
      );
      pdf.text(safe(draft.customerName), pageWidth - margin, y + 14, { align: 'right' });
      y += 20;
      pdf.setDrawColor(30, 32, 35);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      const maxBlankets = Math.max(...trips.map((item) => item.need));
      const totalBlankets = trips.reduce((sum, item) => sum + item.need, 0);
      pdf.setFillColor(30, 32, 35);
      pdf.roundedRect(margin, y - 5, pageWidth - 2 * margin, 16, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(246, 215, 60);
      pdf.text(safe(`Serviettes de déménagement à emporter : ${maxBlankets}`), margin + 4, y + 1.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(
        safe(
          `Format ${blanketLengthCm} x ${blanketWidthCm} cm - ${trips.length > 1 ? `maximum sur un aller-retour (elles reviennent avec le camion), ${totalBlankets} poses au total` : 'pour l’aller-retour'}${maxBlankets > stock ? ` - stock actuel ${stock} : manque ${maxBlankets - stock}` : ''}`,
        ),
        margin + 4,
        y + 7.5,
      );
      y += 18;
      addSpace(80);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 32, 35);
      pdf.text('Méthode de chargement', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11.5);
      pdf.setTextColor(45, 50, 56);
      loadingRules.forEach((rule, index) => {
        const lines = pdfLines(pdf, safe(`${index + 1}. ${rule}`), pageWidth - 2 * margin);
        addSpace(lines.length * 5.4 + 2);
        pdf.text(lines, margin, y);
        y += lines.length * 5.4 + 1.6;
      });
      y += 6;

      for (const [tripIndex, item] of trips.entries()) {
        addSpace(70);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 32, 35);
        pdf.text(`Aller-retour ${tripIndex + 1}`, margin, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          safe(
            `${item.nItems} objets · ${number(item.vol)} m³ · remplissage ${item.fill} % · ~${item.kg} kg`,
          ),
          pageWidth - margin,
          y,
          { align: 'right' },
        );
        y += 5;
        const blanketLine = safe(
          `SERVIETTES À PRÉVOIR : ${item.need} (${blanketLengthCm} x ${blanketWidthCm} cm) - stock : ${item.stock}${item.need > item.stock ? ` - manque ${item.need - item.stock}` : ''} - sangles : ${item.straps ?? 0}`,
        );
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        const blanketLines = pdfLines(pdf, blanketLine, pageWidth - 2 * margin - 6);
        const blanketHeight = blanketLines.length * 4.5 + 2;
        pdf.setFillColor(
          item.need <= item.stock ? 255 : 255,
          item.need <= item.stock ? 226 : 205,
          item.need <= item.stock ? 102 : 205,
        );
        pdf.roundedRect(margin, y - 4.2, pageWidth - 2 * margin, blanketHeight, 1, 1, 'F');
        pdf.setTextColor(30, 32, 35);
        pdf.text(blanketLines, margin + 3, y);
        y += blanketHeight + 1;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        const checkText = safe(
          `Contrôles : ${item.checks.map((check) => `${check.ok ? 'OK ' : 'À revoir : '}${check.txt || check.text || check.t || ''}`).join(' · ')}`,
        );
        const checkLines = pdfLines(pdf, checkText, pageWidth - 2 * margin);
        addSpace(checkLines.length * 4 + 3);
        pdf.text(checkLines, margin, y);
        y += checkLines.length * 4 + 2;
        try {
          const snapshot = window.DemSim.snapshot(plan, tripIndex, { wrap: false });
          if (snapshot) {
            const imageHeight = (pageWidth - 2 * margin) * (640 / 1200);
            addSpace(imageHeight + 4);
            pdf.addImage(snapshot, 'JPEG', margin, y, pageWidth - 2 * margin, imageHeight);
            y += imageHeight + 5;
          }
        } catch {
          // Continue with the per-step plan if the device cannot capture the 3D view.
        }

        let stepImages: string[] = [];
        try {
          stepImages =
            window.DemSim.stepShots?.(
              plan,
              tripIndex,
              { wrap: false, bg: 0xffffff, aspect: 1 / 0.92 },
              `pdfc|${vehicle?.id ?? ''}|${tripIndex}|${item.boxes.length}|${item.vol.toFixed(3)}`,
            ) ?? [];
        } catch {
          stepImages = [];
        }
        pdf.addPage();
        y = 18;
        for (const wall of item.walls) {
          addSpace(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(30, 32, 35);
          pdf.text(safe(wall.title.toUpperCase()), margin, y);
          y += 6;
          for (let rowIndex = 0; rowIndex < wall.steps.length; rowIndex += 2) {
            const row = wall.steps.slice(rowIndex, rowIndex + 2);
            const gap = 6;
            const cellWidth = (pageWidth - 2 * margin - gap) / 2;
            const imageHeight = cellWidth * 0.92;
            const prepared = row.map((box) => {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10.5);
              const title = pdfLines(pdf, safe(`${box.step}. ${box.u.label}`), cellWidth);
              pdf.setFont('helvetica', 'normal');
              const description = pdfLines(
                pdf,
                safe(
                  `${box.txt}${box.tip ? ` ${box.tip.charAt(0).toUpperCase()}${box.tip.slice(1)}.` : ''}`,
                ),
                cellWidth,
              );
              const protection = box.protTxt
                ? pdfLines(pdf, safe(`${box.protTxt}.`), cellWidth - 3.2)
                : [];
              return {
                box,
                title,
                description,
                protection,
                height:
                  imageHeight +
                  3 +
                  title.length * 4.8 +
                  description.length * 4.5 +
                  (protection.length ? protection.length * 4.5 + 3.4 : 0),
              };
            });
            const rowHeight = Math.max(...prepared.map((cell) => cell.height));
            addSpace(rowHeight + 4);
            prepared.forEach((cell, column) => {
              const x = margin + column * (cellWidth + gap);
              const image = stepImages[cell.box.step - 1];
              if (image) pdf.addImage(image, 'JPEG', x, y, cellWidth, imageHeight);
              else {
                pdf.setDrawColor(220);
                pdf.rect(x, y, cellWidth, imageHeight);
              }
              let cellY = y + imageHeight + 4.6;
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10.5);
              pdf.setTextColor(30, 32, 35);
              pdf.text(cell.title, x, cellY);
              cellY += cell.title.length * 4.8;
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(90, 97, 104);
              pdf.text(cell.description, x, cellY);
              if (cell.protection.length) {
                cellY += cell.description.length * 4.5 + 1.4;
                pdf.setFillColor(
                  cell.box.prot ? 255 : 255,
                  cell.box.prot ? 226 : 205,
                  cell.box.prot ? 102 : 205,
                );
                pdf.roundedRect(
                  x,
                  cellY - 3.6,
                  cellWidth,
                  cell.protection.length * 4.5 + 2,
                  1,
                  1,
                  'F',
                );
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 32, 35);
                pdf.text(cell.protection, x + 1.6, cellY);
              }
            });
            y += rowHeight + 4;
          }
          y += 2;
        }
      }

      if (estimate) {
        pdf.addPage();
        y = 18;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Planning prévisionnel', margin, y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          safe(
            `${estimate.crew} manœuvres${estimate.carpenterCount ? ` + ${estimate.carpenterCount} menuisier${estimate.carpenterCount > 1 ? 's' : ''}` : ''} · début ${estimate.startTime} · fin prévue ${estimate.endTime} · durée ${duration(estimate.totalMinutes)}`,
          ),
          margin,
          y + 9,
        );
        if (estimate.heat && estimate.heat.work < 150) {
          pdf.setFontSize(9);
          pdf.setTextColor(90, 97, 104);
          pdf.text(
            safe(
              `Chaleur ISO 7243 : WBGT ${estimate.heat.wbgt} °C, ${estimate.heat.rest} min de récupération après ${estimate.heat.work} min de portage.`,
            ),
            margin,
            y + 14,
          );
        }
        y += estimate.heat && estimate.heat.work < 150 ? 21 : 16;
        pdf.setFillColor(30, 32, 35);
        pdf.rect(margin, y - 4.5, pageWidth - 2 * margin, 7, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text('HEURE', margin + 3, y);
        pdf.text('ÉTAPE', margin + 30, y);
        pdf.text('DURÉE', pageWidth - margin - 3, y, { align: 'right' });
        y += 6;
        const rowColors: Record<string, [number, number, number]> = {
          Chargement: [246, 215, 60],
          Déchargement: [246, 215, 60],
          Trajet: [111, 168, 220],
          Retour: [111, 168, 220],
          Pause: [61, 220, 132],
          Emballage: [201, 162, 126],
          Arrivée: [174, 180, 187],
          Vérification: [174, 180, 187],
        };
        for (const [index, item] of estimate.planning.entries()) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.5);
          const detail = item.detail
            ? pdfLines(pdf, safe(item.detail), pageWidth - 2 * margin - 60)
            : [];
          const rowHeight = 5.5 + detail.length * 3.7 + 1.5;
          addSpace(rowHeight + 1);
          if (index % 2) {
            pdf.setFillColor(246, 247, 248);
            pdf.rect(margin, y - 4, pageWidth - 2 * margin, rowHeight, 'F');
          }
          const colorKey = Object.keys(rowColors).find((key) => item.title.startsWith(key));
          const color = colorKey ? rowColors[colorKey] : rowColors.Arrivée;
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(margin, y - 4, 1.6, rowHeight, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          pdf.setTextColor(30, 32, 35);
          pdf.text(safe(item.time), margin + 3, y);
          pdf.text(safe(item.title), margin + 30, y);
          pdf.text(duration(item.minutes), pageWidth - margin - 3, y, { align: 'right' });
          if (detail.length) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(90, 97, 104);
            pdf.text(detail, margin + 30, y + 4);
          }
          y += rowHeight;
        }
        addSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 32, 35);
        pdf.text(safe(`Fin prévue : ${estimate.endTime}`), margin, y + 4);
        y += 10;
      }

      if (details.equipment.length) {
        pdf.addPage();
        y = 18;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Matériel conseillé', margin, y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          'N’entre pas dans le prix du devis. Références : ISO 11228-1, EN 12195-1, EN 12522, ISO 7243.',
          margin,
          y + 9,
        );
        y += 16;
        const columns = 3;
        const gap = 5;
        const cellWidth = (pageWidth - 2 * margin - gap * (columns - 1)) / columns;
        const imageHeight = cellWidth * 0.75;
        for (let index = 0; index < details.equipment.length; index += columns) {
          const row = details.equipment.slice(index, index + columns);
          const prepared = row.map((item) => {
            pdf.setFontSize(8.5);
            const reason = pdfLines(pdf, safe(item.why), cellWidth - 4);
            return { item, reason, height: imageHeight + 6 + 5 + 4.5 + reason.length * 3.6 + 5 };
          });
          const rowHeight = Math.max(...prepared.map((cell) => cell.height));
          addSpace(rowHeight + 4);
          prepared.forEach((cell, column) => {
            const x = margin + column * (cellWidth + gap);
            pdf.setDrawColor(201, 206, 211);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, y, cellWidth, rowHeight, 2, 2, 'S');
            const image = window.EquipArt?.art(cell.item.key);
            if (image) {
              try {
                pdf.addImage(image, 'PNG', x + 1, y + 1, cellWidth - 2, imageHeight - 2);
              } catch {
                // Keep the equipment details visible when an illustration is unavailable.
              }
            }
            let cellY = y + imageHeight + 5;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(30, 32, 35);
            pdf.text(safe(cell.item.name), x + 2, cellY);
            cellY += 4.6;
            pdf.setFontSize(9);
            pdf.setTextColor(140, 106, 0);
            pdf.text(safe(cell.item.quantity), x + 2, cellY);
            cellY += 4.4;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(75, 87, 95);
            pdf.text(cell.reason, x + 2, cellY);
            cellY += cell.reason.length * 3.6 + 1;
            pdf.setFontSize(7.5);
            pdf.setTextColor(107, 115, 123);
            pdf.text(safe(cell.item.norm), x + 2, cellY);
          });
          y += rowHeight + 5;
        }
      }
      if (plan.out.length) {
        addSpace(8 + plan.out.length * 4.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Ne rentre pas dans ce véhicule', margin, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        plan.out.forEach((message) => {
          pdf.text(safe(`- ${message}`), margin + 3, y);
          y += 4.5;
        });
      }
      const fileName = safe(`Plan-de-chargement-${draft.customerName || 'devis'}`)
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}-]/gu, '');
      pdf.save(`${fileName}.pdf`);
    } catch (cause) {
      console.error(cause);
      setPdfError('Le plan de chargement n’a pas pu être généré. Réessayez.');
    }
  }

  async function saveStock() {
    if (!catalogue || stock === (laborSettings?.blanketStock ?? 20)) return;
    setStockError('');
    try {
      const updated = await api.updateCatalogue({
        ...catalogue,
        settings: {
          ...catalogue.settings,
          movingLaborPlanning: {
            maxHandlingHours: 3,
            maxDayHours: 8,
            defaultStartHour: 8,
            maxMoversPerVehicle: 6,
            cubicMetersPerHourPerMover: 2.7,
            pauseMinutes: 30,
            heat: 1,
            wbgtAdj: 0,
            ...catalogue.settings.movingLaborPlanning,
            blanketLengthCm,
            blanketWidthCm,
            blanketStock: stock,
          },
        },
      });
      setCatalogue(updated);
    } catch (cause) {
      setStockError(errorMessage(cause));
    }
  }

  return (
    <div className="loading-simulation-wrapper">
      <section className="loading-simulation">
        <button
          type="button"
          className="loading-simulation-heading"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? '⌄' : '›'}</span>
          <span>
            <strong>SIMULATION DE CHARGEMENT 3D</strong>
            <small>
              {plan
                ? `${plan.trips.length} aller(s)-retour(s) · ${plan.trips.reduce((sum, item) => sum + item.nItems, 0)} objets`
                : 'Inventaire'}
            </small>
          </span>
        </button>
        {open && (
          <div className="loading-simulation-body">
            {!hasItems && (
              <span>Remplissez la fiche d'appel inventaire pour voir le plan de chargement.</span>
            )}
            {hasItems && !ready && <span>{loadingError || 'Chargement de la 3D…'}</span>}
            {plan && (
              <>
                <div className="loading-simulation-section">
                  {section(
                    'veh',
                    'Véhicule et allers-retours',
                    `${vehicle?.name ?? ''} · ${tripLabel(plan.trips.length)}`,
                  )}
                  {sections.veh && (
                    <div className="loading-simulation-section-content">
                      <div className="loading-simulation-actions">
                        {vehicles
                          .filter((item) => vehiclePlans[item.id])
                          .map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              className={vehicle?.id === item.id ? 'selected' : ''}
                              onClick={() => {
                                setVehicleId(item.id);
                                setTripIndex(0);
                                setStep(null);
                              }}
                            >
                              {item.shortName || item.name} ·{' '}
                              {vehiclePlans[item.id].trips.length || '—'} AR
                              {item.id === draft.vehicleId ? ' · devis' : ''}
                            </button>
                          ))}
                      </div>
                      <div className="loading-simulation-actions">
                        {plan.trips.map((item, index) => (
                          <button
                            type="button"
                            key={index}
                            className={tripIndex === index ? 'selected' : ''}
                            onClick={() => {
                              setTripIndex(index);
                              setStep(null);
                            }}
                          >
                            <strong>Aller-retour {index + 1}</strong>
                            <small>
                              {item.nItems} objets · {item.fill} %
                            </small>
                          </button>
                        ))}
                      </div>
                      {trip && (
                        <div className="loading-simulation-stats">
                          {[
                            ['Remplissage', `${trip.fill} %`],
                            ['Volume chargé', `${format(trip.vol)} / ${format(plan.V.net)} m³`],
                            ['Objets', String(trip.nItems)],
                            ['Poids estimé', `≈ ${trip.kg} kg`],
                            ['Gauche / droite', `${trip.left} % / ${100 - trip.left} %`],
                            ['Avant / arrière', `${trip.front} % / ${100 - trip.front} %`],
                          ].map(([label, value]) => (
                            <span key={label}>
                              <small>{label}</small>
                              <strong>{value}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {trip && (
                  <div className="loading-simulation-section">
                    {section(
                      'v3d',
                      'Vue 3D du chargement',
                      currentStep === null
                        ? `${trip.boxes.length} étapes`
                        : `Étape ${currentStep} / ${trip.boxes.length}`,
                    )}
                    {sections.v3d && (
                      <div className="loading-simulation-section-content">
                        <div ref={canvas} className="loading-simulation-canvas" />
                        <div className="loading-simulation-actions">
                          {(
                            [
                              ['iso', '3D'],
                              ['top', 'Dessus'],
                              ['side', 'Côté'],
                              ['rear', 'Arrière'],
                            ] as const
                          ).map(([key, label]) => (
                            <button
                              type="button"
                              key={key}
                              className={viewMode === key ? 'selected' : ''}
                              onClick={() => setViewMode(key)}
                            >
                              {label}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={crewVisible ? 'selected' : ''}
                            onClick={() => {
                              setCrewVisible((value) => !value);
                              setViewMode('iso');
                            }}
                          >
                            {crewVisible
                              ? 'Équipe en action : affichée'
                              : 'Voir l’équipe en action'}
                          </button>
                          <button type="button" onClick={() => setWrap((value) => !value)}>
                            {wrap ? 'Serviettes : affichées' : 'Serviettes : masquées'}
                          </button>
                        </div>
                        <small>Glisser : tourner · Molette : zoom · Clic droit : déplacer</small>
                        <div className="loading-simulation-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setPlaying(false);
                              setStep(Math.max(1, (currentStep ?? trip.boxes.length) - 1));
                            }}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="selected"
                            onClick={() => setPlaying((value) => !value)}
                          >
                            {playing ? 'Pause' : 'Lecture'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaying(false);
                              setStep(
                                (currentStep ?? 0) >= trip.boxes.length
                                  ? null
                                  : (currentStep ?? 0) + 1,
                              );
                            }}
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaying(false);
                              setStep(null);
                            }}
                          >
                            Tout afficher
                          </button>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, trip.boxes.length)}
                          value={currentStep ?? trip.boxes.length}
                          aria-label="Étape de chargement"
                          onChange={(event) => {
                            setPlaying(false);
                            setStep(Number(event.target.value));
                          }}
                        />
                        <span>
                          {currentStep
                            ? `Étape ${currentStep} / ${trip.boxes.length} · ${selectedBox?.u.label ?? ''}`
                            : `Chargement complet · ${trip.boxes.length} étapes`}
                        </span>
                        {selectedBox && <span>{selectedBox.txt}</span>}
                        <div className="loading-simulation-legend">
                          <span className="loading-simulation-color" /> Objet de l’étape
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {trip && (
                  <div className="loading-simulation-section">
                    {section('crew', 'Équipe, manutention et fatigue')}
                    {sections.crew && (
                      <div className="loading-simulation-section-content">
                        <div className="loading-simulation-crew-grid">
                          <div className="loading-simulation-roles">
                            <article style={{ borderColor: '#F6D73C' }}>
                              <strong>
                                Chauffeur · chef d’équipe <small>1 des {crew} manœuvres</small>
                              </strong>
                              <span>
                                Organise et dirige : briefing sécurité, répartition des postes et
                                des objets lourds, inventaire avec le client. Gare au plus près,
                                pose la rampe, range chaque objet dans le camion selon le plan,
                                sangle mur par mur, prête main-forte pour les objets lourds,
                                conduit, fait signer l’état des lieux.
                              </span>
                            </article>
                            <article style={{ borderColor: '#FF8A3D' }}>
                              <strong>
                                Manœuvres <small>{Math.max(1, crew - 1)}</small>
                              </strong>
                              <span>
                                Tiennent les postes de la chaîne de portage ci-dessous. À deux
                                au-delà de 25 kg, charge collée au corps, dos droit.
                              </span>
                            </article>
                            {input?.lines.some((line) => line.dm) && (
                              <article style={{ borderColor: '#9B6BFF' }}>
                                <strong>
                                  Menuisier <small>1</small>
                                </strong>
                                <span>
                                  Démonte avant le chargement, visserie en sachet étiqueté par
                                  meuble, remonte à l’arrivée.
                                </span>
                              </article>
                            )}
                          </div>
                          <div className="loading-simulation-posts">
                            <strong>
                              Chargement · {details.from.where} · déchargement · {details.to.where}
                            </strong>
                            {details.from.posts.map((post, index) => (
                              <div key={index}>
                                <strong>{post.label}</strong>
                                <b>× {post.count}</b>
                                <span>{post.job}</span>
                                <small>Outils : {post.tools}</small>
                              </div>
                            ))}
                          </div>
                          {!!details.handling.length && (
                            <div className="loading-simulation-handling">
                              <strong>Manutention par objet</strong>
                              <small>
                                Porteurs comptés à mains nues dans le devis ; le matériel est
                                seulement conseillé.
                              </small>
                              {details.handling.slice(0, 14).map((item, index) => (
                                <div key={index}>
                                  <strong>
                                    {item.name} <small>· {item.kg} kg</small>
                                  </strong>
                                  <b>
                                    {item.carriers} porteur{item.carriers > 1 ? 's' : ''}
                                  </b>
                                  <span>{item.position}</span>
                                  <small>Matériel conseillé (hors devis) : {item.tool}</small>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="loading-simulation-fatigue">
                            <strong>
                              Indicateur de fatigue{' '}
                              <span style={{ color: details.fatigue.color }}>
                                {details.fatigue.level} · {details.fatigue.score} %
                              </span>
                            </strong>
                            <div className="loading-simulation-fatigue-track">
                              <span
                                style={{
                                  width: `${Math.min(100, details.fatigue.score)}%`,
                                  background: details.fatigue.color,
                                }}
                              />
                            </div>
                            <div className="loading-simulation-fatigue-rows">
                              {details.fatigue.rows.map(([label, value]) => (
                                <div key={label}>
                                  <span>{label}</span>
                                  <strong>{value}</strong>
                                </div>
                              ))}
                            </div>
                            {details.fatigue.recommendations.map((advice) => (
                              <span key={advice}>· {advice}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {trip && (
                  <div className="loading-simulation-section">
                    {section(
                      'steps',
                      'Étapes de chargement et serviettes',
                      `${trip.walls.length} murs · ${trip.need} serviettes`,
                    )}
                    {sections.steps && (
                      <div className="loading-simulation-section-content">
                        <label>
                          Serviettes disponibles{' '}
                          <input
                            type="number"
                            min={0}
                            value={stock}
                            onChange={(event) => {
                              setStock(Math.max(0, Math.round(Number(event.target.value) || 0)));
                              setStockError('');
                            }}
                            onBlur={() => void saveStock()}
                          />
                        </label>
                        {stockError && (
                          <span className="loading-simulation-warning" role="alert">
                            Enregistrement du stock impossible : {stockError}
                          </span>
                        )}
                        <span className="loading-simulation-kit">
                          Serviettes à prévoir : {trip.need} ({blanketLengthCm} × {blanketWidthCm}{' '}
                          cm)
                          {' · '}utilisées : {trip.blankets ?? 0} sur {trip.stock} · Sangles :{' '}
                          {trip.straps ?? 0}
                        </span>
                        {!!trip.noProt && (
                          <span className="loading-simulation-warning">
                            {trip.noProt} objet(s) sans serviette (il en faudrait {trip.need})
                          </span>
                        )}
                        <div className="loading-simulation-checks">
                          <strong>CONTRÔLES DE CHARGEMENT</strong>
                          {trip.checks.map((check, index) => (
                            <span key={index} className={check.ok ? 'ok' : 'warning'}>
                              {check.ok ? '✓' : '!'}{' '}
                              <span>{check.txt || check.text || check.t}</span>
                            </span>
                          ))}
                        </div>
                        <div className="loading-simulation-method">
                          <button
                            type="button"
                            aria-expanded={methodOpen}
                            onClick={() => setMethodOpen((value) => !value)}
                          >
                            {methodOpen ? '⌄' : '›'} Méthode de chargement
                          </button>
                          {methodOpen &&
                            loadingRules.map((rule) => <span key={rule}>· {rule}</span>)}
                        </div>
                        {trip.walls.map((wall, wallIndex) => (
                          <div className="loading-simulation-wall" key={wallIndex}>
                            <strong>{wall.title}</strong>
                            {wall.steps.map((box) => (
                              <button
                                type="button"
                                key={box.step}
                                className={currentStep === box.step ? 'selected' : ''}
                                onClick={() => {
                                  setPlaying(false);
                                  setStep(box.step);
                                }}
                              >
                                <span className="loading-simulation-step-number">{box.step}</span>
                                <span className="loading-simulation-step-content">
                                  {stepImages[box.step - 1] && (
                                    <img src={stepImages[box.step - 1]} alt="" />
                                  )}
                                  <strong>
                                    <i style={{ background: plan.colors[box.u.c] || '#F6D73C' }} />
                                    {box.u.label}
                                  </strong>
                                  <small>{box.txt}</small>
                                  {box.tip && (
                                    <small>
                                      {box.tip.charAt(0).toUpperCase() + box.tip.slice(1)}.
                                    </small>
                                  )}
                                  {box.protTxt && (
                                    <b className={box.prot ? 'protected' : 'unprotected'}>
                                      {box.protTxt}
                                    </b>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="loading-simulation-section">
                  {section('eq', 'Matériel conseillé (hors devis)')}
                  {sections.eq && (
                    <div className="loading-simulation-section-content">
                      <div className="loading-simulation-equipment">
                        {details.equipment.map((item) => (
                          <article key={item.key}>
                            {item.image && <img src={item.image} alt={item.name} />}
                            <div>
                              <strong>{item.name}</strong>
                              <b>{item.quantity}</b>
                              <span>{item.why}</span>
                              <small>{item.norm}</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {!!plan.out.length && (
                  <div className="loading-simulation-section">
                    <strong>Ne rentre pas dans ce véhicule</strong>
                    {plan.out.map((message) => (
                      <span key={message}>{message}</span>
                    ))}
                  </div>
                )}
                <div className="loading-simulation-actions">
                  {(vehicle?.id !== draft.vehicleId || quoteConfig.trips !== plan.trips.length) && (
                    <button
                      type="button"
                      className="loading-simulation-apply"
                      onClick={() => {
                        if (!vehicle) return;
                        setDraft((current) => ({
                          ...current,
                          vehicleId: vehicle.id,
                          estimatedTrips:
                            quoteConfig.calcMode === 'manual'
                              ? current.estimatedTrips
                              : Math.max(1, plan.trips.length),
                        }));
                        if (quoteConfig.calcMode !== 'manual')
                          setQuoteConfig((current) => ({
                            ...current,
                            trips: Math.max(1, plan.trips.length),
                          }));
                      }}
                    >
                      Appliquer au devis : {vehicle?.shortName || vehicle?.name} ·{' '}
                      {tripLabel(plan.trips.length)}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
      {plan && (
        <>
          <button
            className="loading-simulation-download"
            type="button"
            onClick={() => void downloadPlan()}
          >
            Télécharger le plan de chargement
          </button>
          {pdfError && (
            <span className="loading-simulation-warning" role="alert">
              {pdfError}
            </span>
          )}
        </>
      )}
    </div>
  );
}
