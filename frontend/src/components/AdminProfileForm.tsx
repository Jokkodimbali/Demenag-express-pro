import { CircleUserRound } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../application/context';
import { useAdminProfile } from '../application/controllers/useAdminProfile';
import { errorMessage } from '../application/error-message';
import { dataUrl } from '../application/validation/forms';
import { messages } from '../content/fr';
import { PasswordForm } from './PasswordForm';

export function AdminProfileForm() {
  const { user } = useApp();
  const { updateProfile } = useAdminProfile();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  if (!user || user.role !== 'admin') return null;
  const admin = user;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const photo = await dataUrl(form.get('photo'), admin.photo ?? '');
      await updateProfile({
        name: String(form.get('name')),
        phone: String(form.get('phone')),
        photo: photo || null,
      });
      setSaved(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel profile-settings-panel">
      <form className="profile-fields-form" onSubmit={save}>
        <div className="driver-profile-heading">
          {admin.photo ? (
            <img className="driver-profile-photo" src={admin.photo} alt={admin.name} />
          ) : (
            <CircleUserRound className="driver-profile-photo-placeholder" aria-hidden="true" />
          )}
          <div>
            <p className="eyebrow">{messages.profilAdministrateur}</p>
            <h2>{admin.name}</h2>
            <p>{messages.labelAdministrateur}</p>
          </div>
        </div>
        <div className="field-pair">
          <div>
            <label htmlFor="admin-profile-name">{messages.nom}</label>
            <input
              id="admin-profile-name"
              name="name"
              defaultValue={admin.name}
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div>
            <label htmlFor="admin-profile-phone">{messages.telephone}</label>
            <input
              id="admin-profile-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={admin.phone}
              required
              minLength={9}
              maxLength={25}
            />
          </div>
        </div>
        <div>
          <label htmlFor="admin-profile-photo">{messages.photoDeProfil}</label>
          <input
            id="admin-profile-photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />
          <p className="caption">{messages.photoProfilAide}</p>
        </div>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="alert success">
            {messages.profilMisAJour}
          </p>
        )}
        <div className="driver-profile-actions">
          <button className="button primary" disabled={saving}>
            {saving ? messages.enregistrement : messages.enregistrerMonProfil}
          </button>
        </div>
      </form>
      <PasswordForm embedded />
    </div>
  );
}
