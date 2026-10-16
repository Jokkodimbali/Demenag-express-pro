import { useEffect, useState } from 'react';
import type { User } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { userFromForm } from '../validation/forms';
export function useUsers() {
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
      .catch((e: unknown) => {
        if (alive) setError(errorMessage(e));
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
    const value = userFromForm(data);
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
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return {
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
  };
}
