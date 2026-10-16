import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthentication } from '../application/controllers/useAuthentication';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Auth() {
  const { register, setRegister, busy, error, setError, submit } = useAuthentication();

  return (
    <div className="auth-page container">
      <Link to={routes.home} className="back-link">
        <ArrowLeft size={16} />
        {messages.retourALAccueil}
      </Link>
      <div className="auth-card panel">
        <span className="auth-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">{messages.votreEspacePersonnel}</p>
        <h1>{register ? messages.bienvenueABord : messages.heureuxDeVousRevoir}</h1>
        <p className="muted">{messages.reservationsSuiviEtDevisToutEstAuMeme}</p>
        <div className="tabs">
          <button
            className={!register ? 'active' : ''}
            onClick={() => {
              setRegister(false);
              setError('');
            }}
          >
            {messages.connexion}
          </button>
          <button
            className={register ? 'active' : ''}
            onClick={() => {
              setRegister(true);
              setError('');
            }}
          >
            {messages.creerUnCompte}
          </button>
        </div>
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
            required
            maxLength={25}
            placeholder={messages.text771234567}
          />
          <label htmlFor="auth-password">{messages.motDePasse}</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 10 : 1}
            maxLength={128}
            required
            placeholder={register ? messages.auMoins10Caracteres : messages.votreMotDePasse}
          />
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
        <p className="caption">
          {register
            ? messages.utilisezVotreNumeroHabituelPourRetrouverVosDemandes
            : messages.lAdministrationUtiliseCeMemeFormulaireDeConnexion}
        </p>
      </div>
    </div>
  );
}
