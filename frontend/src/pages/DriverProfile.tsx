import { ArrowLeft, CircleUserRound, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PasswordForm } from '../components/PasswordForm';
import { PhotoPicker } from '../components/PhotoPicker';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function DriverProfile() {
  const { profile, loading, error, photoSaving, setRetry, savePhoto } = useDriverWorkspace(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoSaved, setPhotoSaved] = useState(false);

  return (
    <section className="container workspace-page driver-profile-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceChauffeur}</p>
          <h1>{messages.monProfil}</h1>
          <p>Consultez vos informations et changez votre mot de passe ci-dessous.</p>
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
          <section className="profile-fields-form" aria-label="Informations du profil employé">
            <div className="driver-profile-heading">
              {profile.photo ? (
                <img className="driver-profile-photo" src={profile.photo} alt={profile.name} />
              ) : (
                <CircleUserRound className="driver-profile-photo-placeholder" aria-hidden="true" />
              )}
              <div>
                <p className="eyebrow">Profil employé</p>
                <h2>{profile.name}</h2>
                <p>
                  Votre nom et votre numéro sont gérés par l’administration. Vous pouvez modifier
                  votre photo ci-dessous.
                </p>
              </div>
            </div>
            <div className="field-pair">
              <div>
                <label htmlFor="driver-profile-name">{messages.nom}</label>
                <input id="driver-profile-name" value={profile.name} readOnly />
              </div>
              <div>
                <label htmlFor="driver-profile-phone">{messages.telephone}</label>
                <input id="driver-profile-phone" type="tel" value={profile.phone} readOnly />
              </div>
            </div>
            <PhotoPicker
              label="Photo de profil"
              files={photoFiles}
              maxPhotos={1}
              cameraButtonLabel="Activer la caméra"
              importButtonLabel="Importer une photo"
              onChange={(files) => {
                setPhotoFiles(files);
                setPhotoSaved(false);
              }}
            />
            {photoSaved ? (
              <p className="alert success" role="status">
                Photo de profil mise à jour.
              </p>
            ) : null}
            <div className="driver-profile-actions">
              <button
                className="button primary small"
                type="button"
                disabled={!photoFiles.length || photoSaving}
                onClick={async () => {
                  if (await savePhoto(photoFiles[0] ?? null)) {
                    setPhotoFiles([]);
                    setPhotoSaved(true);
                  }
                }}
              >
                <Save size={15} />
                {photoSaving ? 'Enregistrement…' : 'Enregistrer la photo'}
              </button>
              <button
                className="button secondary small"
                type="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw size={15} />
                {messages.actualiser2}
              </button>
            </div>
          </section>
          <PasswordForm embedded />
        </div>
      ) : null}
    </section>
  );
}
