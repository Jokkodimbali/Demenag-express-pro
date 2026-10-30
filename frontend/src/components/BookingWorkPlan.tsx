import { uiText } from '../content/reference-ui-text';
import { Check, Clock3, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../application/error-message';
import { useBookingCommands } from '../application/controllers/useBookingCommands';
import type { Booking, WorkPlanCompliance, WorkPlanReview, WorkPlanStep } from '../domain/model';

type ReviewDraft = { status: WorkPlanCompliance; reason: string };

function reviewLabel(review: WorkPlanReview): string {
  if (review.status === 'respected') return 'Respecté';
  if (review.status === 'late') return 'En retard';
  if (review.status === 'not_respected') return 'Non respecté';
  return 'À vérifier';
}

function reviewTone(status: WorkPlanCompliance): string {
  return status === 'respected'
    ? 'success'
    : status === 'late'
      ? 'warning'
      : status === 'not_respected'
        ? 'danger'
        : 'pending';
}

function reviewTime(review: WorkPlanReview): string {
  if (!review.checkedAt) return '';
  const time = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(review.checkedAt));
  return review.checkedBy ? `${review.checkedBy} · ${time}` : time;
}

function CurrentReview({ review }: { review: WorkPlanReview }) {
  return (
    <div className="booking-plan-current-review">
      <strong className={`booking-plan-status ${reviewTone(review.status)}`}>
        {reviewLabel(review)}
      </strong>
      {review.reason && <span>{review.reason}</span>}
      {reviewTime(review) && <small>{reviewTime(review)}</small>}
    </div>
  );
}

function PlanStep({
  step,
  booking,
  admin,
  driverMode,
  onChange,
}: {
  step: WorkPlanStep;
  booking: Booking;
  admin: boolean;
  driverMode: boolean;
  onChange: (booking: Booking) => void;
}) {
  const commands = useBookingCommands();
  const editable = admin || driverMode;
  const [draft, setDraft] = useState<ReviewDraft>({
    status: step.review.status,
    reason: step.review.reason,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({ status: step.review.status, reason: step.review.reason });
  }, [step.review.status, step.review.reason, booking.version]);

  async function saveReview() {
    if (!editable || busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(
        await commands.reviewWorkPlan(
          booking.id,
          step.id,
          draft.status,
          draft.reason,
          booking.version,
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const duration =
    step.minutes < 60
      ? `${step.minutes} min`
      : `${Math.floor(step.minutes / 60)} h${step.minutes % 60 ? ` ${step.minutes % 60} min` : ''}`;

  return (
    <article className="booking-plan-step">
      <div className="booking-plan-step-time">
        <strong>{step.time}</strong>
        <small>
          <Clock3 size={13} /> {duration}
        </small>
      </div>
      <div className="booking-plan-step-main">
        <h4>{step.title}</h4>
        <p>{step.detail}</p>
        {editable ? (
          <div className="booking-plan-review-form">
            <div role="group" aria-label={`Respect de l’horaire ${step.title}`}>
              <button
                type="button"
                className={draft.status === 'late' ? 'selected warning' : ''}
                aria-pressed={draft.status === 'late'}
                onClick={() => setDraft((current) => ({ ...current, status: 'late' }))}
              >
                <Clock3 size={15} /> {uiText['enRetard']}
              </button>
              <button
                type="button"
                className={draft.status === 'respected' ? 'selected success' : ''}
                aria-pressed={draft.status === 'respected'}
                onClick={() => setDraft({ status: 'respected', reason: '' })}
              >
                <Check size={15} /> {uiText['respecte']}
              </button>
              <button
                type="button"
                className={draft.status === 'not_respected' ? 'selected warning' : ''}
                aria-pressed={draft.status === 'not_respected'}
                onClick={() => setDraft((current) => ({ ...current, status: 'not_respected' }))}
              >
                <TriangleAlert size={15} /> {uiText['nonRespecte']}
              </button>
            </div>
            {(draft.status === 'late' || draft.status === 'not_respected') && (
              <label>
                {uiText['justificatifRaisonDeLEcart']}
                <textarea
                  maxLength={1000}
                  value={draft.reason}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder={uiText['expliquezPourquoiLHorairePrevuNAPasEteRespecte']}
                />
              </label>
            )}
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => void saveReview()}
            >
              {busy ? 'Enregistrement…' : 'Enregistrer le contrôle'}
            </button>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <p className="booking-plan-read-only">
            {uiText['leControleEtLaJustificationSontReservesALAdministratio']}
          </p>
        )}
      </div>
      <CurrentReview review={step.review} />
    </article>
  );
}

export function BookingWorkPlan({
  booking,
  admin,
  driverMode,
  onChange,
}: {
  booking: Booking;
  admin: boolean;
  driverMode: boolean;
  onChange: (booking: Booking) => void;
}) {
  const plan = booking.workPlan ?? [];
  const reviewed = plan.filter((step) => step.review.status !== 'pending').length;
  return (
    <section className="booking-work-plan" aria-label={uiText['planningPrevisionnelDeLaMission']}>
      <header>
        <div>
          <strong>{uiText['planningPREVISIONNEL']}</strong>
          <span>
            {reviewed}/{plan.length} {uiText['horairesControles']}
          </span>
        </div>
      </header>
      {plan.length ? (
        <div className="booking-work-plan-steps">
          {plan.map((step) => (
            <PlanStep
              key={step.id}
              step={step}
              booking={booking}
              admin={admin}
              driverMode={driverMode}
              onChange={onChange}
            />
          ))}
        </div>
      ) : (
        <p className="muted">{uiText['aucunPlanningNAEteEnregistreAvecCetteReservation']}</p>
      )}
    </section>
  );
}
