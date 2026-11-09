import { ChevronDown } from 'lucide-react';
import { uiText } from '../content/reference-ui-text';
import type { Draft } from '../application/booking-draft';

type ClientRecognition = { phone: string; name: string; bookingCount: number } | null;

export function AdminQuoteClientIdentity({
  draft,
  setDraft,
  expanded,
  onToggle,
  editingReference,
  publicRequest,
  clientRecognition,
  recognizingClient,
  onContinue,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  expanded: boolean;
  onToggle: () => void;
  editingReference?: string;
  publicRequest: boolean;
  clientRecognition: ClientRecognition;
  recognizingClient: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="admin-quote-card">
      <button
        className="admin-quote-section-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="admin-quote-client-fields"
        onClick={onToggle}
      >
        <ChevronDown size={16} aria-hidden="true" />
        <span>
          {editingReference
            ? `DEVIS POUR ${editingReference}`
            : publicRequest
              ? 'VOS INFORMATIONS'
              : 'NOUVEAU DEVIS · CLIENT EN AGENCE'}
        </span>
      </button>
      {expanded && (
        <div id="admin-quote-client-fields" className="admin-quote-identity">
          <label className="admin-quote-client-name">
            <span>{uiText['nomDuClient']}</span>
            <input
              required
              maxLength={100}
              value={draft.customerName}
              onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
              placeholder={uiText['nomDuClient']}
              aria-label={uiText['nomDuClient']}
            />
          </label>
          <label>
            <span>{uiText['telephone']}</span>
            <input
              required
              value={draft.customerPhone}
              onChange={(event) => setDraft((current) => ({ ...current, customerPhone: event.target.value }))}
              placeholder={uiText['telephone']}
              aria-label={uiText['telephone']}
            />
          </label>
          {recognizingClient && <p className="muted" role="status">{uiText['verificationDuClient']}</p>}
          {clientRecognition && clientRecognition.phone && (
            <p className="client-recognition">
              {uiText['clientDejaConnu']}{clientRecognition.name} · {clientRecognition.bookingCount} {uiText['reservationS']}
            </p>
          )}
          <button type="button" className="button secondary" onClick={onContinue}>Continuer</button>
        </div>
      )}
    </section>
  );
}
