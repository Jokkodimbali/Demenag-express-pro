import { useEffect, useState } from 'react';
import type { User } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';
import { userFromForm } from '../mappers/user-from-form';
import { mergeUserDirectory } from '../services/user-directory';
export function useUsers() {
  const { api, user: actor, showSuccessToast, showErrorToast } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([api.users(), api.drivers()])
      .then(([rows, drivers]) => {
        if (!alive) return;
        setUsers(mergeUserDirectory(rows, drivers));
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
      showSuccessToast(editing === 'new' ? 'Compte créé.' : 'Compte mis à jour.');
      setEditing(null);
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }
  async function resetClientPassword(userId: string, password: string) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await api.resetClientPassword(userId, password);
      setUsers((rows) =>
        rows.map((row) => (row.id === userId ? { ...row, passwordResetRequestedAt: null } : row)),
      );
      showSuccessToast('Mot de passe client réinitialisé.');
      return true;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      showErrorToast(message);
      return false;
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
    resetClientPassword,
  };
}
