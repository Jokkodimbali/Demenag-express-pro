import { useState } from 'react';
import { messages } from '../../content/fr';
import type { Catalogue } from '../../domain/model';
import { whatsappUrl } from '../../application/services/whatsapp';
export function ContactSettings({ catalogue }: { catalogue: Catalogue }) {
  const [whatsappPhone, setWhatsappPhone] = useState(
    catalogue.settings.whatsappPhone || catalogue.settings.businessPhone,
  );
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(
    catalogue.settings.whatsappCountryCode ?? '221',
  );
  const [whatsappMode, setWhatsappMode] = useState(catalogue.settings.whatsappMode ?? 'api');
  const [whatsappQuoteTemplate, setWhatsappQuoteTemplate] = useState(
    catalogue.settings.whatsappQuoteTemplate ??
      'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !',
  );
  const previewText = whatsappQuoteTemplate.replace(
    /\{(nom|ref|num|total|allers|vehicule|date|trajet)\}/g,
    (token) =>
      ({
        '{nom}': 'Awa Ndiaye',
        '{ref}': 'DE-2026-001',
        '{num}': 'DEV-2026-001',
        '{total}': '125 000 F CFA',
        '{allers}': '2',
        '{vehicule}': 'Renault Master',
        '{date}': '26/10/2026',
        '{trajet}': 'Plateau → Almadies',
      })[token] ?? token,
  );
  const previewUrl = whatsappUrl(whatsappPhone, previewText, {
    whatsappCountryCode,
    whatsappMode,
  });
  return (
    <div className="panel">
      <h2>{messages.identiteEtFacturation}</h2>
      <label htmlFor="business-phone">{messages.numeroWhatsappEntreprise}</label>
      <input
        id="business-phone"
        name="phone"
        type="tel"
        required
        pattern="\+221[0-9]{9}"
        defaultValue={catalogue.settings.businessPhone}
      />
      <p className="muted">{messages.numeroWhatsappEntrepriseAide}</p>
      <label htmlFor="whatsapp-phone">Numéro WhatsApp utilisé par l’application</label>
      <input
        id="whatsapp-phone"
        name="whatsappPhone"
        type="tel"
        required
        pattern="\+[1-9][0-9]{7,14}"
        title="Saisissez le numéro au format international, par exemple +221771234567."
        value={whatsappPhone}
        onChange={(event) => setWhatsappPhone(event.target.value)}
      />
      <p className="muted">
        Les boutons WhatsApp de contact de l’application ouvriront ce numéro. Saisissez le code pays
        et le numéro sans espace. Pour un message de devis adressé au client, WhatsApp utilise le
        compte connecté sur l’appareil.
      </p>
      <div className="field-pair">
        <div>
          <label htmlFor="whatsapp-country-code">Indicatif pays WhatsApp</label>
          <input
            id="whatsapp-country-code"
            name="whatsappCountryCode"
            inputMode="numeric"
            pattern="[1-9][0-9]{0,3}"
            value={whatsappCountryCode}
            onChange={(event) => setWhatsappCountryCode(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="whatsapp-mode">Ouvrir WhatsApp avec</label>
          <select
            id="whatsapp-mode"
            name="whatsappMode"
            value={whatsappMode}
            onChange={(event) => setWhatsappMode(event.target.value as typeof whatsappMode)}
          >
            <option value="api">api.whatsapp.com (recommandé)</option>
            <option value="wame">wa.me</option>
            <option value="web">WhatsApp Web (ordinateur)</option>
            <option value="app">Application WhatsApp (téléphone)</option>
          </select>
        </div>
      </div>
      <label htmlFor="whatsapp-quote-template">Message du devis final</label>
      <textarea
        id="whatsapp-quote-template"
        name="whatsappQuoteTemplate"
        rows={4}
        maxLength={1000}
        value={whatsappQuoteTemplate}
        onChange={(event) => setWhatsappQuoteTemplate(event.target.value)}
      />
      <p className="muted">
        Variables disponibles : {'{nom}'} {'{ref}'} {'{num}'} {'{total}'} {'{allers}'}{' '}
        {'{vehicule}'} {'{date}'} {'{trajet}'}.
      </p>
      <div className="whatsapp-template-preview" aria-live="polite">
        {previewText}
      </div>
      <div className="field-pair whatsapp-test">
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="button">
          Tester sur le numéro de l’entreprise
        </a>
        <span className="muted">
          Ouvre : {whatsappPhone || 'aucun numéro'} ·{' '}
          {whatsappMode === 'web'
            ? 'WhatsApp Web'
            : whatsappMode === 'app'
              ? 'Application WhatsApp'
              : whatsappMode === 'wame'
                ? 'wa.me'
                : 'api.whatsapp.com'}
        </span>
      </div>
      <h3>{messages.reseauxSociaux}</h3>
      <div className="social-settings">
        <div>
          <label htmlFor="business-tiktok">{messages.compteTikTok}</label>
          <input
            id="business-tiktok"
            name="tiktokUrl"
            type="url"
            placeholder="https://www.tiktok.com/@votrecompte"
            defaultValue={catalogue.settings.tiktokUrl ?? ''}
          />
        </div>
        <div>
          <label htmlFor="business-facebook">{messages.compteFacebook}</label>
          <input
            id="business-facebook"
            name="facebookUrl"
            type="url"
            placeholder="https://www.facebook.com/votrepage"
            defaultValue={catalogue.settings.facebookUrl ?? ''}
          />
        </div>
        <div>
          <label htmlFor="business-instagram">{messages.compteInstagram}</label>
          <input
            id="business-instagram"
            name="instagramUrl"
            type="url"
            placeholder="https://www.instagram.com/votrecompte"
            defaultValue={catalogue.settings.instagramUrl ?? ''}
          />
        </div>
      </div>
      <div className="field-pair">
        <div>
          <label htmlFor="business-name">{messages.nomDeLEntreprise}</label>
          <input
            id="business-name"
            name="businessName"
            defaultValue={catalogue.settings.businessName}
            required
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="business-address">{messages.adresseDeLEntreprise}</label>
          <input
            id="business-address"
            name="businessAddress"
            defaultValue={catalogue.settings.businessAddress}
            required
            maxLength={300}
          />
        </div>
      </div>
      <label htmlFor="invoice-footer">{messages.piedDeFacture}</label>
      <textarea
        id="invoice-footer"
        name="invoiceFooter"
        defaultValue={catalogue.settings.invoiceFooter}
        maxLength={500}
        required
      />
      <label htmlFor="invoice-logo">{messages.logoDeFacture}</label>
      <input
        id="invoice-logo"
        name="invoiceLogo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
      />
      {catalogue.settings.invoiceLogo && (
        <img
          className="invoice-asset-preview"
          src={catalogue.settings.invoiceLogo}
          alt="Aperçu du logo de facture"
        />
      )}
      <label htmlFor="invoice-stamp">Tampon de l’entreprise</label>
      <input
        id="invoice-stamp"
        name="invoiceStamp"
        type="file"
        accept="image/png,image/jpeg,image/webp"
      />
      {catalogue.settings.invoiceStamp && (
        <img
          className="invoice-asset-preview invoice-stamp-preview"
          src={catalogue.settings.invoiceStamp}
          alt="Aperçu du tampon"
        />
      )}
      <label htmlFor="invoice-signature">Signature</label>
      <input
        id="invoice-signature"
        name="invoiceSignature"
        type="file"
        accept="image/png,image/jpeg,image/webp"
      />
      {catalogue.settings.invoiceSignature && (
        <img
          className="invoice-asset-preview invoice-signature-preview"
          src={catalogue.settings.invoiceSignature}
          alt="Aperçu de la signature"
        />
      )}
      <p className="muted">
        Le tampon et la signature seront automatiquement adaptés à la facture et au devis PDF.
      </p>
    </div>
  );
}
