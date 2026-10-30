import { uiText } from '../../content/reference-ui-text';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useApp } from '../../application/context';
import { errorMessage } from '../../application/error-message';
import { vehicleFromForm } from '../../application/validation/forms';
import { CatalogueService } from '../../application/services/catalogue';
import { useBookingCommands } from '../../application/controllers/useBookingCommands';
import { messages } from '../../content/fr';
import type { Catalogue, Vehicle } from '../../domain/model';
import { vehicleCapacity } from '../../domain/vehicle-capacity';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { Modal } from '../Modal';
import { VehiclePhotoEditor } from '../VehiclePhotoEditor';

const standardIds = new Set(['sprinter', 'trafic', 'master']);

export function ReferenceVehicleSettings({ catalogue }: { catalogue: Catalogue }) {
  const { api, setCatalogue } = useApp();
  const commands = useBookingCommands();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const customVehicles = catalogue.vehicles.filter((vehicle) => !standardIds.has(vehicle.id));
  const previewVolume = editing
    ? vehicleCapacity(editing.length, editing.height, editing.width, editing.wheelWidth)
    : '';

  function addVehicle() {
    const base =
      catalogue.vehicles.find((vehicle) => vehicle.id === 'master') ?? catalogue.vehicles[0];
    if (!base) return;
    setError('');
    setNotice('');
    setEditing({
      ...base,
      id: `veh-${crypto.randomUUID().slice(0, 10)}`,
      name: '',
      shortName: '',
      length: '',
      height: '',
      width: '',
      wheelWidth: '',
      volume: '',
      image: '',
      interior: '',
      active: true,
      prices: [...base.prices],
    });
  }

  async function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const data = new FormData(event.currentTarget);
    const hasPhoto = String(data.get('image') ?? '') && String(data.get('interior') ?? '');
    const dimensions = ['length', 'height', 'width', 'wheelWidth'].map((key) =>
      Number.parseFloat(String(data.get(key)).replace(',', '.')),
    );
    if (!String(data.get('name') ?? '').trim()) return setError('Indiquez le nom du véhicule.');
    if (!dimensions.every((value) => Number.isFinite(value) && value > 0))
      return setError('Renseignez les 4 dimensions (nombres positifs).');
    if (!hasPhoto) return setError('Importez la photo de profil et la photo intérieure.');

    setBusy(true);
    setError('');
    try {
      const parsedVehicle = await vehicleFromForm(data, editing);
      const vehicle = {
        ...parsedVehicle,
        name: parsedVehicle.name.toLocaleUpperCase('fr-FR'),
        shortName:
          parsedVehicle.shortName ||
          parsedVehicle.name.trim().split(/\s+/).at(-1) ||
          parsedVehicle.name,
      };
      const wasExisting = catalogue.vehicles.some((item) => item.id === vehicle.id);
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, vehicle));
      setEditing(null);
      setNotice(
        wasExisting
          ? `${vehicle.name} modifié.`
          : `${vehicle.name} ajouté. Pensez à régler ses tarifs ci-dessus.`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeVehicle() {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    try {
      const [bookings, drivers] = await Promise.all([commands.bookings(), commands.drivers()]);
      const reservationsUsingVehicle = bookings.filter(
        (booking) => booking.vehicle.id === removing.id,
      ).length;
      if (reservationsUsingVehicle > 0) {
        setError(
          `Impossible : ce véhicule est utilisé dans ${reservationsUsingVehicle} réservation${reservationsUsingVehicle > 1 ? 's' : ''}.`,
        );
        return;
      }
      if (drivers.some((driver) => driver.vehicleId === removing.id)) {
        setError('Impossible : un membre de l’équipe est affecté à ce véhicule.');
        return;
      }
      setCatalogue(await new CatalogueService(api).removeVehicle(catalogue, removing));
      setRemoving(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="reference-settings-wide reference-settings-vehicles">
        <div className="reference-settings-section-heading">
          <span className="reference-settings-card-title">{uiText['ajouterUnVehicule']}</span>
          <span>{uiText['formatsConseillesProfil960355PxInterieur560500Px']}</span>
        </div>
        {notice && (
          <span role="status" className="reference-settings-vehicle-notice">
            {notice}
          </span>
        )}
        {customVehicles.length > 0 && (
          <div className="reference-settings-custom-vehicles">
            {customVehicles.map((vehicle) => (
              <div className="reference-settings-custom-vehicle" key={vehicle.id}>
                {vehicle.image && (
                  <img className="profile" src={vehicle.image} alt={`Profil ${vehicle.name}`} />
                )}
                {vehicle.interior && (
                  <img
                    className="interior"
                    src={vehicle.interior}
                    alt={`Intérieur ${vehicle.name}`}
                  />
                )}
                <span>{vehicle.shortName || vehicle.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setEditing(vehicle);
                  }}
                >
                  {uiText['modifier']}
                </button>
                <button type="button" className="remove" onClick={() => setRemoving(vehicle)}>
                  {uiText['supprimer']}
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="reference-settings-add-vehicle" onClick={addVehicle}>
          {uiText['ajouterUnVehicule']}
        </button>
        {error && !editing && !removing && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
      </section>

      {editing &&
        createPortal(
          <Modal
            titleId="reference-vehicle-title"
            busy={busy}
            onClose={() => !busy && setEditing(null)}
            className="account-dialog quote-dialog vehicle-editor-dialog"
          >
            <form onSubmit={saveVehicle} key={editing.id}>
              <div className="vehicle-editor-heading">
                <div>
                  <p className="eyebrow">
                    {customVehicles.some((vehicle) => vehicle.id === editing.id)
                      ? 'MODIFICATION'
                      : 'NOUVEAU VÉHICULE'}
                  </p>
                  <h2 id="reference-vehicle-title">{messages.ficheVehicule}</h2>
                  <p className="muted">
                    {uiText['completezLesDimensionsEtCliquezSurLesApercusPourImport']}
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
                <label>
                  <span>{uiText['nomDUVEHICULE']}</span>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>{uiText['nomCOURTDEVISPEAGES']}</span>
                  <input
                    name="shortName"
                    maxLength={50}
                    placeholder={uiText['exBoxer']}
                    value={editing.shortName ?? ''}
                    onChange={(event) => setEditing({ ...editing, shortName: event.target.value })}
                  />
                </label>
              </div>
              <div className="vehicle-editor-fields">
                {(
                  [
                    ['length', 'Longueur (m)'],
                    ['height', 'Hauteur (m)'],
                    ['width', 'Largeur (m)'],
                    ['wheelWidth', 'Passages de roue (m)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      name={key}
                      type="number"
                      inputMode="decimal"
                      min="0.0001"
                      step="any"
                      required
                      value={editing[key]}
                      onChange={(event) => setEditing({ ...editing, [key]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
              <input type="hidden" name="image" value={editing.image} />
              <input type="hidden" name="interior" value={editing.interior} />
              <label className="vehicle-volume-field">
                {uiText['volumeUtileCalculeAutomatiquement']}
                <input name="volumePreview" readOnly value={previewVolume} />
              </label>
              <div className="vehicle-editor-photos">
                <VehiclePhotoEditor
                  label={messages.imageExterieure}
                  value={editing.image}
                  onChange={(image) => setEditing({ ...editing, image })}
                  dimensions={{ width: 960, height: 355 }}
                  previewClassName="vehicle-profile-view"
                  measurements={[
                    {
                      className: 'vehicle-profile-measure',
                      label: `Longueur utile · ${editing.length}`,
                    },
                  ]}
                  required={!editing.image}
                />
                <VehiclePhotoEditor
                  label={messages.imageInterieure}
                  value={editing.interior}
                  onChange={(interior) => setEditing({ ...editing, interior })}
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
                  required={!editing.interior}
                />
              </div>
              <label className="checkbox-label">
                <input type="checkbox" name="active" defaultChecked={editing.active !== false} />
                {messages.disponibleALaReservation}
              </label>
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
          </Modal>,
          document.body,
        )}
      {removing &&
        createPortal(
          <ConfirmationDialog
            titleId="reference-vehicle-remove-title"
            eyebrow="Retirer du site"
            title={`Supprimer ${removing.name} ?`}
            description="Le véhicule sera rendu indisponible. Son historique de réservations restera conservé."
            confirmLabel="Supprimer"
            busy={busy}
            error={error}
            onConfirm={() => void removeVehicle()}
            onClose={() => setRemoving(null)}
          />,
          document.body,
        )}
    </>
  );
}
