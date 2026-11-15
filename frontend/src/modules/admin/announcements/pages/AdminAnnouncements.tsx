import { uiText } from '../../../shared/content/reference-ui-text';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../../../shared/application/context';
import { useAdminAnnouncements } from '../application/controllers/useAdminAnnouncements';

export function AdminAnnouncements() {
  const { showSuccessToast, showErrorToast } = useApp();
  const { announceDrivers } = useAdminAnnouncements();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await announceDrivers(title, message);
      setTitle('');
      setMessage('');
      showSuccessToast('Information envoyée aux chauffeurs.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'L’envoi a échoué.';
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-announcements">
      <div>
        <p className="eyebrow">{uiText['communication']}</p>
        <h2>{uiText['envoyerUneInformationAuxChauffeurs']}</h2>
        <p>{uiText['chaqueChauffeurRecevraCetteAnnonceDansSaClocheDeNotifi']}</p>
      </div>
      <form onSubmit={submit}>
        <label>
          {uiText['titre']}
          <input
            required
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        <label>
          {uiText['message']}
          <textarea
            required
            maxLength={1000}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <button className="button button-primary" type="submit" disabled={busy}>
          <Send size={16} />
          {busy ? 'Envoi…' : 'Envoyer aux chauffeurs'}
        </button>
      </form>
    </section>
  );
}
