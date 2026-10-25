import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFleet } from '../application/controllers/useFleet';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { FleetVehicleDimensions } from '../components/FleetVehicleDimensions';
import { Modal } from '../components/Modal';
import { fields } from '../content/forms/fleet';
import { messages } from '../content/fr';
import { money } from '../domain/format';
import type { Vehicle } from '../domain/model';
import { vehicleCapacity } from '../domain/vehicle-capacity';
import { VehiclePhotoEditor } from '../components/VehiclePhotoEditor';

export function Fleet() {
  const [imagePreview, setImagePreview] = useState('');
  const [interiorPreview, setInteriorPreview] = useState('');
  const [computedVolume, setComputedVolume] = useState('');
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
    saveVehicleDimensions,
    activity,
    drivers,
    selectedDriverId,
    chooseDriver,
    assignDriver,
    unassignDriver,
  } = useFleet();
  const isNewVehicle =
    editing !== null && !(catalogue?.vehicles ?? []).some((vehicle) => vehicle.id === editing.id);
  const previewImage = imagePreview || (isNewVehicle ? '' : (editing?.image ?? ''));
  const previewInterior = interiorPreview || (isNewVehicle ? '' : (editing?.interior ?? ''));
  useEffect(() => {
    if (editing)
      setComputedVolume(
        vehicleCapacity(editing.length, editing.height, editing.width, editing.wheelWidth),
      );
  }, [editing]);
  if (!catalogue) return null;
  function openVehicleEditor(vehicle: Vehicle) {
    setError('');
    setEditing(vehicle);
    setImagePreview(vehicle.image);
    setInteriorPreview(vehicle.interior);
  }
  const bookingsEnabled = catalogue.settings.bookingsEnabled !== false;
  return (
    <div className="panel fleet-page">
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
            setInteriorPreview('');
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
      <section className="fleet-dimensions-section" aria-labelledby="fleet-dimensions-title">
        <div className="fleet-dimensions-intro">
          <h3 id="fleet-dimensions-title">Dimensions des véhicules</h3>
          <p>
            Le volume utile est calculé à partir des quatre mesures : longueur × hauteur × largeur,
            moins l’espace des passages de roue, puis × 0,95 pour les parois et le toit arrondis.
            Cette valeur est utilisée dans l’estimation des allers-retours.
          </p>
        </div>
        <div className="fleet-dimensions-list">
          {catalogue.vehicles.map((vehicle) => {
            const vehicleActivity = activity(vehicle);
            const driver = drivers.find((item) => item.vehicleId === vehicle.id) ?? null;
            const selectedDriver = selectedDriverId(vehicle);
            return (
              <FleetVehicleDimensions
                key={vehicle.id}
                vehicle={vehicle}
                disabled={busy}
                onSave={saveVehicleDimensions}
                management={
                  <>
                    <div className="fleet-card-main-row">
                      <span
                        className={
                          vehicle.active !== false
                            ? 'fleet-status available'
                            : 'fleet-status unavailable'
                        }
                      >
                        {vehicle.active !== false ? messages.labelActif : messages.indisponible}
                      </span>
                      <div className="fleet-actions">
                        <button
                          className="button secondary"
                          onClick={() => openVehicleEditor(vehicle)}
                        >
                          Modifier le véhicule
                        </button>
                        <button
                          className={
                            vehicle.active !== false
                              ? 'button secondary fleet-action-toggle'
                              : 'button primary fleet-action-toggle'
                          }
                          disabled={busy}
                          onClick={() => void setVehicleAvailability(vehicle)}
                        >
                          {vehicle.active !== false
                            ? messages.rendreIndisponible
                            : messages.rendreDisponible}
                        </button>
                        <button
                          className="icon-button danger fleet-action-remove"
                          disabled={busy}
                          onClick={() => requestDeactivation(vehicle)}
                          aria-label={messages.retirerVehicule(vehicle.name)}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <details className="fleet-row-details">
                      <summary>Activité et chauffeur</summary>
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
                      <section className="fleet-driver" aria-labelledby={'driver-' + vehicle.id}>
                        <div>
                          <span id={'driver-' + vehicle.id}>{messages.chauffeurAffecte}</span>
                          <strong>{driver?.name ?? messages.nonAffecte}</strong>
                        </div>
                        <label>
                          <span>{messages.affecterLeChauffeur}</span>
                          <select
                            value={selectedDriver}
                            disabled={busy}
                            onChange={(event) => chooseDriver(vehicle, event.target.value)}
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
                        <div className="fleet-driver-actions">
                          <button
                            className="button secondary"
                            disabled={busy || !selectedDriver}
                            onClick={() => void assignDriver(vehicle)}
                          >
                            {messages.affecter}
                          </button>
                          {driver && (
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() => void unassignDriver(vehicle)}
                            >
                              {messages.desaffecterLeChauffeur}
                            </button>
                          )}
                        </div>
                        <p>{messages.changementDeChauffeur}</p>
                      </section>
                    </details>
                  </>
                }
              />
            );
          })}
        </div>
      </section>
      {error && !editing && !deactivating && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {editing && (
        <Modal
          titleId="vehicle-title"
          busy={busy}
          onClose={() => setEditing(null)}
          className="account-dialog quote-dialog vehicle-editor-dialog"
        >
          <form onSubmit={save} key={editing.id}>
            <div className="vehicle-editor-heading">
              <div>
                <p className="eyebrow">{isNewVehicle ? 'NOUVEAU VÉHICULE' : 'MODIFICATION'}</p>
                <h2 id="vehicle-title">{messages.ficheVehicule}</h2>
                <p className="muted">
                  Complétez les dimensions et cliquez directement sur les aperçus pour importer les
                  photos.
                </p>
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                {messages.fermer}
              </button>
            </div>
            <div className="vehicle-editor-fields">
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
                    onChange={
                      key === 'length' ||
                      key === 'height' ||
                      key === 'width' ||
                      key === 'wheelWidth'
                        ? (event) => {
                            const value = event.currentTarget.value;
                            const form = event.currentTarget.form;
                            if (!form) return;
                            const values = new FormData(form);
                            values.set(key, value);
                            setEditing({ ...editing, [key]: value });
                            setComputedVolume(
                              vehicleCapacity(
                                String(values.get('length')),
                                String(values.get('height')),
                                String(values.get('width')),
                                String(values.get('wheelWidth')),
                              ),
                            );
                          }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <input type="hidden" name="image" value={previewImage} />
            <input type="hidden" name="interior" value={previewInterior} />
            <label className="vehicle-volume-field">
              Volume utile calculé automatiquement
              <input name="volumePreview" readOnly value={computedVolume} />
            </label>
            <div className="vehicle-editor-photos">
              <VehiclePhotoEditor
                label={messages.imageExterieure}
                value={previewImage}
                onChange={setImagePreview}
                dimensions={{ width: 960, height: 355 }}
                previewClassName="vehicle-profile-view"
                measurements={[
                  {
                    className: 'vehicle-profile-measure',
                    label: `Longueur utile · ${editing.length}`,
                  },
                ]}
                required={isNewVehicle}
              />
              <VehiclePhotoEditor
                label={messages.imageInterieure}
                value={previewInterior}
                onChange={setInteriorPreview}
                dimensions={{ width: 560, height: 500 }}
                previewClassName="vehicle-interior-view"
                measurements={[
                  { className: 'dimension-height', label: `Hauteur · ${editing.height}` },
                  { className: 'dimension-width', label: `Largeur · ${editing.width}` },
                  {
                    className: 'dimension-wheel',
                    label: `Passage de roue · ${editing.wheelWidth}`,
                  },
                ]}
                required={isNewVehicle}
              />
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
