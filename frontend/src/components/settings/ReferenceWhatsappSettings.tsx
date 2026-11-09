import { uiText } from '../../content/reference-ui-text';
import { useState } from 'react';
import type { Catalogue } from '../../domain/model';
import { whatsappUrl } from '../../application/services/whatsapp';
import {
  defaultFinalQuoteTemplate,
  defaultLegacyFinalQuoteTemplate,
  defaultProvisionalQuoteTemplate,
  renderQuoteTemplate,
  whatsappPaymentLine,
} from '../../application/services/whatsapp-templates';
import { visibleUiText } from '../../content/visible-ui-text';
import { sanitizePhoneInput } from '../../domain/phone-number';
const modes = [
  ['api', 'WhatsApp (application mobile / Web, recommandé)'],
  ['wame', 'wa.me (lien universel)'],
  ['web', 'WhatsApp Web (ordinateur)'],
  ['app', 'Application WhatsApp (téléphone)'],
] as const;

function localNumber(value: string, countryCode: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  const country = countryCode.replace(/\D/g, '');
  return country && digits.startsWith(country) ? digits.slice(country.length) : digits;
}

export function ReferenceWhatsappSettings({ catalogue }: { catalogue: Catalogue }) {
  const [contactFirst, setContactFirst] = useState(
    catalogue.settings.contactFirstTemplate ?? '{ref} {prenom}',
  );
  const [contactLast, setContactLast] = useState(
    catalogue.settings.contactLastTemplate ?? '{nom} · {date}',
  );
  const [countryCode, setCountryCode] = useState(catalogue.settings.whatsappCountryCode ?? '221');
  const [businessNumber, setBusinessNumber] = useState(() =>
    localNumber(
      catalogue.settings.whatsappPhone || catalogue.settings.businessPhone,
      catalogue.settings.whatsappCountryCode ?? '221',
    ),
  );
  const [mode, setMode] = useState(catalogue.settings.whatsappMode ?? 'api');
  const [provisionalTemplate, setProvisionalTemplate] = useState(
    catalogue.settings.whatsappProvisionalTemplate || defaultProvisionalQuoteTemplate,
  );
  const [finalTemplate, setFinalTemplate] = useState(
    !catalogue.settings.whatsappQuoteTemplate ||
      catalogue.settings.whatsappQuoteTemplate === defaultLegacyFinalQuoteTemplate
      ? defaultFinalQuoteTemplate
      : catalogue.settings.whatsappQuoteTemplate,
  );
  const previewValues: Record<string, string> = {
    nom: 'Awa Ndiaye',
    ref: 'DE-2026-0108',
    num: 'DV-2026-0108',
    total: '125 000 FCFA (+ péages à votre charge : 2 000 FCFA)',
    peages: 'Péage · Rufisque : 2 × 1 000 FCFA\nTotal péages : 2 000 FCFA',
    paiement: whatsappPaymentLine(catalogue.settings),
    allers: '3',
    voyages: '3 allers-retours',
    vehicule: 'Renault Master',
    date: '18/10/2026',
    heure: ' à 08h00',
    trajet: 'Ouakam → Almadies',
  };
  const provisionalPreview = renderQuoteTemplate(provisionalTemplate, previewValues, {
    tollText: previewValues.peages,
    paymentLine: previewValues.paiement,
  });
  const finalPreview = renderQuoteTemplate(finalTemplate, previewValues, {
    tollText: previewValues.peages,
    paymentLine: previewValues.paiement,
  });
  const testUrl = whatsappUrl(businessNumber, 'Test Demenag Express', {
    whatsappCountryCode: countryCode,
    whatsappMode: mode,
  });
  const openedWith =
    mode === 'web' ? 'WhatsApp Web' : mode === 'app' ? 'le lien universel WhatsApp' : 'wa.me';

  return (
    <section className="reference-settings-wide reference-settings-whatsapp">
      <span className="reference-settings-card-title">{uiText['whatsapp']}</span>
      <div className="reference-settings-whatsapp-grid">
        <label>
          <span>{uiText['indicatifPAYS']}</span>
          <input
            name="w.cc"
            inputMode="numeric"
            pattern="[1-9][0-9]{0,3}"
            maxLength={4}
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value.replace(/\D/g, ''))}
            placeholder={uiText['221']}
            required
          />
        </label>
        <label>
          <span>{uiText['numeroWHATSAPPDELENTREPRISE']}</span>
          <input
            name="w.biz"
            type="tel"
            maxLength={30}
            value={businessNumber}
            onChange={(event) => setBusinessNumber(sanitizePhoneInput(event.target.value))}
            placeholder={visibleUiText.text179}
            required
          />
        </label>
        <div className="reference-settings-contact-format">
          <div className="reference-settings-section-heading">
            <strong>{visibleUiText.text188}</strong>
            <button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.form;
                setContactFirst('{ref} {prenom}');
                setContactLast('{nom} · {date}');
                window.setTimeout(() => form?.requestSubmit(), 0);
              }}
            >
              {visibleUiText.text189}
            </button>
          </div>
          <div className="reference-settings-contact-fields">
            <label>
              <span>{visibleUiText.text190}</span>
              <input
                name="contactFirstTemplate"
                maxLength={200}
                value={contactFirst}
                onChange={(event) => setContactFirst(event.target.value)}
              />
            </label>
            <label>
              <span>{visibleUiText.text186}</span>
              <input
                name="contactLastTemplate"
                maxLength={200}
                value={contactLast}
                onChange={(event) => setContactLast(event.target.value)}
              />
            </label>
          </div>
          <small>
            {visibleUiText.text191}
            {'{ref}'} {'{prenom}'} {'{nom}'} {'{client}'} {'{date}'} {'{vehicule}'} {'{quartier}'}
          </small>
          <span>
            {visibleUiText.text192}{' '}
            <strong>
              {contactFirst.replace('{ref}', 'DEM-4861').replace('{prenom}', 'Moussa')}{' '}
              {contactLast.replace('{nom}', 'Diop').replace('{date}', '06/11')}
            </strong>
          </span>
        </div>
        <label>
          <span>{uiText['ouvrirAVEC']}</span>
          <select
            name="w.mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            {modes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="reference-settings-whatsapp-template">
        <span>{visibleUiText.text66}</span>
        <textarea
          name="w.tplP"
          rows={4}
          maxLength={1000}
          value={provisionalTemplate}
          onChange={(event) => setProvisionalTemplate(event.target.value)}
          required
        />
      </label>
      <div className="reference-settings-whatsapp-preview" aria-live="polite">
        {provisionalPreview}
      </div>
      <label className="reference-settings-whatsapp-template">
        <span>{uiText['messageDUDEVISFINAL']}</span>
        <textarea
          name="w.tpl"
          rows={4}
          maxLength={1000}
          value={finalTemplate}
          onChange={(event) => setFinalTemplate(event.target.value)}
          required
        />
      </label>
      <span className="reference-settings-whatsapp-hint">
        {uiText['variables']}
        {'{nom}'} {'{ref}'} {'{num}'} {'{total}'} {'{peages}'} {'{paiement}'} {'{allers}'}{' '}
        {'{voyages}'} {'{vehicule}'} {'{date}'} {'{heure}'} {'{trajet}'}
      </span>
      <div className="reference-settings-whatsapp-preview" aria-live="polite">
        {finalPreview}
      </div>
      <div className="reference-settings-whatsapp-test">
        <a href={testUrl} target="_blank" rel="noopener noreferrer">
          {uiText['testerSurLeNumeroDeLEntreprise']}
        </a>
        <span>
          {uiText['ouvre']}
          {countryCode.replace(/\D/g, '')}
          {businessNumber.replace(/\D/g, '').replace(/^0+/, '')} · {openedWith}
        </span>
      </div>
      <span className="reference-settings-whatsapp-hint">
        {uiText['siWhatsAppNeSOuvrePasEssayezWhatsAppWebSurOrdinateurOu']}
      </span>
    </section>
  );
}
