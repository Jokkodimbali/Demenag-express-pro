import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { usePasswordForm } from '../application/controllers/usePasswordForm';
import { messages } from '../content/fr';
export function PasswordForm({ embedded = false }: { embedded?: boolean }) {
  const { busy, error, saved, submit } = usePasswordForm();
  const [showPasswords, setShowPasswords] = useState(false);

  return (
    <section className={embedded ? 'password-panel' : 'panel password-panel'}>
      <h2>{messages.modifierMonMotDePasse}</h2>
      <form onSubmit={submit}>
        <div className="field-pair">
          <div>
            <label htmlFor="password-current">{messages.motDePasseActuel}</label>
            <div className="password-input-wrap">
              <input
                id="password-current"
                name="current"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={128}
              />
              <button
                className="password-visibility-toggle"
                type="button"
                aria-label={
                  showPasswords ? messages.masquerMotDePasse : messages.afficherMotDePasse
                }
                aria-pressed={showPasswords}
                onClick={() => setShowPasswords((visible) => !visible)}
              >
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="password-next">{messages.nouveauMotDePasse}</label>
            <div className="password-input-wrap">
              <input
                id="password-next"
                name="next"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
              />
              <button
                className="password-visibility-toggle"
                type="button"
                aria-label={
                  showPasswords ? messages.masquerMotDePasse : messages.afficherMotDePasse
                }
                aria-pressed={showPasswords}
                onClick={() => setShowPasswords((visible) => !visible)}
              >
                {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
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
