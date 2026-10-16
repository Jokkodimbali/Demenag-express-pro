import { useFleet } from '../application/controllers/useFleet';
import { Modal } from '../components/Modal';
import { fields } from '../content/forms/fleet';
import { messages } from '../content/fr';

export function Fleet() {
  const { catalogue, editing, setEditing, busy, error, setError, save } = useFleet();
  if (!catalogue) return null;
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h2>{messages.vehicules2}</h2>
          <p>{messages.unVehiculeCorrespondAUneDisponibiliteParCreneau}</p>
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
          {messages.ajouterUnVehicule}
        </button>
      </div>
      <div className="tariff-grid">
        {catalogue.vehicles.map((v) => (
          <div className="tariff-card" key={v.id}>
            <img src={v.image} alt={v.name} />
            <h3>{v.name}</h3>
            <p>
              {v.volume} · {v.active === false ? 'Indisponible' : messages.labelActif}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setError('');
                setEditing(v);
              }}
            >
              {messages.modifier}
              {v.name}
            </button>
          </div>
        ))}
      </div>
      {editing && (
        <Modal titleId="vehicle-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save} key={editing.id}>
            <h2 id="vehicle-title">{messages.ficheVehicule}</h2>
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
            <label className="checkbox-label">
              <input type="checkbox" name="active" defaultChecked={editing.active !== false} />
              {messages.disponibleALaReservation}
            </label>
            <p className="caption">{messages.reglezLesPrixDansTarifsEtParametresUn}</p>
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
                {messages.fermer}
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? messages.enregistrement : messages.labelEnregistrer}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
