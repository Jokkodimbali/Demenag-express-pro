import { useState } from 'react';
import { useApp } from '../application/context';
export function PasswordForm() {
  const { api, setUser } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      setUser(await api.changePassword(String(data.get('current')), String(data.get('next'))));
      form.reset();
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel password-panel">
      <button
        className="button secondary small"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Modifier mon mot de passe
      </button>
      {open && (
        <form onSubmit={submit}>
          <div className="field-pair">
            <div>
              <label htmlFor="password-current">Mot de passe actuel</label>
              <input
                id="password-current"
                name="current"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </div>
            <div>
              <label htmlFor="password-next">Nouveau mot de passe</label>
              <input
                id="password-next"
                name="next"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
              />
            </div>
          </div>
          <p className="caption">
            Au moins 10 caractères. Les autres sessions seront déconnectées.
          </p>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="alert success">
              Mot de passe modifié.
            </p>
          )}
          <button className="button primary small" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>
        </form>
      )}
    </section>
  );
}
