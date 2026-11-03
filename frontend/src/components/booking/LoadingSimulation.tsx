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
    options: { wrap: boolean },
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
function simulationInput(inventory: Inventory, vehicle: Vehicle, stock: number) {
  const lines: {
    k: string;
    q: number;
    s: number;
    g: string;
    dm: boolean;
    n: string;
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
    lines.push({
      k: itemKeys[key] ?? key,
      q: quantity,
      s: size,
      g: formatKey[format ?? 'medium'],
      dm: dismantle,
      n: label || definition?.label || key,
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
    blk: { L: 2.04, W: 1.84 },
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
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [vehicleId, setVehicleId] = useState(draft.vehicleId);
  const [tripIndex, setTripIndex] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState('iso');
  const [wrap, setWrap] = useState(true);
  const [stock, setStock] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>({ veh: true, v3d: true });
  const [methodOpen, setMethodOpen] = useState(false);
  const [crewVisible, setCrewVisible] = useState(false);
  const [stepImages, setStepImages] = useState<string[]>([]);
  const canvas = useRef<HTMLDivElement>(null);
  const viewer = useRef<SimView | null>(null);
  const vehicle = vehicles.find((item) => item.id === vehicleId) ?? vehicles[0];
  const input = useMemo(
    () => (vehicle ? simulationInput(draft.inventory, vehicle, stock) : null),
    [draft.inventory, vehicle, stock],
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
        result[item.id] = window.DemSim!.plan(simulationInput(draft.inventory, item, stock));
      } catch {
        // A vehicle with incomplete dimensions is omitted, as in the reference.
      }
    });
    return result;
  }, [ready, hasItems, vehicles, draft.inventory, stock]);
  const trip = plan?.trips[Math.min(tripIndex, plan.trips.length - 1)] ?? null;
  const currentStep = step === null ? null : Math.min(step, trip?.boxes.length ?? 0);
  const currentStepRef = useRef(currentStep);
  const selectedBox = currentStep ? trip?.boxes[currentStep - 1] : null;
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
      menu: Object.values(draft.inventory.entries).some((item) => item.dismantle) ? 1 : 0,
      from: 'LOGEMENT',
      site: { F: draft.inventory.fromFloor, lift: draft.inventory.fromLift },
    });
  }, [crewVisible, crew, draft.inventory, plan, trip, sections.v3d, wrap]);

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
    const { default: JsPDF } = await import('jspdf');
    const pdf = new JsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('PLAN DE CHARGEMENT', 40, 45);
    pdf.setFontSize(10);
    pdf.text(`${vehicle?.name ?? ''} · ${plan.trips.length} aller(s)-retour(s)`, 40, 65);
    plan.trips.forEach((item, index) => {
      if (index) pdf.addPage();
      if (index) pdf.text(`PLAN DE CHARGEMENT · ${index + 1}`, 40, 45);
      const image = window.DemSim?.snapshot(plan, index, { wrap });
      if (image) pdf.addImage(image, 'JPEG', 40, 80, 510, 270);
      pdf.setFontSize(10);
      pdf.text(
        `Voyage ${index + 1} · ${item.nItems} objets · ${format(item.vol)} m³ · ${item.kg} kg`,
        40,
        365,
      );
      let y = 390;
      item.walls.forEach((wall) => {
        if (y > 760) {
          pdf.addPage();
          y = 45;
        }
        pdf.text(wall.title, 40, y);
        y += 15;
        wall.steps.forEach((box) => {
          if (y > 770) {
            pdf.addPage();
            y = 45;
          }
          pdf.text(`${box.step}. ${box.u.label}`, 50, y);
          y += 14;
        });
      });
    });
    pdf.save(`Plan-de-chargement-${draft.customerName || 'devis'}.pdf`);
  }

  return (
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
                          {crewVisible ? 'Équipe en action : affichée' : 'Voir l’équipe en action'}
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
                              Organise et dirige : briefing sécurité, répartition des postes et des
                              objets lourds, inventaire avec le client. Gare au plus près, pose la
                              rampe, range chaque objet dans le camion selon le plan, sangle mur par
                              mur, prête main-forte pour les objets lourds, conduit, fait signer
                              l’état des lieux.
                            </span>
                          </article>
                          <article style={{ borderColor: '#FF8A3D' }}>
                            <strong>
                              Manœuvres <small>{Math.max(1, crew - 1)}</small>
                            </strong>
                            <span>
                              Tiennent les postes de la chaîne de portage ci-dessous. À deux au-delà
                              de 25 kg, charge collée au corps, dos droit.
                            </span>
                          </article>
                          {input?.lines.some((line) => line.dm) && (
                            <article style={{ borderColor: '#9B6BFF' }}>
                              <strong>
                                Menuisier <small>1</small>
                              </strong>
                              <span>
                                Démonte avant le chargement, visserie en sachet étiqueté par meuble,
                                remonte à l’arrivée.
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
                          max={500}
                          value={stock}
                          onChange={(event) =>
                            setStock(Math.max(0, Math.min(500, Number(event.target.value) || 0)))
                          }
                        />
                      </label>
                      <span className="loading-simulation-kit">
                        Serviettes à prévoir : {trip.need} · utilisées : {trip.blankets ?? 0} sur{' '}
                        {trip.stock} · Sangles : {trip.straps ?? 0}
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
                            {check.ok ? '✓' : '!'} <span>{check.txt || check.text || check.t}</span>
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
                        {methodOpen && loadingRules.map((rule) => <span key={rule}>· {rule}</span>)}
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
                <button type="button" onClick={() => void downloadPlan()}>
                  Télécharger le plan de chargement
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
