import { ChevronDown } from 'lucide-react';
import { uiText } from '../../../shared/content/reference-ui-text';
import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { normalizedClientPhone } from '../../../shared/domain/client-identity';
import { today } from '../../../shared/domain/date';
import { sanitizePhoneInput } from '../../../shared/domain/phone-number';
import type { Draft } from '../../../booking/application/booking-draft';

type ClientRecognition = { phone: string; name: string; bookingCount: number } | null;

export function AdminQuoteClientIdentity({
  draft,
  setDraft,
  expanded,
  onToggle,
  editingReference,
  publicRequest,
  administrativeQuote,
  editingReservation,
  clientRecognition,
  recognizingClient,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  expanded: boolean;
  onToggle: () => void;
  editingReference?: string;
  publicRequest: boolean;
  administrativeQuote: boolean;
  editingReservation: boolean;
  clientRecognition: ClientRecognition;
  recognizingClient: boolean;
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
        <div id="admin-quote-client-fields">
          <div className="admin-quote-identity">
            <div className="admin-quote-client-name">
              <input
                required
                maxLength={100}
                value={draft.customerName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, customerName: event.target.value }))
                }
                placeholder={uiText['nomDuClient']}
                aria-label={uiText['nomDuClient']}
              />
            </div>
            <div>
              <input
                required
                type="tel"
                inputMode="tel"
                maxLength={25}
                value={draft.customerPhone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    customerPhone: sanitizePhoneInput(event.target.value),
                  }))
                }
                placeholder={visibleUiText.text123}
                aria-label={uiText['telephone']}
              />
            </div>
            {!publicRequest && (
              <div className="admin-quote-source">
                <span>{uiText['commentLECLIENTNOUSACONNUS']}</span>
                <div>
                  {[
                    'Facebook',
                    'YouTube',
                    'Instagram',
                    'Snapchat',
                    'TikTok',
                    'Autre pub',
                    'Bouche-à-oreille',
                    'Client fidèle',
                    'Autre',
                  ].map((source) => {
                    const selected = draft.source === source;
                    return (
                      <button
                        type="button"
                        key={source}
                        className={selected ? 'selected' : ''}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            source: selected ? '' : source,
                          }))
                        }
                      >
                        {source}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="admin-quote-date-control">
              {!draft.noDate && (
                <input
                  type="date"
                  min={editingReservation ? undefined : today()}
                  value={draft.date}
                  aria-label={uiText['datePrevue']}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      date: event.target.value,
                      month: event.target.value ? event.target.value.slice(0, 7) : current.month,
                    }))
                  }
                />
              )}
              {draft.noDate && administrativeQuote && (
                <input
                  type="month"
                  required
                  value={draft.month}
                  aria-label={uiText['moisSouhaite']}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, month: event.target.value }))
                  }
                />
              )}
              {administrativeQuote && (
                <label className="admin-quote-no-date">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.noDate)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        noDate: event.target.checked,
                        date: event.target.checked ? '' : current.date,
                        timeSlot: event.target.checked ? '' : current.timeSlot,
                      }))
                    }
                  />
                  <span>{uiText['dateADefinirMoisSeulement']}</span>
                </label>
              )}
            </div>
            <label className="admin-quote-start-time">
              <span>{uiText['debut']}</span>
              <input
                type="time"
                required={Boolean(draft.date)}
                value={draft.timeSlot}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, timeSlot: event.target.value }))
                }
              />
            </label>
          </div>
          {recognizingClient && (
            <p className="muted" role="status">
              {uiText['verificationDuClient']}
            </p>
          )}
          {clientRecognition &&
            clientRecognition.phone === normalizedClientPhone(draft.customerPhone) && (
              <p className="client-recognition">
                {uiText['clientDejaConnu']}
                {clientRecognition.name} · {clientRecognition.bookingCount} {uiText['reservationS']}
              </p>
            )}
        </div>
      )}
    </section>
  );
}
