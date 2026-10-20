import { Search, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAdministration } from '../application/controllers/useAdministration';
import { normalizedClientPhone, summarizeClients } from '../application/services/client-summary';
import { usePagination } from '../application/usePagination';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';

export function AdminClients() {
  const { bookings, loading, error } = useAdministration();
  const [query, setQuery] = useState('');
  const clients = useMemo(() => summarizeClients(bookings), [bookings]);
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
          <strong>{loading ? '—' : clients.length}</strong>
        </div>
        <div>
          <span>{messages.reservationsEffectuees}</span>
          <strong>{loading ? '—' : totalBookings}</strong>
        </div>
      </div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
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
      {loading ? (
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
    </div>
  );
}
