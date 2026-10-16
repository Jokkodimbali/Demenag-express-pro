import { useEffect, useState } from 'react';
import { useApp } from '../application/context';
import { Modal } from '../components/Modal';
import type { User } from '../domain/model';
export function Users() {
  const { api, user: actor } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .users()
      .then((rows) => {
        if (alive) setUsers(rows);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [api]);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const value = {
      name: String(data.get('name')),
      phone: String(data.get('phone')),
      role: data.get('role') as User['role'],
      active: data.get('active') === 'on',
    };
    try {
      const updated =
        editing === 'new'
          ? await api.createUser({ ...value, password: String(data.get('password')) })
          : await api.updateUser({ ...value, id: editing.id });
      setUsers((rows) =>
        editing === 'new'
          ? [updated, ...rows]
          : rows.map((row) => (row.id === updated.id ? updated : row)),
      );
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <h2>COMPTES ET ACCÈS</h2>
          <p>Clients et administrateurs · les 500 comptes les plus récents.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setError('');
            setEditing('new');
          }}
        >
          Créer un compte
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <label htmlFor="user-search">Rechercher un compte</label>
      <input
        id="user-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nom ou téléphone"
      />
      {loading ? (
        <p role="status">Chargement…</p>
      ) : (
        <div className="user-list">
          {users
            .filter((u) => `${u.name} ${u.phone}`.toLowerCase().includes(query.toLowerCase()))
            .map((u) => (
              <div className="user-row" key={u.id}>
                <div>
                  <strong>{u.name}</strong>
                  <p>
                    {u.phone} · {u.role === 'admin' ? 'Administrateur' : 'Client'} ·{' '}
                    {u.active === false ? 'Suspendu' : 'Actif'}
                  </p>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => {
                    setError('');
                    setEditing(u);
                  }}
                  aria-label={'Modifier ' + u.name}
                >
                  Modifier
                </button>
              </div>
            ))}
        </div>
      )}
      {editing && (
        <Modal titleId="account-title" busy={busy} onClose={() => setEditing(null)}>
          <form onSubmit={save} key={editing === 'new' ? 'new' : editing.id}>
            <h2 id="account-title">
              {editing === 'new' ? 'CRÉER UN COMPTE' : 'MODIFIER LE COMPTE'}
            </h2>
            <label htmlFor="account-name">Nom</label>
            <input
              id="account-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={editing === 'new' ? '' : editing.name}
            />
            <label htmlFor="account-phone">Téléphone</label>
            <input
              id="account-phone"
              name="phone"
              type="tel"
              required
              defaultValue={editing === 'new' ? '' : editing.phone}
            />
            <label htmlFor="account-role">Rôle</label>
            <select
              id="account-role"
              name="role"
              defaultValue={editing === 'new' ? 'client' : editing.role}
            >
              {['client', 'admin'].map((role) => (
                <option key={role} value={role}>
                  {role === 'admin' ? 'Administrateur' : 'Client'}
                </option>
              ))}
            </select>
            <label className="checkbox-label">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing === 'new' || editing.active !== false}
              />
              Compte actif
            </label>
            {editing !== 'new' && editing.id === actor?.id && (
              <p className="caption">Votre propre accès administrateur doit rester actif.</p>
            )}
            {editing === 'new' && (
              <>
                <label htmlFor="account-password">
                  Mot de passe initial (10 caractères minimum)
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
