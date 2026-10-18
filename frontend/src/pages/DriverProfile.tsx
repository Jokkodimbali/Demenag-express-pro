import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PasswordForm } from '../components/PasswordForm';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function DriverProfile() {
  const { profile, loading, error, saving, setRetry, save } = useDriverWorkspace(false);

  return (
    <section className="container workspace-page driver-profile-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceChauffeur}</p>
          <h1>{messages.monProfil}</h1>
          <p>{messages.mettezAJourVosInformationsPersonnelles}</p>
        </div>
        <Link className="button secondary small" to={routes.driverWorkspace}>
          <ArrowLeft size={16} />
          {messages.retourAuxMissions}
        </Link>
      </div>

      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="panel loading" role="status">
          {messages.chargementDuCompte}
        </p>
      ) : profile ? (
        <div className="panel profile-settings-panel" key={profile.id}>
          <form className="profile-fields-form" onSubmit={save}>
            <div className="driver-profile-heading">
              {profile.photo ? (
                <img className="driver-profile-photo" src={profile.photo} alt={profile.name} />
              ) : null}
              <div>
                <p className="eyebrow">{messages.profilChauffeur}</p>
                <h2>{profile.name}</h2>
              </div>
            </div>
            <div className="field-pair">
              <div>
                <label htmlFor="driver-profile-name">{messages.nom}</label>
                <input
                  id="driver-profile-name"
                  name="name"
                  defaultValue={profile.name}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="driver-profile-phone">{messages.telephone}</label>
                <input
                  id="driver-profile-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={profile.phone}
                  required
                  minLength={9}
                  maxLength={25}
                />
              </div>
            </div>
            <div>
              <label htmlFor="driver-profile-photo">{messages.photoDeProfil}</label>
              <input
                id="driver-profile-photo"
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            </div>
            <div className="driver-profile-actions">
              <button className="button primary" disabled={saving}>
                {saving ? messages.enregistrement : messages.enregistrerMonProfil}
              </button>
              <button
                className="button secondary small"
                type="button"
                disabled={saving}
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw size={15} />
                {messages.actualiser2}
              </button>
            </div>
          </form>
          <PasswordForm embedded />
        </div>
      ) : null}
    </section>
  );
}
