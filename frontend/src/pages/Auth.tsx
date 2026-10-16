import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../application/context';
export function Auth() {
  const { api, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const phone = String(f.get('phone')),
        password = String(f.get('password'));
      const user = register
        ? await api.register(String(f.get('name')), phone, password)
        : await api.login(phone, password);
      setUser(user);
      navigate(
        params.get('retour') === 'reservation'
          ? '/#reserver'
          : user.role === 'admin'
            ? '/admin'
            : '/mon-espace',
        { replace: true },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page container">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Retour à l’accueil
      </Link>
      <div className="auth-card panel">
        <span className="auth-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">VOTRE ESPACE PERSONNEL</p>
        <h1>{register ? 'BIENVENUE À BORD.' : 'HEUREUX DE VOUS REVOIR.'}</h1>
        <p className="muted">Réservations, suivi et devis, tout est au même endroit.</p>
        <div className="tabs">
          <button
            className={!register ? 'active' : ''}
            onClick={() => {
              setRegister(false);
              setError('');
            }}
          >
            Connexion
          </button>
          <button
            className={register ? 'active' : ''}
            onClick={() => {
              setRegister(true);
              setError('');
            }}
          >
            Créer un compte
          </button>
        </div>
        <form onSubmit={submit}>
          {register && (
            <>
              <label htmlFor="auth-name">Nom complet</label>
              <input
                id="auth-name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                placeholder="Votre nom et prénom"
              />
            </>
          )}
          <label htmlFor="auth-phone">Téléphone</label>
          <input
            id="auth-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={25}
            placeholder="77 123 45 67"
          />
          <label htmlFor="auth-password">Mot de passe</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 10 : 1}
            maxLength={128}
            required
            placeholder={register ? 'Au moins 10 caractères' : 'Votre mot de passe'}
          />
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy ? 'Veuillez patienter…' : register ? 'Créer mon compte' : 'Me connecter'}
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="caption">
          {register
            ? 'Utilisez votre numéro habituel pour retrouver vos demandes.'
            : 'L’administration utilise ce même formulaire de connexion.'}
        </p>
      </div>
    </div>
  );
}
