import { Pencil, Search, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAdministration } from '../application/controllers/useAdministration';
import {
  normalizedClientPhone,
  summarizeClients,
  type ClientSummary,
} from '../application/services/client-summary';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import { usePagination } from '../application/usePagination';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';

export function AdminClients() {
  const { api } = useApp();
  const { bookings, loading, error, setRetry } = useAdministration();
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<{ phone: string; hiddenAt: string }[]>([]);
  const [hiddenLoading, setHiddenLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [editing, setEditing] = useState<ClientSummary | null>(null);
  const [removing, setRemoving] = useState<ClientSummary | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    let active = true;
    api
      .hiddenClients()
      .then((value) => {
        if (active) setHidden(value);
      })
      .catch((cause: unknown) => {
        if (active) setDirectoryError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setHiddenLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const clients = useMemo(
    () =>
      summarizeClients(bookings).filter((client) => {
        const entry = hidden.find((item) => item.phone === client.key);
        return !entry || client.latestBookingAt > entry.hiddenAt;
      }),
    [bookings, hidden],
  );
  function openEdit(client: ClientSummary) {
    setActionError('');
    setName(client.name);
    setPhone(client.phone);
    setEditing(client);
  }
  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setActionError('');
    try {
      await api.updateClient(editing.key, { name: name.trim(), phone: phone.trim() });
      setHidden(await api.hiddenClients());
      setEditing(null);
      setRetry((value) => value + 1);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function hideClient() {
    if (!removing) return;
    setBusy(true);
    setActionError('');
    try {
      const entry = await api.hideClient(removing.key);
      setHidden((value) => [...value.filter((item) => item.phone !== entry.phone), entry]);
      setRemoving(null);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const needle = query.trim().toLowerCase();
  const digits = normalizedClientPhone(query);
  const filtered = clients.filter(
    (client) =>
      `${client.name} ${client.identifier}`.toLowerCase().includes(needle) ||
      (digits.length > 0 && normalizedClientPhone(client.phone).includes(digits)),
  );
  const pagination = usePagination(filtered, pageSizes.users, query);
  const totalBookings = clients.reduce((total, client) => total + client.bookingCount, 0);

  return (
    <div className="admin-clients">
      <div className="section-heading">
        <div>
          <h2>{messages.clients}</h2>
          <p>{messages.clientsDescription}</p>
        </div>
      </div>
      <div className="stats-grid client-stats">
        <div>
          <span>{messages.clientsIdentifies}</span>
          <strong>{loading || hiddenLoading ? '—' : clients.length}</strong>
        </div>
        <div>
          <span>{messages.reservationsEffectuees}</span>
          <strong>{loading || hiddenLoading ? '—' : totalBookings}</strong>
        </div>
      </div>
      {error || directoryError ? (
        <p className="alert error" role="alert">
          {error || directoryError}
        </p>
      ) : null}
      <label className="client-search-label" htmlFor="client-search">
        {messages.rechercherUnClient}
      </label>
      <div className="search-field client-search">
        <Search size={17} />
        <input
          id="client-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.nomOuNumeroClient}
        />
      </div>
      {loading || hiddenLoading ? (
        <p className="panel loading" role="status">
          {messages.chargementDesReservations}
        </p>
      ) : pagination.rows.length ? (
        <div
          className="client-table-wrap panel"
          role="region"
          aria-label="Liste des clients, tableau défilant horizontalement"
          tabIndex={0}
        >
          <p className="client-table-scroll-hint muted">
            Faites défiler le tableau horizontalement pour voir toutes les colonnes.
          </p>
          <table className="client-table">
            <thead>
              <tr>
                <th scope="col">Identifiant</th>
                <th scope="col">Nom du client</th>
                <th scope="col">Téléphone</th>
                <th scope="col">Nombre de réservations</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.rows.map((client) => (
                <tr key={client.key}>
                  <td>
                    <span className="client-identifier">ID {client.identifier}</span>
                  </td>
                  <th scope="row" className="client-table-name">
                    {client.name}
                  </th>
                  <td className="client-phone">{client.phone}</td>
                  <td>{client.bookingCount}</td>
                  <td>
                    <div className="client-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => openEdit(client)}
                        aria-label={`Modifier ${client.name}`}
                      >
                        <Pencil size={15} /> Modifier
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setActionError('');
                          setRemoving(client);
                        }}
                        aria-label={`Retirer ${client.name} de la liste`}
                      >
                        <Trash2 size={15} /> Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state panel">
          <UsersRound size={34} />
          <h3>{needle ? messages.aucunClientTrouve : messages.aucunClient}</h3>
          <p>{messages.clientsApparaitrontApresReservation}</p>
        </div>
      )}
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
      />
      {editing && (
        <Modal titleId="edit-client-title" busy={busy} onClose={() => setEditing(null)}>
          <form className="confirmation-dialog" onSubmit={saveClient}>
            <p className="eyebrow">Liste des clients</p>
            <h2 id="edit-client-title">Modifier le client</h2>
            <p>Le nom et le téléphone seront mis à jour sur ses réservations et devis.</p>
            <label htmlFor="edit-client-name">Nom du client</label>
            <input
              id="edit-client-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
            <label htmlFor="edit-client-phone">Téléphone</label>
            <input
              id="edit-client-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              minLength={9}
              maxLength={25}
              required
            />
            {actionError && (
              <p className="alert error" role="alert">
                {actionError}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Annuler
              </button>
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {removing && (
        <ConfirmationDialog
          titleId="remove-client-title"
          eyebrow="Confirmation de suppression"
          title={`Retirer ${removing.name} de la liste ?`}
          description={`Ses ${removing.bookingCount} réservation(s) et ses devis seront conservés. Une nouvelle réservation avec ce numéro le fera réapparaître.`}
          confirmLabel="Retirer de la liste"
          busy={busy}
          error={actionError}
          onConfirm={hideClient}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
