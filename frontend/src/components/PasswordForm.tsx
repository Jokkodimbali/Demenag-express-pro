import { usePasswordForm } from '../application/controllers/usePasswordForm';
import { messages } from '../content/fr';
export function PasswordForm({ embedded = false }: { embedded?: boolean }) {
  const { busy, error, saved, submit } = usePasswordForm();

  return (
    <section className={embedded ? 'password-panel' : 'panel password-panel'}>
      <h2>{messages.modifierMonMotDePasse}</h2>
      <form onSubmit={submit}>
        <div className="field-pair">
          <div>
            <label htmlFor="password-current">{messages.motDePasseActuel}</label>
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
            <label htmlFor="password-next">{messages.nouveauMotDePasse}</label>
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
        <p className="caption">{messages.auMoins10CaracteresLesAutresSessionsSeront}</p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="alert success">
            {messages.motDePasseModifie}
          </p>
        )}
        <button className="button primary small" disabled={busy}>
          {busy ? messages.enregistrement : messages.enregistrerLeNouveauMotDePasse}
        </button>
      </form>
    </section>
  );
}
