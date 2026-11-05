import { uiText } from '../content/reference-ui-text';
import { useSettings } from '../application/controllers/useSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
import { messages } from '../content/fr';
import { RentalKitSettings } from '../components/settings/RentalKitSettings';
export function Settings() {
  const { catalogue, busy, error, saved, submit, onChange, onBlur } = useSettings();
  if (!catalogue) return null;
  return (
    <form onSubmit={submit} onChange={onChange} onBlur={onBlur} className="settings-form">
      <TransportSettings catalogue={catalogue} />
      <RentalKitSettings catalogue={catalogue} />
      <section className="reference-settings-page reference-invoice-settings">
        <div className="reference-settings-grid">
          <section className="reference-settings-wide reference-settings-card">
            <span className="reference-settings-card-title">Entreprise et documents de devis</span>
            <div className="reference-invoice-fields">
              <label>
                <span>E-mail</span>
                <input
                  name="businessEmail"
                  type="email"
                  defaultValue={catalogue.settings.businessEmail ?? ''}
                  placeholder="contact@…"
                />
              </label>
              <label>
                <span>NINEA</span>
                <input
                  name="businessNinea"
                  defaultValue={catalogue.settings.businessNinea ?? ''}
                  placeholder="N° NINEA"
                />
              </label>
              <label>
                <span>RCCM</span>
                <input
                  name="businessRccm"
                  defaultValue={catalogue.settings.businessRccm ?? ''}
                  placeholder="SN-DKR-…"
                />
              </label>
              <label>
                <span>Validité du devis provisoire (jours)</span>
                <input
                  name="quoteValidityDays"
                  type="number"
                  min="0"
                  max="365"
                  defaultValue={catalogue.settings.quoteValidityDays ?? 15}
                />
              </label>
              <label>
                <span>Acompte à la réservation (%)</span>
                <input
                  name="bookingDepositPercent"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={catalogue.settings.bookingDepositPercent ?? 0}
                />
              </label>
              <label>
                <span>Location avec chauffeur · dépassement par heure (FCFA)</span>
                <input
                  name="rentalOvertimeHourlyRate"
                  type="number"
                  min="0"
                  defaultValue={catalogue.settings.rentalOvertimeHourlyRate ?? 10000}
                />
              </label>
              <label className="reference-invoice-terms">
                <span>Conditions générales du devis</span>
                <textarea
                  name="quoteTerms"
                  rows={8}
                  defaultValue={catalogue.settings.quoteTerms ?? ''}
                  placeholder="Conditions applicables aux devis…"
                />
              </label>
            </div>
          </section>
        </div>
      </section>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="sr-only">
          {messages.parametresEnregistres}
        </p>
      )}
      {busy && (
        <p role="status" className="sr-only">
          {uiText['modificationsEnregistreesAutomatiquement']}
        </p>
      )}
    </form>
  );
}
