import type { Catalogue } from '../../domain/model';
import { referenceSettingsText as text } from '../../content/reference-settings-text';
import { sanitizePhoneInput } from '../../domain/phone-number';

export function CompanyQuoteSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <section className="reference-settings-wide reference-settings-card">
      <span className="reference-settings-card-title">{text.companyTitle}</span>
      <span className="reference-settings-description">{text.companyDescription}</span>
      <div className="reference-company-fields">
        <label>
          <span>{text.address}</span>
          <input
            name="businessAddress"
            defaultValue={catalogue.settings.businessAddress}
            placeholder={text.addressPlaceholder}
          />
        </label>
        <label>
          <span>{text.phone}</span>
          <input
            name="businessPhone"
            type="tel"
            inputMode="tel"
            maxLength={30}
            defaultValue={catalogue.settings.businessPhone}
            placeholder="+221 77 510 51 04 ou +33 6 12 34 56 78"
            onChange={(event) => {
              event.currentTarget.value = sanitizePhoneInput(event.currentTarget.value);
            }}
          />
        </label>
        <label>
          <span>{text.email}</span>
          <input
            name="businessEmail"
            type="text"
            defaultValue={catalogue.settings.businessEmail ?? ''}
            placeholder={text.emailPlaceholder}
          />
        </label>
        <label>
          <span>{text.ninea}</span>
          <input
            name="businessNinea"
            defaultValue={catalogue.settings.businessNinea ?? ''}
            placeholder={text.nineaPlaceholder}
          />
        </label>
        <label>
          <span>{text.rccm}</span>
          <input
            name="businessRccm"
            defaultValue={catalogue.settings.businessRccm ?? ''}
            placeholder={text.rccmPlaceholder}
          />
        </label>
        <label>
          <span>{text.quoteValidity}</span>
          <input
            name="quoteValidityDays"
            type="number"
            min="0"
            max="365"
            defaultValue={catalogue.settings.quoteValidityDays ?? 15}
          />
        </label>
        <label>
          <span>{text.bookingDeposit}</span>
          <input
            name="bookingDepositPercent"
            type="number"
            min="0"
            max="100"
            defaultValue={catalogue.settings.bookingDepositPercent ?? 0}
          />
        </label>
      </div>
    </section>
  );
}
