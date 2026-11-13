import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uiText } from '../../../shared/content/reference-ui-text';
import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { normalizedClientPhone } from '../../../shared/domain/client-identity';
import { today } from '../../../shared/domain/date';
import { sanitizePhoneInput } from '../../../shared/domain/phone-number';
import {
  copyContactText,
  saveContactVcards,
} from '../../../shared/application/services/contact-vcard-file';
import type { Draft } from '../../../booking/application/booking-draft';
import { adminQuoteVehicleText as quoteText } from '../content/admin-quote-vehicle';
import {
  clientNameSuggestions,
  clientSuggestionSelection,
  savedClientForPhone,
  type ClientSuggestionProfile,
} from '../application/services/client-suggestions';

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
  clientProfiles = [],
  contactCard,
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
  clientProfiles?: ClientSuggestionProfile[];
  contactCard: {
    first: string;
    last: string;
    name: string;
    valid: boolean;
    vcard: string;
  } | null;
}) {
  const [contactFeedback, setContactFeedback] = useState('');
  const [clientNameFocused, setClientNameFocused] = useState(false);
  const clientNameBlurTimeout = useRef<number | undefined>(undefined);
  const matchedProfile = savedClientForPhone(clientProfiles, draft.customerPhone);
  const suggestions =
    clientNameFocused && !matchedProfile
      ? clientNameSuggestions(clientProfiles, draft.customerName, draft.customerPhone)
      : [];

  useEffect(
    () => () => {
      if (clientNameBlurTimeout.current !== undefined) {
        window.clearTimeout(clientNameBlurTimeout.current);
      }
    },
    [],
  );

  function selectClient(profile: ClientSuggestionProfile) {
    if (clientNameBlurTimeout.current !== undefined) {
      window.clearTimeout(clientNameBlurTimeout.current);
    }
    setClientNameFocused(false);
    setDraft((current) => ({
      ...current,
      ...clientSuggestionSelection(profile, current.fromAddress || ''),
    }));
  }

  async function copyNamePart(value: string, label: string) {
    if (await copyContactText(value)) {
      setContactFeedback(`${label} copié : ${value}`);
      return;
    }
    setContactFeedback(`${label} : ${value}`);
  }

  async function saveContact() {
    if (!contactCard) return;
    const filename = `${contactCard.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}.vcf`;
    const result = await saveContactVcards([contactCard.vcard], filename, contactCard.name);
    setContactFeedback(
      result === 'downloaded'
        ? `Contact « ${contactCard.name} » ${quoteText.contactReadyToImport}`
        : '',
    );
  }

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
                autoComplete="off"
                readOnly={Boolean(matchedProfile)}
                title={matchedProfile ? quoteText.savedClientNameTitle : undefined}
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls={suggestions.length ? 'admin-quote-client-suggestions' : undefined}
                value={draft.customerName}
                onFocus={() => {
                  if (clientNameBlurTimeout.current !== undefined) {
                    window.clearTimeout(clientNameBlurTimeout.current);
                  }
                  setClientNameFocused(true);
                }}
                onBlur={() => {
                  clientNameBlurTimeout.current = window.setTimeout(
                    () => setClientNameFocused(false),
                    150,
                  );
                }}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, customerName: event.target.value }))
                }
                placeholder={uiText['nomDuClient']}
                aria-label={uiText['nomDuClient']}
              />
              {matchedProfile && (
                <span className="admin-quote-saved-client-hint">
                  {quoteText.savedClientNameHint}
                </span>
              )}
              {suggestions.length > 0 && (
                <div
                  className="admin-quote-client-suggestions"
                  id="admin-quote-client-suggestions"
                  role="listbox"
                  aria-label={quoteText.savedClientsSuggestions}
                >
                  {suggestions.map((profile) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={`${profile.phone}-${profile.name}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectClient(profile)}
                    >
                      <span>{profile.name}</span>
                      <span>{profile.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <input
                required
                type="tel"
                inputMode="tel"
                maxLength={25}
                value={draft.customerPhone}
                onChange={(event) => {
                  const phone = sanitizePhoneInput(event.target.value);
                  const profile = savedClientForPhone(clientProfiles, phone);
                  setDraft((current) => ({
                    ...current,
                    customerPhone: phone,
                    ...(profile ? { customerName: profile.name } : {}),
                  }));
                }}
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
          {!publicRequest && contactCard && (
            <section className="admin-quote-phone-contact">
              <div className="admin-quote-phone-contact-heading">
                <span>{quoteText.contactInPhone}</span>
                <span>{draft.customerPhone}</span>
              </div>
              <div className="admin-quote-phone-contact-names">
                {[
                  { label: quoteText.firstName, value: contactCard.first },
                  { label: quoteText.lastName, value: contactCard.last },
                ].map(({ label, value }) => (
                  <div className="admin-quote-phone-contact-name" key={label}>
                    <div>
                      <span>{label}</span>
                      <strong>{value || '—'}</strong>
                    </div>
                    <button
                      type="button"
                      disabled={!value}
                      onClick={() => void copyNamePart(value, label)}
                    >
                      {quoteText.copy}
                    </button>
                  </div>
                ))}
              </div>
              <div className="admin-quote-phone-contact-actions">
                <button type="button" onClick={() => void saveContact()}>
                  {quoteText.saveContact}
                </button>
                <span>{quoteText.contactSaveNote}</span>
              </div>
              {contactFeedback && (
                <span className="admin-quote-phone-contact-feedback" role="status">
                  {contactFeedback}
                </span>
              )}
            </section>
          )}
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
