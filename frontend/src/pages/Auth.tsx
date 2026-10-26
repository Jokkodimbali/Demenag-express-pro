import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthentication, type LoginSpace } from '../application/controllers/useAuthentication';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [space, setSpace] = useState<LoginSpace>('client');
  const { register, setRegister, busy, error, setError, submit } = useAuthentication(space);

  return (
    <div className="auth-page container">
      <Link to={routes.home} className="back-link">
        <ArrowLeft size={16} />
        {messages.retourALAccueil}
      </Link>
      <div className="auth-card panel">
        <h1>MON COMPTE</h1>
        <div className="tabs auth-spaces" aria-label="Choisir un espace de connexion">
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
                setError('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {space === 'client' && (
          <div className="tabs">
            <button
              type="button"
              className={!register ? 'active' : ''}
              onClick={() => {
                setRegister(false);
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
                setError('');
              }}
            >
              {messages.creerUnCompte}
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {register && (
            <>
              <label htmlFor="auth-name">{messages.nomComplet}</label>
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
          <label htmlFor="auth-phone">{messages.telephone}</label>
          <input
            id="auth-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            maxLength={25}
            placeholder="+221 77 123 45 67"
          />
          <p className="caption">
            {space === 'client'
              ? 'Numéro donné lors de votre devis ou de votre réservation.'
              : space === 'driver'
                ? 'Numéro enregistré par l’administrateur.'
                : 'Numéro du compte administrateur.'}
          </p>
          <label htmlFor="auth-password">{messages.motDePasse}</label>
          <div className="auth-password-field">
            <input
              id="auth-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 10 : 1}
              maxLength={128}
              required
              placeholder={register ? messages.auMoins10Caracteres : messages.votreMotDePasse}
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? messages.masquerMotDePasse : messages.afficherMotDePasse}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy
              ? messages.veuillezPatienter
              : register
                ? messages.creerMonCompte
                : 'Me connecter'}
            <ArrowRight size={18} />
          </button>
        </form>
        {register && (
          <p className="caption">{messages.utilisezVotreNumeroHabituelPourRetrouverVosDemandes}</p>
        )}
      </div>
    </div>
  );
}
