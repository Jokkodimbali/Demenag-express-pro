import { UserRoundPlus } from 'lucide-react';
import { useDrivers } from '../application/controllers/useDrivers';
import { usePagination } from '../application/usePagination';
import { messages } from '../content/fr';
import { pageSizes } from '../config/pagination';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

export function DriverManagement() {
  const { catalogue, drivers, editing, setEditing, busy, error, create, save } = useDrivers();
  const pagination = usePagination(drivers, pageSizes.drivers);
  if (!catalogue) return null;
  return (
    <section className="panel driver-management">
      <div className="section-heading">
        <div>
          <h2>{messages.chauffeurs}</h2>
          <p>{messages.affectezUnChauffeurParVehicule}</p>
        </div>
        <button className="button primary" onClick={create}>
          <UserRoundPlus size={17} />
          {messages.ajouterUnChauffeur}
        </button>
      </div>
      <div className="driver-list">
        {pagination.rows.map((driver) => (
          <button className="driver-row" key={driver.id} onClick={() => setEditing(driver)}>
            <span>
              <strong>{driver.name}</strong>
              <small>{driver.phone}</small>
            </span>
            <span>
              {catalogue.vehicles.find((vehicle) => vehicle.id === driver.vehicleId)?.name ??
                messages.nonAffecte}
            </span>
          </button>
        ))}
      </div>
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
      />
      {editing && (
        <Modal titleId="driver-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <h2 id="driver-title">{messages.ficheChauffeur}</h2>
            <div className="field-pair">
              <div>
                <label htmlFor="driver-name">{messages.nom}</label>
                <input
                  id="driver-name"
                  name="name"
                  defaultValue={editing.name}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
              <div>
                <label htmlFor="driver-phone">{messages.telephone}</label>
                <input
                  id="driver-phone"
                  name="phone"
                  type="tel"
                  defaultValue={editing.phone}
                  minLength={9}
                  maxLength={25}
                  required
                />
              </div>
            </div>
            <label htmlFor="driver-photo">{messages.photoDeProfil}</label>
            <input
              id="driver-photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required={!editing.userId}
            />
            {!editing.userId && (
              <>
                <label htmlFor="driver-password">{messages.motDePasseInitial}</label>
                <input
                  id="driver-password"
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </>
            )}
            <label htmlFor="driver-vehicle">{messages.vehiculeAffecte}</label>
            <select id="driver-vehicle" name="vehicleId" defaultValue={editing.vehicleId ?? ''}>
              <option value="">{messages.nonAffecte}</option>
              {catalogue.vehicles.map((vehicle) => (
                <option value={vehicle.id} key={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
            <label className="checkbox-label">
              <input type="checkbox" name="active" defaultChecked={editing.active} />
              {messages.labelActif}
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
                onClick={() => setEditing(null)}
                disabled={busy}
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
    </section>
  );
}
