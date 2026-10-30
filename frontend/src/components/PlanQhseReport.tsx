import { uiText } from '../content/reference-ui-text';
import { useState } from 'react';
import { ChevronDown, Download, Sparkles } from 'lucide-react';
import type { Booking, WorkPlanStep } from '../domain/model';

type Kpi = { label: string; value: string; color: string; sub: string };
type NonConformity = {
  date: string;
  ref: string;
  step: string;
  hour: string;
  real: string;
  status: string;
  cause: string;
  severity: string;
  reason: string;
  action: string;
};
export type PlanReport = {
  period: string;
  kpi: Kpi[];
  causes: [string, number][];
  gravity: Record<'min' | 'maj' | 'cri', number>;
  nonConformities: NonConformity[];
  bookingCount: number;
  respected: number;
  justified: number;
  unjustified: number;
  todo: number;
};

const GRAVITY = [
  ['min', 'Mineure', '#FFD23F'],
  ['maj', 'Majeure', '#FF9F5A'],
  ['cri', 'Critique', '#FF5A5F'],
] as const;
const countStatus = (steps: WorkPlanStep[]) => {
  if (
    steps.some(
      ({ review }) =>
        (review.status === 'late' || review.status === 'not_respected') &&
        !review.reason.trim() &&
        !review.photo,
    )
  )
    return 'unjustified';
  if (steps.some(({ review }) => review.status === 'pending')) return 'todo';
  if (steps.every(({ review }) => review.status === 'respected')) return 'respected';
  return 'justified';
};
const percent = (part: number, total: number) =>
  total ? `${Math.round((part / total) * 100)} %` : '—';
const tone = (part: number, total: number, good: number) =>
  !total
    ? '#AEB4BB'
    : part / total >= good
      ? '#3DDC84'
      : part / total >= good - 0.2
        ? '#FFD23F'
        : '#FF5A5F';

export function buildPlanReport(
  bookings: Booking[],
  stepsFor: (booking: Booking) => WorkPlanStep[],
  period: string,
): PlanReport {
  let steps = 0,
    evaluated = 0,
    onTime = 0,
    late = 0,
    failed = 0,
    justifiedSteps = 0,
    actions = 0;
  const counts = { respected: 0, justified: 0, unjustified: 0, todo: 0 };
  const causes: Record<string, number> = {};
  const gravity = { min: 0, maj: 0, cri: 0 };
  const nonConformities: NonConformity[] = [];
  for (const booking of bookings) {
    const plan = stepsFor(booking);
    counts[countStatus(plan)]++;
    for (const step of plan) {
      const review = step.review;
      steps++;
      if (review.status !== 'pending') evaluated++;
      if (review.status === 'respected') onTime++;
      if (review.status === 'late') late++;
      if (review.status === 'not_respected') failed++;
      if (review.status !== 'late' && review.status !== 'not_respected') continue;
      if (review.reason.trim() || review.photo) justifiedSteps++;
      if (review.correctiveAction?.trim()) actions++;
      const cause = review.cause || 'Non classée';
      causes[cause] = (causes[cause] || 0) + 1;
      gravity[review.severity || 'min']++;
      nonConformities.push({
        date: booking.date ? booking.date.split('-').reverse().join('/') : '',
        ref: booking.reference,
        step: step.title,
        hour: `${step.time}–${String(Math.floor((Number(step.time.slice(0, 2)) * 60 + Number(step.time.slice(3, 5)) + step.minutes) / 60) % 24).padStart(2, '0')}:${String((Number(step.time.slice(0, 2)) * 60 + Number(step.time.slice(3, 5)) + step.minutes) % 60).padStart(2, '0')}`,
        real: review.actualTime || '',
        status: review.status === 'late' ? 'En retard' : 'Non respecté',
        cause,
        severity: GRAVITY.find(([value]) => value === (review.severity || 'min'))?.[1] || 'Mineure',
        reason: review.reason,
        action: review.correctiveAction || '',
      });
    }
  }
  const nonConformityCount = late + failed;
  const kpi: Kpi[] = [
    {
      label: 'Respect du planning',
      value: percent(onTime, evaluated),
      color: tone(onTime, evaluated, 0.9),
      sub: 'étapes respectées / évaluées',
    },
    {
      label: 'Ponctualité',
      value: percent(onTime, onTime + late),
      color: tone(onTime, onTime + late, 0.9),
      sub: 'à l’heure / (à l’heure + retard)',
    },
    {
      label: 'Non-conformités',
      value: String(nonConformityCount),
      color: nonConformityCount ? '#FF5A5F' : '#3DDC84',
      sub: `${late} retard(s) · ${failed} non respecté(s)`,
    },
    {
      label: 'Écarts justifiés',
      value: percent(justifiedSteps, nonConformityCount),
      color: tone(justifiedSteps, nonConformityCount, 1),
      sub: 'raison ou photo fournie',
    },
    {
      label: 'Actions correctives',
      value: percent(actions, nonConformityCount),
      color: tone(actions, nonConformityCount, 1),
      sub: 'écarts avec action définie',
    },
    {
      label: 'Couverture du contrôle',
      value: percent(evaluated, steps),
      color: tone(evaluated, steps, 1),
      sub: `${evaluated} / ${steps} étapes évaluées`,
    },
  ];
  return {
    period,
    kpi,
    causes: Object.entries(causes).sort((a, b) => b[1] - a[1]),
    gravity,
    nonConformities,
    bookingCount: bookings.length,
    ...counts,
  };
}

function localAnalysis(report: PlanReport) {
  const top = report.causes[0];
  const lines = [
    'SYNTHÈSE',
    `${report.bookingCount} déménagement(s) sur la période. Respect du planning : ${report.kpi[0].value}, ponctualité : ${report.kpi[1].value}, ${report.kpi[2].value} non-conformité(s).`,
    '',
    'POINTS À AMÉLIORER',
  ];
  if (top) lines.push(`- Cause principale des écarts : ${top[0]} (${top[1]}).`);
  if (report.unjustified)
    lines.push(`- ${report.unjustified} déménagement(s) avec un écart non justifié.`);
  if (report.kpi[4].value !== '100 %' && report.kpi[4].value !== '—')
    lines.push(`- Actions correctives définies pour seulement ${report.kpi[4].value} des écarts.`);
  if (report.todo) lines.push(`- ${report.todo} déménagement(s) pas encore contrôlés.`);
  lines.push(
    '',
    'ACTIONS PRIORITAIRES',
    '- Justifier chaque écart (raison ou photo) le jour même.',
    '- Définir une action corrective pour chaque non-conformité majeure ou critique.',
  );
  return `${lines.join('\n')}\n\n(Analyse automatique simplifiée : l’IA n’est pas disponible.)`;
}

async function analyzeReport(report: PlanReport) {
  const provider = (
    window as Window & { claude?: { complete?: (input: unknown) => Promise<string> } }
  ).claude;
  if (!provider?.complete) return localAnalysis(report);
  try {
    const text = await provider.complete({
      max_tokens: 900,
      system:
        'Tu es un responsable QHSE dans une entreprise de déménagement au Sénégal (Dakar). Tu analyses le suivi du planning des déménagements. Réponds en français, de façon factuelle et concrète, sans emoji ni markdown (pas de #, pas de **). Utilise exactement ces 3 titres en majuscules, chacun sur sa ligne : SYNTHÈSE, POINTS À AMÉLIORER, ACTIONS PRIORITAIRES. Sous les deux derniers, des lignes commençant par "- ". Maximum 5 points par section. Appuie-toi uniquement sur les données fournies ; si elles sont insuffisantes, dis-le et indique quoi renseigner.',
      messages: [
        {
          role: 'user',
          content: `Données du suivi du planning :\n${JSON.stringify({ periode: report.period, demenagements: report.bookingCount, respectes: report.respected, ecartsJustifies: report.justified, ecartsNonJustifies: report.unjustified, aVerifier: report.todo, indicateurs: report.kpi.map((item) => `${item.label}: ${item.value} (${item.sub})`), causes: report.causes, gravite: report.gravity, nonConformites: report.nonConformities.slice(0, 40) })}`,
        },
      ],
    });
    return (
      String(text || '')
        .replace(/\*\*|#+ ?/g, '')
        .trim() || localAnalysis(report)
    );
  } catch {
    return localAnalysis(report);
  }
}

async function downloadReport(report: PlanReport, analysis: string) {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;
  const safe = (value: string) =>
    value
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/[−–—]/g, '-')
      .replace(/[·•]/g, '-')
      .replace(/[’]/g, "'")
      .replace(/œ/g, 'oe');
  const line = (value: string, size = 10, bold = false, indent = 0) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const wrappedText: unknown = doc.splitTextToSize(safe(value), 515 - indent);
    const parts = Array.isArray(wrappedText) ? wrappedText : [wrappedText];
    for (const part of parts) {
      if (typeof part !== 'string') continue;
      if (y > 800) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin + indent, y);
      y += size + 4;
    }
  };
  const space = () => {
    y += 10;
  };
  line('RAPPORT QHSE - SUIVI DU PLANNING', 16, true);
  line(`Demenag Express - ${report.period}`);
  line(`Édité le ${new Date().toLocaleString('fr-FR')}`, 9);
  space();
  line('1. Synthèse', 12, true);
  line(
    `${report.bookingCount} déménagement(s) : ${report.respected} planning respecté, ${report.justified} avec écarts justifiés, ${report.unjustified} avec écart non justifié, ${report.todo} à vérifier.`,
  );
  space();
  line('2. Indicateurs', 12, true);
  report.kpi.forEach((item) => line(`${item.label} : ${item.value} (${item.sub})`));
  space();
  line('3. Causes des écarts', 12, true);
  if (!report.causes.length) line('Aucun écart sur la période.');
  report.causes.forEach(([cause, count]) => line(`${cause} : ${count}`));
  space();
  line('4. Gravité', 12, true);
  line(
    `Mineure : ${report.gravity.min}   Majeure : ${report.gravity.maj}   Critique : ${report.gravity.cri}`,
  );
  space();
  line('5. Registre des non-conformités', 12, true);
  if (!report.nonConformities.length) line('Aucune non-conformité.');
  report.nonConformities.forEach((item, index) => {
    line(
      `${index + 1}. ${item.date} - ${item.ref} - ${item.step} (${item.hour}${item.real ? `, réel ${item.real}` : ''})`,
      10,
      true,
    );
    line(
      `Statut : ${item.status} - Cause : ${item.cause} - Gravité : ${item.severity}`,
      9.5,
      false,
      12,
    );
    line(`Justification : ${item.reason || 'manquante'}`, 9.5, false, 12);
    line(`Action corrective : ${item.action || 'à définir'}`, 9.5, false, 12);
  });
  if (analysis) {
    space();
    line('6. Analyse IA et points à améliorer', 12, true);
    analysis.split('\n').forEach((part) => (part.trim() ? line(part) : space()));
  }
  space();
  line('Visa du responsable : ______________________');
  doc.save('Rapport-QHSE-planning.pdf');
}

export function PlanQhseReport({ report }: { report: PlanReport }) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<{ period: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = analysis?.period === report.period ? analysis.text : '';
  const runAnalysis = async () => {
    if (busy) return;
    setBusy(true);
    const result = await analyzeReport(report);
    setAnalysis({ period: report.period, text: result });
    setBusy(false);
  };
  return (
    <section className="reference-plan-report">
      <button
        type="button"
        className="reference-plan-report-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={`reference-plan-chevron${open ? ' open' : ''}`}>
          <ChevronDown size={16} strokeWidth={2.5} />
        </span>
        <strong>{uiText['rapportQHSE']}</strong>
        <span>
          {report.kpi[0].value} {uiText['respecte2']}
          {report.nonConformities.length} {uiText['nonConformite']}
          {report.nonConformities.length > 1 ? 's' : ''}
        </span>
      </button>
      {open && (
        <div className="reference-plan-report-body">
          <div className="reference-plan-kpis">
            {report.kpi.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong style={{ color: item.color }}>{item.value}</strong>
                <small>{item.sub}</small>
              </div>
            ))}
          </div>
          <div className="reference-plan-report-breakdown">
            <div>
              <h3>{uiText['causesDESECARTS']}</h3>
              {report.causes.length ? (
                report.causes.map(([cause, count]) => (
                  <div className="reference-plan-cause-bar" key={cause}>
                    <div>
                      <span>{cause}</span>
                      <strong>{count}</strong>
                    </div>
                    <div>
                      <span
                        style={{
                          width: `${Math.max(6, Math.round((count / report.causes[0][1]) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <span>{uiText['aucunEcartSurLaPeriode']}</span>
              )}
            </div>
            <div>
              <h3>{uiText['gravite']}</h3>
              <div className="reference-plan-gravity">
                {GRAVITY.map(([key, label, color]) => (
                  <div key={key}>
                    <strong style={{ color }}>{report.gravity[key]}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <h3>{uiText['registreDESNONCONFORMITES']}</h3>
          {report.nonConformities.length ? (
            report.nonConformities.map((item, index) => (
              <div className="reference-plan-nc" key={`${item.ref}-${item.step}-${index}`}>
                <strong>
                  {item.date} · {item.ref} · {item.step} ({item.hour})
                </strong>
                <span>
                  {item.status} · {item.cause} · {item.severity}
                </span>
                <span>
                  {uiText['justification']}
                  {item.reason}
                </span>
                <span>
                  {uiText['actionCorrective']}
                  {item.action}
                </span>
              </div>
            ))
          ) : (
            <span>{uiText['aucuneNonConformite']}</span>
          )}
          <div className="reference-plan-ai">
            <div>
              <Sparkles size={18} />
              <strong>{uiText['assistantIAPointsAAmeliorer']}</strong>
              {busy ? (
                <span>{uiText['analyseEnCours']}</span>
              ) : (
                <button type="button" onClick={() => void runAnalysis()}>
                  {text ? 'Relancer l’analyse IA' : 'Analyser avec l’IA'}
                </button>
              )}
            </div>
            {text && <p>{text}</p>}
          </div>
          {error && <span role="alert">{error}</span>}
          <button
            type="button"
            className="reference-plan-report-download"
            onClick={() =>
              void downloadReport(report, text).catch(() => setError('Téléchargement impossible.'))
            }
          >
            <Download size={16} /> {uiText['telechargerLeRapportQHSEPDF']}
          </button>
        </div>
      )}
    </section>
  );
}
