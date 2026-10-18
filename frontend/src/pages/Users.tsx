import { Pencil, Truck, UserRoundPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUsers } from '../application/controllers/useUsers';
import { usePagination } from '../application/usePagination';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Users() {
  const {
    actor,
    users,
    error,
    setError,
    loading,
    busy,
    query,
    setQuery,
    editing,
    setEditing,
    save,
  } = useUsers();
  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pagination = usePagination(filteredUsers, pageSizes.users, query);

  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h2>{messages.comptesEtAcces2}</h2>
          <p>{messages.comptesClientsAdministrateursChauffeurs}</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError('');
            setEditing('new');
          }}
        >
          <UserRoundPlus size={17} />
          {messages.creerUnCompte}
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <label htmlFor="user-search">{messages.rechercherUnCompte}</label>
      <input
        id="user-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={messages.nomOuTelephone}
      />
      {loading ? (
        <p role="status">{messages.chargement}</p>
      ) : (
        <div className="user-list">
          {pagination.rows.map((u) => (
            <div className="user-row" key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <p>
                  {u.phone} ·{' '}
                  {u.role === 'admin'
                    ? messages.labelAdministrateur
                    : u.role === 'driver'
                      ? messages.chauffeur
                      : messages.labelClient}{' '}
                  · {u.active === false ? messages.labelSuspendu : messages.labelActif}
                </p>
              </div>
              {u.role === 'driver' ? (
                <Link
                  className="button secondary small user-account-action"
                  to={routes.administrationFleet}
                  aria-label={`${messages.gererLeChauffeur} ${u.name}`}
                >
                  <Truck size={15} />
                  {messages.gererLeChauffeur}
                </Link>
              ) : (
                <button
                  className="button secondary small user-account-action"
                  onClick={() => {
                    setError('');
                    setEditing(u);
                  }}
                  aria-label={messages.modifier + u.name}
                >
                  <Pencil size={15} />
                  {messages.modifier2}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        onPageChange={pagination.setPage}
      />
      {editing && (
        <Modal titleId="account-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save} key={editing === 'new' ? 'new' : editing.id}>
            <h2 id="account-title">
              {editing === 'new' ? messages.creerUnCompte2 : messages.modifierLeCompte}
            </h2>
            <label htmlFor="account-name">{messages.nom}</label>
            <input
              id="account-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={editing === 'new' ? '' : editing.name}
            />
            <label htmlFor="account-phone">{messages.telephone}</label>
            <input
              id="account-phone"
              name="phone"
              type="tel"
              required
              defaultValue={editing === 'new' ? '' : editing.phone}
            />
            <label htmlFor="account-role">{messages.role}</label>
            <select
              id="account-role"
              name="role"
              defaultValue={editing === 'new' ? 'client' : editing.role}
            >
              {['client', 'admin'].map((role) => (
                <option key={role} value={role}>
                  {role === 'admin' ? messages.labelAdministrateur : messages.labelClient}
                </option>
              ))}
            </select>
            <label className="checkbox-label">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing === 'new' || editing.active !== false}
              />
              {messages.compteActif}
            </label>
            {editing !== 'new' && editing.id === actor?.id && (
              <p className="caption">{messages.votrePropreAccesAdministrateurDoitResterActif}</p>
            )}
            {editing === 'new' && (
              <>
                <label htmlFor="account-password">
                  {messages.motDePasseInitial10CaracteresMinimum}
                </label>
                <input
                  id="account-password"
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </>
            )}
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
