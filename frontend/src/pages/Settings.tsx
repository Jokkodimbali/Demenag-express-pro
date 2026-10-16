import { Save } from 'lucide-react';
import { useSettings } from '../application/controllers/useSettings';
import { BookingRulesSettings } from '../components/settings/BookingRulesSettings';
import { ContactSettings } from '../components/settings/ContactSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
import { messages } from '../content/fr';
export type SettingsSection = 'pricing' | 'booking-rules' | 'invoicing';
export function Settings({ section }: { section: SettingsSection }) {
  const { catalogue, busy, error, saved, submit } = useSettings(section);
  if (!catalogue) return null;
  return (
    <>
      <form onSubmit={submit} className="settings-form">
        {section === 'pricing' && <TransportSettings catalogue={catalogue} />}
        {section === 'invoicing' && <ContactSettings catalogue={catalogue} />}
        {section === 'booking-rules' && <BookingRulesSettings catalogue={catalogue} />}
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="alert success">
            {messages.parametresEnregistres}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? messages.enregistrement : messages.enregistrerLesParametres}
        </button>
      </form>
    </>
  );
}
