import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uiText } from '../../../shared/content/reference-ui-text';
import { visibleUiText } from '../../../shared/content/visible-ui-text';
import { useApp } from '../../../shared/application/context';
import { normalizedClientPhone } from '../../../shared/domain/client-identity';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
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
import { adminQuoteValidationToastKeys } from '../application/services/admin-quote-form-policy';

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
  onValidationCorrected,
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
  onValidationCorrected: (toastKey: string) => void;
}) {
  const { showSuccessToast, showErrorToast } = useApp();
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
    if (profile.name.trim().length >= 2)
      onValidationCorrected(adminQuoteValidationToastKeys.clientName);
    if (normalizePhoneNumber(profile.phone))
      onValidationCorrected(adminQuoteValidationToastKeys.clientPhone);
  }

  async function copyNamePart(value: string, label: string) {
    if (await copyContactText(value)) {
      setContactFeedback(`${label} copié : ${value}`);
      showSuccessToast(`${label} copié dans le presse-papiers.`);
      return;
    }
    setContactFeedback(`${label} : ${value}`);
    showErrorToast(
      'La copie automatique est indisponible. Le texte reste affiché pour être copié.',
    );
  }

  async function saveContact() {
    if (!contactCard) return;
    const filename = `${contactCard.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}.vcf`;
    try {
      const result = await saveContactVcards([contactCard.vcard], filename, contactCard.name);
      setContactFeedback(
        result === 'downloaded'
          ? `Contact « ${contactCard.name} » ${quoteText.contactReadyToImport}`
          : '',
      );
      if (result !== 'cancelled') showSuccessToast(`Contact « ${contactCard.name} » exporté.`);
    } catch {
      showErrorToast('Le contact n’a pas pu être exporté.');
    }
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
                maxLength={100}
                aria-required="true"
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
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({ ...current, customerName: name }));
                  if (name.trim().length >= 2)
                    onValidationCorrected(adminQuoteValidationToastKeys.clientName);
                }}
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
                type="tel"
                inputMode="tel"
                maxLength={25}
                aria-required="true"
                value={draft.customerPhone}
                onChange={(event) => {
                  const phone = sanitizePhoneInput(event.target.value);
                  const profile = savedClientForPhone(clientProfiles, phone);
                  setDraft((current) => ({
                    ...current,
                    customerPhone: phone,
                    ...(profile ? { customerName: profile.name } : {}),
                  }));
                  if (normalizePhoneNumber(phone))
                    onValidationCorrected(adminQuoteValidationToastKeys.clientPhone);
                  if (profile?.name.trim() && profile.name.trim().length >= 2)
                    onValidationCorrected(adminQuoteValidationToastKeys.clientName);
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
                  onChange={(event) => {
                    const date = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      date,
                      month: date ? date.slice(0, 7) : current.month,
                    }));
                  }}
                />
              )}
              {draft.noDate && administrativeQuote && (
                <input
                  type="month"
                  value={draft.month}
                  aria-label={uiText['moisSouhaite']}
                  aria-required="true"
                  onChange={(event) => {
                    const month = event.target.value;
                    setDraft((current) => ({ ...current, month }));
                    if (month) onValidationCorrected(adminQuoteValidationToastKeys.dateMonth);
                  }}
                />
              )}
              {administrativeQuote && (
                <label className="admin-quote-no-date">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.noDate)}
                    onChange={(event) => {
                      const noDate = event.target.checked;
                      setDraft((current) => ({
                        ...current,
                        noDate,
                        date: noDate ? '' : current.date,
                        timeSlot: noDate ? '' : current.timeSlot,
                      }));
                      if (noDate) onValidationCorrected(adminQuoteValidationToastKeys.startTime);
                      else onValidationCorrected(adminQuoteValidationToastKeys.dateMonth);
                    }}
                  />
                  <span>{uiText['dateADefinirMoisSeulement']}</span>
                </label>
              )}
            </div>
            <label className="admin-quote-start-time">
              <span>{uiText['debut']}</span>
              <input
                type="time"
                value={draft.timeSlot}
                aria-required={Boolean(draft.date)}
                onChange={(event) => {
                  const timeSlot = event.target.value;
                  setDraft((current) => ({ ...current, timeSlot }));
                  if (timeSlot) onValidationCorrected(adminQuoteValidationToastKeys.startTime);
                }}
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
