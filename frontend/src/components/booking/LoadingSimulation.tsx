import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Draft } from '../../application/booking-draft';
import type { AdminQuoteConfig } from '../../application/admin-quote-draft-storage';
import type { MovingEstimate } from '../../domain/moving-estimate';
import {
  crewPosts,
  equipmentAdvice,
  fatigueAdvice,
  handlingAdvice,
} from '../../domain/loading-simulation-details';
import type { Vehicle } from '../../domain/model';
import { simulationInput, format, tripLabel, loadingRules } from './loading-simulation-model';
import type { SimPlan, SimView } from './loading-simulation-model';
import { generateLoadingSimulationPdf } from './loading-simulation-pdf';
import { useLoadingSimulationPreferences } from '../../application/controllers/useLoadingSimulationPreferences';
import { visibleUiText } from '../../content/visible-ui-text';

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
  const { blanketLengthCm, blanketWidthCm, blanketStock, saveBlanketStock, imageDataUrl } =
    useLoadingSimulationPreferences();
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [vehicleId, setVehicleId] = useState(draft.vehicleId);
  const [tripIndex, setTripIndex] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState('iso');
  const [wrap, setWrap] = useState(true);
  const [stock, setStock] = useState(blanketStock);
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
    setStock(blanketStock);
  }, [blanketStock]);
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
    if (!plan) return;
    setPdfError('');
    const created = await generateLoadingSimulationPdf({
      plan,
      draft,
      vehicle,
      blanketLengthCm,
      blanketWidthCm,
      stock,
      estimate,
      details,
      imageDataUrl,
    });
    if (!created) setPdfError('Le plan de chargement n’a pas pu être généré. Réessayez.');
  }

  async function saveStock() {
    setStockError('');
    setStockError(await saveBlanketStock(stock));
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
            <strong>{visibleUiText.text18}</strong>
            <small>
              {plan
                ? `${plan.trips.length} aller(s)-retour(s) · ${plan.trips.reduce((sum, item) => sum + item.nItems, 0)} objets`
                : 'Inventaire'}
            </small>
          </span>
        </button>
        {open && (
          <div className="loading-simulation-body">
            {!hasItems && <span>{visibleUiText.text19}</span>}
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
                              {vehiclePlans[item.id].trips.length || '—'} {visibleUiText.text20}
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
                            <strong>
                              {visibleUiText.text21}
                              {index + 1}
                            </strong>
                            <small>
                              {item.nItems} {visibleUiText.text22}
                              {item.fill} %
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
                        <small>{visibleUiText.text23}</small>
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
                            {visibleUiText.text24}
                          </button>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, trip.boxes.length)}
                          value={currentStep ?? trip.boxes.length}
                          aria-label={visibleUiText.text25}
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
                          <span className="loading-simulation-color" /> {visibleUiText.text26}
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
                                {visibleUiText.text27}
                                <small>
                                  {visibleUiText.text28}
                                  {crew} {visibleUiText.text29}
                                </small>
                              </strong>
                              <span>{visibleUiText.text30}</span>
                            </article>
                            <article style={{ borderColor: '#FF8A3D' }}>
                              <strong>
                                {visibleUiText.text31}
                                <small>{Math.max(1, crew - 1)}</small>
                              </strong>
                              <span>{visibleUiText.text32}</span>
                            </article>
                            {input?.lines.some((line) => line.dm) && (
                              <article style={{ borderColor: '#9B6BFF' }}>
                                <strong>
                                  {visibleUiText.text33}
                                  <small>{visibleUiText.text34}</small>
                                </strong>
                                <span>{visibleUiText.text35}</span>
                              </article>
                            )}
                          </div>
                          <div className="loading-simulation-posts">
                            <strong>
                              {visibleUiText.text36}
                              {details.from.where} {visibleUiText.text37}
                              {details.to.where}
                            </strong>
                            {details.from.posts.map((post, index) => (
                              <div key={index}>
                                <strong>{post.label}</strong>
                                <b>× {post.count}</b>
                                <span>{post.job}</span>
                                <small>
                                  {visibleUiText.text38}
                                  {post.tools}
                                </small>
                              </div>
                            ))}
                          </div>
                          {!!details.handling.length && (
                            <div className="loading-simulation-handling">
                              <strong>{visibleUiText.text39}</strong>
                              <small>{visibleUiText.text40}</small>
                              {details.handling.slice(0, 14).map((item, index) => (
                                <div key={index}>
                                  <strong>
                                    {item.name}{' '}
                                    <small>
                                      · {item.kg} {visibleUiText.text41}
                                    </small>
                                  </strong>
                                  <b>
                                    {item.carriers} {visibleUiText.text42}
                                    {item.carriers > 1 ? 's' : ''}
                                  </b>
                                  <span>{item.position}</span>
                                  <small>
                                    {visibleUiText.text43}
                                    {item.tool}
                                  </small>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="loading-simulation-fatigue">
                            <strong>
                              {visibleUiText.text44}{' '}
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
                          {visibleUiText.text45}{' '}
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
                            {visibleUiText.text46}
                            {stockError}
                          </span>
                        )}
                        <span className="loading-simulation-kit">
                          {visibleUiText.text47}
                          {trip.need} ({blanketLengthCm} × {blanketWidthCm} {visibleUiText.text48}
                          {' · '}
                          {visibleUiText.text49}
                          {trip.blankets ?? 0} {visibleUiText.text15}
                          {trip.stock} {visibleUiText.text50} {trip.straps ?? 0}
                        </span>
                        {!!trip.noProt && (
                          <span className="loading-simulation-warning">
                            {trip.noProt} {visibleUiText.text51}
                            {trip.need})
                          </span>
                        )}
                        <div className="loading-simulation-checks">
                          <strong>{visibleUiText.text52}</strong>
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
                            {methodOpen ? '⌄' : '›'} {visibleUiText.text53}
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
                    <strong>{visibleUiText.text54}</strong>
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
                      {visibleUiText.text55}
                      {vehicle?.shortName || vehicle?.name} · {tripLabel(plan.trips.length)}
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
            {visibleUiText.text56}
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
