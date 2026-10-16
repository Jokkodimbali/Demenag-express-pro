import { Save } from 'lucide-react';
import { useSettings } from '../application/controllers/useSettings';
import { PasswordForm } from '../components/PasswordForm';
import { BookingRulesSettings } from '../components/settings/BookingRulesSettings';
import { ContactSettings } from '../components/settings/ContactSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
import { messages } from '../content/fr';
export function Settings() {
  const { catalogue, busy, error, saved, submit } = useSettings();
  if (!catalogue) return null;
  return (
    <>
      <form onSubmit={submit} className="settings-form">
        <TransportSettings catalogue={catalogue} />
        <ContactSettings catalogue={catalogue} />
        <BookingRulesSettings catalogue={catalogue} />
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="alert success">
            {messages.lesTarifsEtParametresOntEteEnregistres}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? messages.enregistrement : messages.enregistrerLesParametres}
        </button>
      </form>
      <PasswordForm />
    </>
  );
}
