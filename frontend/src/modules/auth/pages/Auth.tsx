import { uiText } from '../../shared/content/reference-ui-text';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuthentication } from '../application/controllers/useAuthentication';
import { messages } from '../../shared/content/fr';
import { sanitizePhoneInput } from '../../shared/domain/phone-number';
export function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
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
    fieldErrors,
    validateSingleField,
    clearFieldErrors,
  } = useAuthentication();
  const passwordStrength = [
    registerPassword.length >= 8,
    /[a-zA-Z]/.test(registerPassword) && /\d/.test(registerPassword),
    /[A-Z]/.test(registerPassword) && /[a-z]/.test(registerPassword),
    /[^a-zA-Z0-9]/.test(registerPassword) || registerPassword.length >= 12,
  ].filter(Boolean).length;
  const passwordStrengthLabels = ['Trop faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];
  const renderFieldError = (field: keyof typeof fieldErrors) => {
    const message = fieldErrors[field];
    return message ? (
      <span className="auth-field-error" id={`auth-${field}-error`} role="alert">
        {message}
      </span>
    ) : null;
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/assets/logo.png" alt="" />
          <span>
            <strong>{uiText['demenagEXPRESS']}</strong>
            <small>{uiText['proMTH']}</small>
          </span>
        </div>
        <h1>{uiText['monCOMPTE']}</h1>
        {!resetMode && (
          <div className="tabs">
            <button
              type="button"
              className={!register ? 'active' : ''}
              aria-pressed={!register}
              onClick={() => {
                setRegister(false);
                setResetMode(false);
                setRegisterPassword('');
                setError('');
                clearFieldErrors();
              }}
            >
              {messages.connexion}
            </button>
            <button
              type="button"
              className={register ? 'active' : ''}
              aria-pressed={register}
              onClick={() => {
                setRegister(true);
                setResetMode(false);
                setRegisterPassword('');
                setError('');
                clearFieldErrors();
              }}
            >
              {messages.creerUnCompte}
            </button>
          </div>
        )}
        <form noValidate onSubmit={resetMode ? requestPasswordReset : submit}>
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
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                placeholder={messages.votreNomEtPrenom}
                onBlur={(event) => validateSingleField('name', event.currentTarget.form)}
              />
              {renderFieldError('name')}
            </>
          )}
          <label htmlFor="auth-phone">
            <span>
              {resetMode || register ? uiText['telephone2'] : messages.authLoginIdentifier}
            </span>
          </label>
          <input
            id="auth-phone"
            key={resetMode ? 'reset-phone' : register ? 'register-phone' : 'login-identifier'}
            name={resetMode ? 'phone' : register ? 'phone' : 'identifier'}
            type={resetMode || register ? 'tel' : 'text'}
            autoComplete={resetMode || register ? 'tel' : 'username'}
            inputMode={resetMode || register ? 'tel' : 'text'}
            required
            minLength={resetMode || register ? 9 : 3}
            maxLength={resetMode || register ? 25 : 254}
            aria-invalid={Boolean(fieldErrors[resetMode || register ? 'phone' : 'identifier'])}
            aria-describedby={
              fieldErrors[resetMode || register ? 'phone' : 'identifier']
                ? `auth-${resetMode || register ? 'phone' : 'identifier'}-error`
                : undefined
            }
            placeholder={
              resetMode || register ? '+221 77 123 45 67 ou +33 6 12 34 56 78' : undefined
            }
            onChange={(event) => {
              if (resetMode || register) {
                event.currentTarget.value = sanitizePhoneInput(event.currentTarget.value);
              }
            }}
            onBlur={(event) =>
              validateSingleField(
                resetMode || register ? 'phone' : 'identifier',
                event.currentTarget.form,
                resetMode ? 'reset' : register ? 'register' : 'login',
              )
            }
          />
          {renderFieldError(resetMode || register ? 'phone' : 'identifier')}
          {!resetMode && (
            <>
              <label htmlFor="auth-password">
                <span>{uiText['motDEPASSE']}</span>
              </label>
              <div className="auth-password-field">
                <input
                  key={register ? 'register-password' : 'login-password'}
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={register ? 8 : 0}
                  maxLength={128}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                  placeholder={
                    register ? messages.authPasswordCreationPlaceholder : messages.votreMotDePasse
                  }
                  onChange={(event) => setRegisterPassword(register ? event.target.value : '')}
                  onBlur={(event) => validateSingleField('password', event.currentTarget.form)}
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
              {renderFieldError('password')}
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
                  <div className="auth-password-field">
                    <input
                      id="auth-password-confirm"
                      name="passwordConfirmation"
                      type={showPasswordConfirmation ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
                      aria-describedby={
                        fieldErrors.passwordConfirmation
                          ? 'auth-passwordConfirmation-error'
                          : undefined
                      }
                      placeholder={uiText['texte2']}
                      onBlur={(event) =>
                        validateSingleField('passwordConfirmation', event.currentTarget.form)
                      }
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      aria-label={
                        showPasswordConfirmation
                          ? messages.masquerMotDePasse
                          : messages.afficherMotDePasse
                      }
                      aria-pressed={showPasswordConfirmation}
                      onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                    >
                      {showPasswordConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {renderFieldError('passwordConfirmation')}
                </>
              )}
            </>
          )}
          {resetMode && (
            <p className="caption" role={resetSent ? 'status' : undefined}>
              {resetSent ? messages.authResetSent : messages.authResetHint}
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
                ? messages.authSendResetRequest
                : register
                  ? messages.creerMonCompte
                  : messages.connexion}
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
              clearFieldErrors();
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
              clearFieldErrors();
            }}
          >
            {uiText['retourALaConnexion']}
          </button>
        )}
      </div>
    </div>
  );
}
