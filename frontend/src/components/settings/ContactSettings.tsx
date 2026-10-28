import { messages } from '../../content/fr';
import type { Catalogue } from '../../domain/model';
export function ContactSettings({ catalogue }: { catalogue: Catalogue }) {
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
