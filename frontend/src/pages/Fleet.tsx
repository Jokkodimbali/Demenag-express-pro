import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFleet } from '../application/controllers/useFleet';
import { usePagination } from '../application/usePagination';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { fields } from '../content/forms/fleet';
import { messages } from '../content/fr';
import { pageSizes } from '../config/pagination';
import { money } from '../domain/format';
import { dataUrl } from '../application/validation/forms';

export function Fleet() {
  const [imagePreview, setImagePreview] = useState('');
  const {
    catalogue,
    editing,
    setEditing,
    deactivating,
    setDeactivating,
    busy,
    error,
    setError,
    save,
    requestDeactivation,
    deactivate,
    setVehicleAvailability,
    setBookingsAvailability,
    activity,
    drivers,
    selectedDriverId,
    chooseDriver,
    assignDriver,
    unassignDriver,
  } = useFleet();
  const pagination = usePagination(catalogue?.vehicles ?? [], pageSizes.vehicles);
  if (!catalogue) return null;
  const bookingsEnabled = catalogue.settings.bookingsEnabled !== false;
  const isNewVehicle =
    editing !== null && !catalogue.vehicles.some((vehicle) => vehicle.id === editing.id);
  const previewImage = imagePreview || (isNewVehicle ? '' : (editing?.image ?? ''));
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
            setImagePreview('');
          }}
        >
          {messages.ajouterUnVehicule}
        </button>
      </div>
      <section className="fleet-availability" aria-labelledby="booking-availability-title">
        <div>
          <h3 id="booking-availability-title">{messages.formulaireDeReservation}</h3>
          <p>{bookingsEnabled ? messages.reservationsOuvertes : messages.reservationsFermees}</p>
        </div>
        <button
          className={bookingsEnabled ? 'button secondary' : 'button primary'}
          disabled={busy}
          onClick={() => void setBookingsAvailability(!bookingsEnabled)}
        >
          {bookingsEnabled ? messages.fermerLeFormulaire : messages.ouvrirLeFormulaire}
        </button>
      </section>
      {error && !editing && !deactivating && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <div className="tariff-grid">
        {pagination.rows.map((v) => {
          const vehicleActivity = activity(v);
          const available = v.active !== false;
          const driver = drivers.find((item) => item.vehicleId === v.id) ?? null;
          const selectedDriver = selectedDriverId(v);
          return (
            <article className="tariff-card fleet-card" key={v.id}>
              <img src={v.image} alt={v.name} />
              <h3>{v.name}</h3>
              <p>
                {v.volume} · {available ? messages.labelActif : messages.indisponible}
              </p>
              <dl className="fleet-metrics">
                <div>
                  <dt>{messages.reservationsEnregistrees}</dt>
                  <dd>{vehicleActivity.bookings}</dd>
                </div>
                <div>
                  <dt>{messages.chiffreAffairesJournee}</dt>
                  <dd>{money(vehicleActivity.todayRevenue)}</dd>
                </div>
                <div>
                  <dt>{messages.chiffreAffairesSemaine}</dt>
                  <dd>{money(vehicleActivity.weekRevenue)}</dd>
                </div>
              </dl>
              <section className="fleet-driver" aria-labelledby={'driver-' + v.id}>
                <div>
                  <span id={'driver-' + v.id}>{messages.chauffeurAffecte}</span>
                  <strong>{driver?.name ?? messages.nonAffecte}</strong>
                </div>
                <label>
                  <span>{messages.affecterLeChauffeur}</span>
                  <select
                    value={selectedDriver}
                    disabled={busy}
                    onChange={(event) => chooseDriver(v, event.target.value)}
                  >
                    <option value="">{messages.nonAffecte}</option>
                    {drivers
                      .filter((item) => item.active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p>{messages.changementDeChauffeur}</p>
              </section>
              <div className="fleet-actions">
                <button
                  className={
                    available
                      ? 'button secondary fleet-action-toggle'
                      : 'button primary fleet-action-toggle'
                  }
                  disabled={busy}
                  onClick={() => void setVehicleAvailability(v)}
                >
                  {available ? messages.rendreIndisponible : messages.rendreDisponible}
                </button>
                <button
                  className="button secondary fleet-action-edit"
                  onClick={() => {
                    setError('');
                    setEditing(v);
                    setImagePreview(v.image);
                  }}
                >
                  {messages.modifier}
                  {v.name}
                </button>
                <button
                  className="icon-button danger fleet-action-remove"
                  disabled={busy}
                  onClick={() => requestDeactivation(v)}
                  aria-label={messages.retirerVehicule(v.name)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
                <button
                  className="button secondary fleet-action-driver"
                  disabled={busy || !selectedDriver}
                  onClick={() => void assignDriver(v)}
                >
                  {messages.affecter}
                </button>
                {driver && (
                  <button
                    className="button secondary fleet-action-driver"
                    disabled={busy}
                    onClick={() => void unassignDriver(v)}
                  >
                    {messages.desaffecterLeChauffeur}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
      />
      {editing && (
        <Modal titleId="vehicle-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save} key={editing.id}>
            <h2 id="vehicle-title">{messages.ficheVehicule}</h2>
            <div
              className="vehicle-image-preview"
              aria-label={messages.apercuImageVehicule}
              style={previewImage ? { backgroundImage: `url("${previewImage}")` } : undefined}
            />
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
            <div className="field-pair">
              <div>
                <label htmlFor="vehicle-image">{messages.imageExterieure}</label>
                <input
                  id="vehicle-image"
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required={isNewVehicle}
                  onChange={(event) => {
                    void dataUrl(event.currentTarget.files?.item(0) ?? null, '')
                      .then(setImagePreview)
                      .catch(() => setError(messages.imageTropVolumineuse));
                  }}
                />
              </div>
              <div>
                <label htmlFor="vehicle-interior">{messages.imageInterieure}</label>
                <input
                  id="vehicle-interior"
                  name="interior"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                />
              </div>
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
      {deactivating && (
        <ConfirmationDialog
          titleId="deactivate-vehicle-title"
          eyebrow={messages.retirerDuSite}
          title={messages.confirmerLeRetraitDuVehicule(deactivating.name)}
          description={messages.retraitVehiculeExplication}
          confirmLabel={messages.retirerDuSite}
          busy={busy}
          error={error}
          onConfirm={() => void deactivate()}
          onClose={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}
