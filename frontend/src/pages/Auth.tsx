import { uiText } from '../content/reference-ui-text';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuthentication } from '../application/controllers/useAuthentication';
import { messages } from '../content/fr';
export function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const [registrationRole, setRegistrationRole] = useState<'client' | 'driver'>('client');
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
  } = useAuthentication();
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
        {!resetMode && (
          <div className="tabs">
            <button
              type="button"
              className={!register ? 'active' : ''}
              onClick={() => {
                setRegister(false);
                setResetMode(false);
                setRegistrationRole('client');
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
                setRegistrationRole('client');
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
              <label htmlFor="auth-registration-role">Type de compte</label>
              <select
                id="auth-registration-role"
                name="accountRole"
                value={registrationRole}
                onChange={(event) => {
                  setRegistrationRole(event.target.value as 'client' | 'driver');
                  setRegisterPassword('');
                  setError('');
                }}
              >
                <option value="client">Client</option>
                <option value="driver">Employé · compte créé par l’administration</option>
              </select>
              {registrationRole === 'driver' ? (
                <p className="caption">
                  Utilisez le numéro et le mot de passe initial transmis par l’administration.
                </p>
              ) : (
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
            </>
          )}
          <label htmlFor="auth-phone">
            <span>
              {register || resetMode ? uiText['telephone2'] : 'Téléphone ou email administrateur'}
            </span>
          </label>
          <input
            id="auth-phone"
            name={resetMode ? 'phone' : register ? 'phone' : 'identifier'}
            type={resetMode ? 'tel' : register ? 'tel' : 'text'}
            autoComplete={resetMode ? 'tel' : register ? 'tel' : 'username'}
            inputMode={resetMode || register ? 'tel' : 'text'}
            required
            minLength={resetMode || register ? 9 : 3}
            maxLength={resetMode || register ? 25 : 254}
            placeholder={
              resetMode || register ? uiText['221771234567'] : 'Téléphone ou email admin'
            }
          />
          <p className="caption">
            {register || resetMode
              ? 'Utilisez le numéro associé à votre compte.'
              : 'Client : téléphone uniquement. Employé : téléphone et mot de passe initial. Administrateur : téléphone ou email avec mot de passe.'}
          </p>
          {!resetMode && (
            <>
              <label htmlFor="auth-password">
                <span>{uiText['motDEPASSE']}</span>
              </label>
              <div className="auth-password-field">
                <input
                  key={`${register ? 'register' : 'login'}-${registrationRole}-password`}
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    register && registrationRole === 'client' ? 'new-password' : 'current-password'
                  }
                  minLength={register && registrationRole === 'client' ? 8 : register ? 10 : 0}
                  maxLength={128}
                  required={register}
                  placeholder={
                    register && registrationRole === 'client'
                      ? '8 caractères minimum'
                      : register
                        ? 'Mot de passe initial transmis par l’administration'
                        : messages.votreMotDePasse
                  }
                  onChange={(event) => setRegisterPassword(register ? event.target.value : '')}
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
              {!register && (
                <p className="caption">
                  Mot de passe obligatoire pour l’administrateur uniquement.
                </p>
              )}
              {register && registrationRole === 'client' && (
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
                  ? registrationRole === 'driver'
                    ? 'Se connecter à mon espace employé'
                    : messages.creerMonCompte
                  : 'Se connecter'}
            <ArrowRight size={18} />
          </button>
        </form>
        {!register && !resetMode && (
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
