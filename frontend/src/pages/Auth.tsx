import { uiText } from '../content/reference-ui-text';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuthentication, type LoginSpace } from '../application/controllers/useAuthentication';
import { messages } from '../content/fr';
export function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const [space, setSpace] = useState<LoginSpace>('client');
  const [resetMode, setResetMode] = useState(false);
  const {
    register,
    setRegister,
    busy,
    error,
    setError,
    submit,
    requestPasswordReset,
    resetSent,
    setResetSent,
  } = useAuthentication(space);
  const passwordStrength = [
    registerPassword.length >= 8,
    /[a-zA-Z]/.test(registerPassword) && /\d/.test(registerPassword),
    /[A-Z]/.test(registerPassword) && /[a-z]/.test(registerPassword),
    /[^a-zA-Z0-9]/.test(registerPassword) || registerPassword.length >= 12,
  ].filter(Boolean).length;
  const passwordStrengthLabels = ['Trop faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{uiText['monCOMPTE']}</h1>
        <div className="tabs auth-spaces" aria-label={uiText['choisirUnEspaceDeConnexion']}>
          {(
            [
              ['client', 'Client'],
              ['driver', 'Employé'],
              ['admin', 'Administrateur'],
            ] as const
          ).map(([role, label]) => (
            <button
              type="button"
              key={role}
              className={space === role ? 'active' : ''}
              aria-pressed={space === role}
              onClick={() => {
                setSpace(role);
                setRegister(false);
                setResetMode(false);
                setRegisterPassword('');
                setError('');
                setResetSent(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {space === 'client' && !resetMode && (
          <div className="tabs">
            <button
              type="button"
              className={!register ? 'active' : ''}
              onClick={() => {
                setRegister(false);
                setResetMode(false);
                setRegisterPassword('');
                setError('');
              }}
            >
              {messages.connexion}
            </button>
            <button
              type="button"
              className={register ? 'active' : ''}
              onClick={() => {
                setRegister(true);
                setResetMode(false);
                setRegisterPassword('');
                setError('');
              }}
            >
              {messages.creerUnCompte}
            </button>
          </div>
        )}
        <form onSubmit={resetMode ? requestPasswordReset : submit}>
          {register && !resetMode && (
            <>
              <label htmlFor="auth-name">
                <span>{uiText['nomCOMPLET']}</span>
              </label>
              <input
                id="auth-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                placeholder={messages.votreNomEtPrenom}
              />
            </>
          )}
          <label htmlFor="auth-phone">
            <span>{uiText['telephone2']}</span>
          </label>
          <input
            id="auth-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            maxLength={25}
            placeholder={uiText['221771234567']}
          />
          <p className="caption">
            {space === 'client'
              ? 'Numéro donné lors de votre devis ou de votre réservation.'
              : space === 'driver'
                ? 'Numéro enregistré par l’administrateur.'
                : 'Numéro du compte administrateur.'}
          </p>
          {!resetMode && (
            <>
              <label htmlFor="auth-password">
                <span>{uiText['motDEPASSE']}</span>
              </label>
              <div className="auth-password-field">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  required
                  placeholder={register ? '8 caractères minimum' : messages.votreMotDePasse}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={
                    showPassword ? messages.masquerMotDePasse : messages.afficherMotDePasse
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {register && (
                <>
                  <div className="auth-password-strength" aria-live="polite">
                    <div aria-hidden="true">
                      {passwordStrengthLabels.slice(1).map((_, index) => (
                        <span
                          key={index}
                          className={index < passwordStrength ? `strength-${passwordStrength}` : ''}
                        />
                      ))}
                    </div>
                    <span>{passwordStrengthLabels[passwordStrength]}</span>
                  </div>
                  <label htmlFor="auth-password-confirm">
                    <span>{uiText['confirmezLEMOTDEPASSE']}</span>
                  </label>
                  <input
                    id="auth-password-confirm"
                    name="passwordConfirmation"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    placeholder={uiText['texte2']}
                  />
                  <p className="auth-first-password-hint">
                    {uiText['premiereConnexionCreezVotreMotDePasse8CaracteresMinimu']}
                  </p>
                </>
              )}
            </>
          )}
          {resetMode && (
            <p className="caption" role={resetSent ? 'status' : undefined}>
              {resetSent
                ? 'Si un compte client correspond à ce numéro, la demande a été transmise à l’administration.'
                : 'Après vérification de votre numéro, l’administration vous aidera à choisir un nouveau mot de passe.'}
            </p>
          )}
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy
              ? messages.veuillezPatienter
              : resetMode
                ? 'Envoyer la demande'
                : register
                  ? messages.creerMonCompte
                  : 'Se connecter'}
            <ArrowRight size={18} />
          </button>
        </form>
        {space === 'client' && !register && !resetMode && (
          <button
            className="auth-reset-link"
            type="button"
            onClick={() => {
              setResetMode(true);
              setResetSent(false);
              setError('');
            }}
          >
            {uiText['motDePasseOublie']}
          </button>
        )}
        {resetMode && (
          <button
            className="auth-reset-link"
            type="button"
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
              setError('');
            }}
          >
            {uiText['retourALaConnexion']}
          </button>
        )}
        {register && (
          <p className="caption">{messages.utilisezVotreNumeroHabituelPourRetrouverVosDemandes}</p>
        )}
      </div>
    </div>
  );
}
