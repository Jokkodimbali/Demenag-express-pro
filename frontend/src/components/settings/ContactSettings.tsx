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
      <label htmlFor="whatsapp-phone">Numéro WhatsApp utilisé par l’application</label>
      <input
        id="whatsapp-phone"
        name="whatsappPhone"
        type="tel"
        required
        pattern="\+[1-9][0-9]{7,14}"
        title="Saisissez le numéro au format international, par exemple +221771234567."
        defaultValue={catalogue.settings.whatsappPhone || catalogue.settings.businessPhone}
      />
      <p className="muted">Les boutons WhatsApp de contact de l’application ouvriront ce numéro. Saisissez le code pays et le numéro sans espace. Pour un message de devis adressé au client, WhatsApp utilise le compte connecté sur l’appareil.</p>
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
    </div>
  );
}
