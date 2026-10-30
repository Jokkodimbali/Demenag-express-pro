import { uiText } from '../../content/reference-ui-text';
import { useState } from 'react';
import type { Catalogue } from '../../domain/model';
import { whatsappUrl } from '../../application/services/whatsapp';

const defaultTemplate =
  'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !';
const modes = [
  ['api', 'api.whatsapp.com (recommandé)'],
  ['wame', 'wa.me'],
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
  const [countryCode, setCountryCode] = useState(catalogue.settings.whatsappCountryCode ?? '221');
  const [businessNumber, setBusinessNumber] = useState(() =>
    localNumber(
      catalogue.settings.whatsappPhone || catalogue.settings.businessPhone,
      catalogue.settings.whatsappCountryCode ?? '221',
    ),
  );
  const [mode, setMode] = useState(catalogue.settings.whatsappMode ?? 'api');
  const [template, setTemplate] = useState(
    catalogue.settings.whatsappQuoteTemplate || defaultTemplate,
  );
  const previewValues: Record<string, string> = {
    nom: 'Awa Ndiaye',
    ref: 'DE-2026-0108',
    num: 'DV-2026-0108',
    total: '125 000 FCFA (+ péages à votre charge : 2 000 FCFA)',
    peages: 'Péage · Rufisque : 2 × 1 000 FCFA\nTotal péages : 2 000 FCFA',
    allers: '3',
    vehicule: 'Renault Master',
    date: '18/10/2026',
    trajet: 'Ouakam → Almadies',
  };
  let preview = template.replace(/\{(\w+)\}/g, (token, key: string) => previewValues[key] ?? token);
  if (previewValues.peages && !template.includes('{peages}'))
    preview += `\n\nPéages à votre charge (non inclus) :\n${previewValues.peages}`;
  const testUrl = whatsappUrl(businessNumber, 'Test Demenag Express', {
    whatsappCountryCode: countryCode,
    whatsappMode: mode,
  });
  const openedWith =
    modes.find(([value]) => value === mode)?.[1].replace(/ \(.*$/, '') ?? 'api.whatsapp.com';

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
            onChange={(event) => setCountryCode(event.target.value)}
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
            onChange={(event) => setBusinessNumber(event.target.value)}
            placeholder={uiText['775105104']}
            required
          />
        </label>
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
        <span>{uiText['messageDUDEVISFINAL']}</span>
        <textarea
          name="w.tpl"
          rows={4}
          maxLength={1000}
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          required
        />
      </label>
      <span className="reference-settings-whatsapp-hint">
        {uiText['variables']}
        {'{nom}'} {'{ref}'} {'{num}'} {'{total}'} {'{peages}'} {'{allers}'} {'{vehicule}'}{' '}
        {'{date}'} {'{trajet}'}
      </span>
      <div className="reference-settings-whatsapp-preview" aria-live="polite">
        {preview}
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
