import { uiText } from '../content/reference-ui-text';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdministration } from '../application/controllers/useAdministration';
import { useBookingCommands } from '../application/controllers/useBookingCommands';
import { errorMessage } from '../application/error-message';
import { buildPlanReport, PlanQhseReport } from '../components/PlanQhseReport';
import type { Booking, WorkPlanReview, WorkPlanStep } from '../domain/model';

type Period = 'day' | 'week' | 'month';
type ReviewPatch = Pick<
  WorkPlanReview,
  'status' | 'reason' | 'actualTime' | 'photo' | 'cause' | 'severity' | 'correctiveAction'
>;
const CAUSES = [
  'Qualité',
  'Sécurité',
  'Environnement',
  'Client',
  'Véhicule',
  'Équipe',
  'Circulation',
] as const;
const SEVERITIES = [
  { value: 'min', label: 'Mineure', color: '#FFD23F' },
  { value: 'maj', label: 'Majeure', color: '#FF9F5A' },
  { value: 'cri', label: 'Critique', color: '#FF5A5F' },
] as const;
const COLORS = {
  respected: '#3DDC84',
  justified: '#FFD23F',
  unjustified: '#FF5A5F',
  todo: '#AEB4BB',
};
const todayDakar = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(new Date());
const shiftDay = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const weekStart = (day: string) => {
  const date = new Date(`${day}T12:00:00Z`);
  return shiftDay(day, -((date.getUTCDay() + 6) % 7));
};
const shortDate = (day: string) => {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};
function periodTitle(period: Period, day: string) {
  if (period === 'day')
    return new Date(`${day}T12:00:00Z`)
      .toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
      .replace(/^./, (letter) => letter.toUpperCase());
  if (period === 'week') {
    const start = weekStart(day);
    return `Semaine du ${shortDate(start)} au ${shortDate(shiftDay(start, 6))}`;
  }
  return new Date(`${day.slice(0, 7)}-01T12:00:00Z`)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/^./, (letter) => letter.toUpperCase());
}
function shiftPeriod(day: string, period: Period, amount: number) {
  if (period === 'month') {
    const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return date.toISOString().slice(0, 10);
  }
  return shiftDay(day, amount * (period === 'day' ? 1 : 7));
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const time = (value: number) =>
  `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const vehicleTag = (name: string) =>
  /sprinter/i.test(name)
    ? 'Sprinter'
    : /trafic/i.test(name)
      ? 'Trafic'
      : /master/i.test(name)
        ? 'Master'
        : name;
const pending = (): WorkPlanReview => ({
  status: 'pending',
  reason: '',
  checkedAt: null,
  checkedBy: null,
});

function stepsFor(booking: Booking): WorkPlanStep[] {
  if (booking.workPlan?.length) return booking.workPlan;
  const afternoon = /apr/i.test(booking.timeSlot);
  const startSlot = afternoon ? 13 * 60 : 8 * 60;
  const endSlot = /matin/i.test(booking.timeSlot) ? 12 * 60 : 17 * 60;
  const specified = /^(\d{1,2}):(\d{2})$/.exec(booking.timeSlot);
  const start = booking.inventorySnapshot?.startTime
    ? minutes(booking.inventorySnapshot.startTime)
    : specified
      ? Number(specified[1]) * 60 + Number(specified[2])
      : startSlot;
  const end = Math.max(
    start + 60,
    booking.inventorySnapshot?.endTime ? minutes(booking.inventorySnapshot.endTime) : endSlot,
  );
  return [
    {
      id: 'fallback-1',
      time: time(start),
      title: 'Arrivée au départ',
      detail: '',
      minutes: 15,
      review: pending(),
    },
    {
      id: 'fallback-2',
      time: time(start + 15),
      title: 'Déménagement',
      detail: 'Fiche d’appel non remplie : durée du créneau',
      minutes: end - start - 25,
      review: pending(),
    },
    {
      id: 'fallback-3',
      time: time(end - 10),
      title: 'Vérification finale',
      detail: '',
      minutes: 10,
      review: pending(),
    },
  ];
}

function statusFor(steps: WorkPlanStep[]) {
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
}

async function photoData(file: File) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL('image/jpeg', 0.7);
}

function PlanRow({
  step,
  save,
  viewPhoto,
}: {
  step: WorkPlanStep;
  save: (stepId: string, patch: ReviewPatch) => Promise<void>;
  viewPhoto: (photo: string) => void;
}) {
  const initial = {
    status: step.review.status,
    reason: step.review.reason,
    actualTime: step.review.actualTime ?? '',
    photo: step.review.photo ?? '',
    cause: step.review.cause ?? '',
    severity: step.review.severity ?? '',
    correctiveAction: step.review.correctiveAction ?? '',
  };
  const [draft, setDraft] = useState<ReviewPatch>(initial);
  const draftRef = useRef<ReviewPatch>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const commit = (patch: Partial<ReviewPatch>, delayed = false) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    const send = () => {
      void save(step.id, next)
        .then(() => setError(''))
        .catch((cause) => setError(errorMessage(cause)));
    };
    if (delayed) timer.current = setTimeout(send, 450);
    else send();
  };
  const mismatch = draft.status === 'late' || draft.status === 'not_respected';
  const missing = mismatch && !draft.reason.trim() && !draft.photo;
  const choices = [
    { value: 'respected' as const, label: 'Respecté', color: '#3DDC84' },
    { value: 'late' as const, label: 'En retard', color: '#FFD23F' },
    { value: 'not_respected' as const, label: 'Non respecté', color: '#FF5A5F' },
  ];
  return (
    <div className="reference-plan-row">
      <div className="reference-plan-hour">
        <span
          style={{
            background:
              draft.status === 'respected'
                ? '#3DDC84'
                : draft.status === 'late'
                  ? '#FFD23F'
                  : draft.status === 'not_respected'
                    ? '#FF5A5F'
                    : '#4A5057',
          }}
        />
        <strong>
          {step.time} – {time(minutes(step.time) + step.minutes)}
        </strong>
      </div>
      <div className="reference-plan-row-body">
        <div>
          <strong>{step.title}</strong>
          {step.detail && <small>{step.detail}</small>}
        </div>
        <div className="reference-plan-actions">
          {choices.map((choice) => (
            <button
              type="button"
              key={choice.value}
              aria-pressed={draft.status === choice.value}
              style={{
                background: draft.status === choice.value ? choice.color : 'transparent',
                borderColor: draft.status === choice.value ? choice.color : '#3B4046',
                color: draft.status === choice.value ? '#1E2023' : '#D5D9DE',
              }}
              onClick={() =>
                commit({ status: draft.status === choice.value ? 'pending' : choice.value })
              }
            >
              {choice.label}
            </button>
          ))}
          <label>
            {uiText['heureReelle']}{' '}
            <input
              type="time"
              value={draft.actualTime}
              onChange={(event) => commit({ actualTime: event.target.value }, true)}
            />
          </label>
        </div>
        {mismatch && (
          <>
            <div className="reference-plan-proof">
              <textarea
                rows={2}
                placeholder={uiText['justificatifRaisonDeLEcart']}
                value={draft.reason}
                onChange={(event) => commit({ reason: event.target.value }, true)}
              />
              {draft.photo ? (
                <div className="reference-plan-thumbnail">
                  <img
                    src={draft.photo}
                    alt={uiText['justificatif']}
                    onClick={() => viewPhoto(draft.photo ?? '')}
                  />
                  <button
                    type="button"
                    title={uiText['retirerLaPhoto']}
                    onClick={() => commit({ photo: '' })}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="reference-plan-photo">
                  <Camera size={16} strokeWidth={2} /> {uiText['photo']}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file)
                        void photoData(file)
                          .then((photo) => commit({ photo }))
                          .catch((cause) => setError(errorMessage(cause)));
                    }}
                  />
                </label>
              )}
            </div>
            <div className="reference-plan-cause-fields">
              <span>{uiText['cause']}</span>
              <div>
                {CAUSES.map((cause) => (
                  <button
                    type="button"
                    key={cause}
                    className={draft.cause === cause ? 'selected' : ''}
                    onClick={() => commit({ cause: draft.cause === cause ? '' : cause })}
                  >
                    {cause}
                  </button>
                ))}
              </div>
              <span>{uiText['gravite']}</span>
              <div>
                {SEVERITIES.map(({ value, label, color }) => (
                  <button
                    type="button"
                    key={value}
                    style={{
                      background: draft.severity === value ? color : 'transparent',
                      borderColor: draft.severity === value ? color : '#3B4046',
                      color: draft.severity === value ? '#1E2023' : '#D5D9DE',
                    }}
                    onClick={() => commit({ severity: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                placeholder={uiText['actionCorrectivePourEviterQueCaSeReproduise']}
                value={draft.correctiveAction}
                onChange={(event) => commit({ correctiveAction: event.target.value }, true)}
              />
            </div>
          </>
        )}
        {missing && (
          <span className="reference-plan-missing">{uiText['justificatifManquant']}</span>
        )}
        {error && (
          <span className="reference-plan-missing" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

export function AdminPlanFollowUp() {
  const commands = useBookingCommands();
  const { bookings, setBookings, loading, error } = useAdministration();
  const [period, setPeriod] = useState<Period>('week');
  const [selectedDay, setSelectedDay] = useState(todayDakar);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewPhoto, setViewPhoto] = useState('');
  const [zoom, setZoom] = useState(1);
  const queues = useRef(new Map<string, Promise<Booking>>());
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;
  const startOfWeek = weekStart(selectedDay);
  const endOfWeek = shiftDay(startOfWeek, 6);
  const visible = useMemo(
    () =>
      bookings
        .filter((booking) => booking.date && booking.status !== 'cancelled')
        .filter((booking) =>
          period === 'day'
            ? booking.date === selectedDay
            : period === 'week'
              ? booking.date! >= startOfWeek && booking.date! <= endOfWeek
              : booking.date!.slice(0, 7) === selectedDay.slice(0, 7),
        )
        .sort((a, b) => `${a.date}${a.timeSlot}`.localeCompare(`${b.date}${b.timeSlot}`)),
    [bookings, period, selectedDay, startOfWeek, endOfWeek],
  );
  const counts = visible.reduce(
    (result, booking) => {
      result[statusFor(stepsFor(booking))]++;
      return result;
    },
    { respected: 0, justified: 0, unjustified: 0, todo: 0 },
  );
  const report = useMemo(
    () => buildPlanReport(visible, stepsFor, periodTitle(period, selectedDay)),
    [visible, period, selectedDay],
  );
  const save = (booking: Booking, stepId: string, patch: ReviewPatch): Promise<void> => {
    const prior = queues.current.get(booking.id) ?? Promise.resolve(booking);
    const task = prior
      .catch(() => bookingsRef.current.find((item) => item.id === booking.id) ?? booking)
      .then(async (queued) => {
        const live = bookingsRef.current.find((item) => item.id === booking.id);
        const current = live && live.version > queued.version ? live : queued;
        const next = await commands.reviewWorkPlan(
          booking.id,
          stepId,
          patch.status,
          patch.reason,
          current.version,
          patch.actualTime,
          patch.photo,
          {
            cause: patch.cause,
            severity: patch.severity,
            correctiveAction: patch.correctiveAction,
          },
        );
        setBookings((items) => items.map((item) => (item.id === next.id ? next : item)));
        return next;
      });
    queues.current.set(booking.id, task);
    return task.then(() => undefined);
  };
  return (
    <div className="reference-plan-page">
      <section className="reference-plan-overview">
        <div className="reference-plan-overview-head">
          <span>{uiText['suiviDESPLANNINGSPREVISIONNELS']}</span>
          <div className="reference-plan-filters">
            {(
              [
                ['day', 'Jour'],
                ['week', 'Semaine'],
                ['month', 'Mois'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={period === value ? 'active' : ''}
                onClick={() => setPeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="reference-plan-date-nav">
          <button
            type="button"
            aria-label={uiText['periodePrecedente']}
            onClick={() => setSelectedDay((day) => shiftPeriod(day, period, -1))}
          >
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <strong>{periodTitle(period, selectedDay)}</strong>
          <button
            type="button"
            aria-label={uiText['periodeSuivante']}
            onClick={() => setSelectedDay((day) => shiftPeriod(day, period, 1))}
          >
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
          <input
            type="date"
            aria-label={uiText['dateDuSuivi']}
            value={selectedDay}
            onChange={(event) => event.target.value && setSelectedDay(event.target.value)}
          />
          <button
            type="button"
            className="reference-plan-today"
            onClick={() => setSelectedDay(todayDakar())}
          >
            {uiText['aujourdHui2']}
          </button>
        </div>
        <div className="reference-plan-stats">
          {(
            [
              ['Respectés', counts.respected, COLORS.respected],
              ['Écarts justifiés', counts.justified, COLORS.justified],
              ['Non justifiés', counts.unjustified, COLORS.unjustified],
              ['À vérifier', counts.todo, COLORS.todo],
            ] as const
          ).map(([label, count, color]) => (
            <div key={label}>
              <strong style={{ color }}>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <PlanQhseReport report={report} />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="reference-plan-empty">{uiText['chargementDesReservations']}</p>
      ) : visible.length ? (
        visible.map((booking) => {
          const steps = stepsFor(booking);
          const state = statusFor(steps);
          const reviewed = steps.filter((step) => step.review.status !== 'pending').length;
          const open = Boolean(expanded[booking.id]);
          const first = steps[0];
          const last = steps.at(-1);
          const span =
            first && last ? `${first.time} – ${time(minutes(last.time) + last.minutes)}` : '';
          const date = new Date(`${booking.date}T12:00:00`)
            .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
            .replace(/^./, (letter) => letter.toUpperCase());
          const label =
            state === 'unjustified'
              ? 'Écart non justifié'
              : state === 'todo'
                ? reviewed
                  ? 'En cours'
                  : 'À vérifier'
                : state === 'respected'
                  ? 'Planning respecté'
                  : 'Écarts justifiés';
          const color = state === 'todo' && reviewed ? '#FFD23F' : COLORS[state];
          return (
            <article className="reference-plan-card" key={booking.id}>
              <button
                type="button"
                className="reference-plan-card-head"
                aria-expanded={open}
                onClick={() => setExpanded((current) => ({ ...current, [booking.id]: !open }))}
              >
                <span className={`reference-plan-chevron${open ? ' open' : ''}`}>
                  <ChevronDown size={16} strokeWidth={2.5} />
                </span>
                <span className="reference-plan-card-title">
                  <strong>
                    {date} · {span}
                  </strong>
                  <small>
                    {booking.reference} · {booking.customerName} ·{' '}
                    {vehicleTag(booking.vehicle.name)}
                  </small>
                </span>
                <span className="reference-plan-progress">
                  {reviewed} / {steps.length}
                </span>
                <span className="reference-plan-badge" style={{ color, borderColor: color }}>
                  {label}
                </span>
              </button>
              {open && (
                <div className="reference-plan-rows">
                  {steps.map((step) => (
                    <PlanRow
                      key={`${booking.id}-${step.id}`}
                      step={step}
                      save={(id, patch) => save(booking, id, patch)}
                      viewPhoto={(photo) => {
                        setViewPhoto(photo);
                        setZoom(1);
                      }}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })
      ) : (
        <span className="reference-plan-empty">{uiText['aucunRendezVousSurCettePeriode']}</span>
      )}
      {viewPhoto && (
        <div
          className="reference-plan-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={uiText['justificatifPhotographique']}
          onClick={() => setViewPhoto('')}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            setZoom((value) => Math.min(4, Math.max(1, value + (event.deltaY < 0 ? 0.25 : -0.25))));
          }}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))}>
              −
            </button>
            <span>{Math.round(zoom * 100)} %</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.5))}>
              +
            </button>
            <button type="button" onClick={() => setViewPhoto('')} aria-label={uiText['fermer']}>
              ×
            </button>
          </div>
          <img
            src={viewPhoto}
            alt={uiText['justificatif']}
            style={{ transform: `scale(${zoom})` }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
