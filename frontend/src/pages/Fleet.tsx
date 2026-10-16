import { useState } from 'react';
import { useApp } from '../application/context';
import { Modal } from '../components/Modal';
import type { Vehicle } from '../domain/model';
const fields = [
  ['name', 'Nom'],
  ['volume', 'Volume utile'],
  ['length', 'Longueur utile'],
  ['height', 'Hauteur utile'],
  ['width', 'Largeur utile'],
  ['wheelWidth', 'Largeur entre passages de roue'],
] as const;
export function Fleet() {
  const { api, catalogue, setCatalogue } = useApp();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue || !editing || busy) return;
    const data = new FormData(e.currentTarget);
    const value: Vehicle = {
      ...editing,
      ...Object.fromEntries(fields.map(([key]) => [key, String(data.get(key))])),
      active: data.get('active') === 'on',
      image: `/assets/${data.get('illustration')}-profil.png`,
      interior: `/assets/${data.get('illustration')}-interieur.png`,
    };
    setBusy(true);
    setError('');
    try {
      const exists = catalogue.vehicles.some((v) => v.id === value.id);
      setCatalogue(
        await api.updateCatalogue({
          ...catalogue,
          vehicles: exists
            ? catalogue.vehicles.map((v) => (v.id === value.id ? value : v))
            : [...catalogue.vehicles, value],
        }),
      );
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!catalogue) return null;
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h2>VÉHICULES</h2>
          <p>
            Un véhicule correspond à une disponibilité par créneau. Désactivez-le pour le retirer
            des nouvelles demandes.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError('');
            setEditing({
              ...catalogue.vehicles[0],
              id: 'veh-' + crypto.randomUUID().slice(0, 12),
              name: '',
              active: false,
            });
          }}
        >
          Ajouter un véhicule
        </button>
      </div>
      <div className="tariff-grid">
        {catalogue.vehicles.map((v) => (
          <div className="tariff-card" key={v.id}>
            <img src={v.image} alt={v.name} />
            <h3>{v.name}</h3>
            <p>
              {v.volume} · {v.active === false ? 'Indisponible' : 'Actif'}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setError('');
                setEditing(v);
              }}
            >
              Modifier {v.name}
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <Modal titleId="vehicle-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save} key={editing.id}>
            <h2 id="vehicle-title">FICHE VÉHICULE</h2>
            <div className="field-pair">
              {fields.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={'vehicle-' + key}>{label}</label>
                  <input
                    id={'vehicle-' + key}
                    name={key}
                    required
                    minLength={key === 'name' ? 2 : 1}
                    maxLength={key === 'name' ? 100 : 30}
                    defaultValue={editing[key]}
                  />
                </div>
              ))}
            </div>
            <label htmlFor="vehicle-illustration">Illustrations disponibles</label>
            <select
              id="vehicle-illustration"
              name="illustration"
              defaultValue={editing.image.split('/').pop()?.split('-')[0]}
            >
              {['sprinter', 'trafic', 'master'].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
            <label className="checkbox-label">
              <input type="checkbox" name="active" defaultChecked={editing.active !== false} />
              Disponible à la réservation
            </label>
            <p className="caption">
              Réglez les prix dans « Tarifs et paramètres ». Un nouveau véhicule reprend les tarifs
              du premier véhicule ; laissez-le inactif jusqu’à validation.
            </p>
            {error && (
              <p role="alert" className="alert error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Fermer
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
