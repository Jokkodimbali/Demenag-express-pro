import { useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../application/context';

export function AdminAnnouncements() {
  const { api } = useApp();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(''); setBusy(true);
    try { await api.announceDrivers(title, message); setTitle(''); setMessage(''); setFeedback('Information envoyée aux chauffeurs.'); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'L’envoi a échoué.'); }
    finally { setBusy(false); }
  }
  return <section className="panel admin-announcements">
    <div><p className="eyebrow">Communication</p><h2>Envoyer une information aux chauffeurs</h2><p>Chaque chauffeur recevra cette annonce dans sa cloche de notifications.</p></div>
    <form onSubmit={submit}>
      <label>Titre<input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Message<textarea required maxLength={1000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      {feedback && <p role="status">{feedback}</p>}
      <button className="button button-primary" type="submit" disabled={busy}><Send size={16} />{busy ? 'Envoi…' : 'Envoyer aux chauffeurs'}</button>
    </form>
  </section>;
}
