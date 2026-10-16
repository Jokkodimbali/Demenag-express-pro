import { messages } from '../../content/fr';
import type { Catalogue } from '../../domain/model';
export function ContactSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div className="panel">
      <h2>{messages.identiteEtFacturation}</h2>
      <label htmlFor="business-phone">{messages.telephoneDeLEntrepriseFormat221}</label>
      <input
        id="business-phone"
        name="phone"
        type="tel"
        required
        pattern="\+221[0-9]{9}"
        defaultValue={catalogue.settings.businessPhone}
      />
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
