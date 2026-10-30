import { useSettings } from '../application/controllers/useSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
import { messages } from '../content/fr';
export function Settings() {
  const { catalogue, busy, error, saved, submit, onChange, onBlur } = useSettings();
  if (!catalogue) return null;
  return (
    <form onSubmit={submit} onChange={onChange} onBlur={onBlur} className="settings-form">
      <TransportSettings catalogue={catalogue} />
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
          Modifications enregistrées automatiquement…
        </p>
      )}
    </form>
  );
}
