import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import type { Booking } from '../domain/model';

type TrashedBooking = { booking: Booking; deletedAt: string };

export function AdminData() {
  const { api, requestConfirmation } = useApp();
  const [items, setItems] = useState<TrashedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api.trashedBookings());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function restore(id: string) {
    setBusy(id);
    setError('');
    try {
      await api.restoreBooking(id);
      setItems((current) => current.filter((item) => item.booking.id !== id));
      setNotice('Réservation restaurée.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy('');
    }
  }

  async function purge(item: TrashedBooking) {
    const confirmed = await requestConfirmation({
      titleId: 'purge-booking-title',
      eyebrow: 'SUPPRESSION DÉFINITIVE',
      title: 'Supprimer définitivement ?',
      description: `${item.booking.reference} · ${item.booking.customerName} sera effacée pour toujours. Cette action est irréversible.`,
      confirmLabel: 'Supprimer définitivement',
    });
    if (!confirmed) return;
    setBusy(item.booking.id);
    setError('');
    try {
      await api.purgeBooking(item.booking.id);
      setItems((current) => current.filter((entry) => entry.booking.id !== item.booking.id));
      setNotice('Supprimé définitivement.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="admin-data-page">
      <div className="admin-data-intro">
        <h2>Données et sauvegarde</h2>
        <p>
          Rien n’est effacé sans votre décision : toute suppression passe par la corbeille. Seul «
          Supprimer définitivement » efface pour de bon.
        </p>
      </div>
      <div className="admin-data-card">
        <h3>Corbeille · {items.length}</h3>
        {loading && <p role="status">Chargement de la corbeille…</p>}
        {!loading && !items.length && <p>La corbeille est vide.</p>}
        {items.map((item) => (
          <article key={item.booking.id} className="admin-data-trash-item">
            <div>
              <strong>
                {item.booking.reference} · {item.booking.customerName}
              </strong>
              <span>
                {item.booking.fromAddress || '—'} → {item.booking.toAddress || '—'}
              </span>
              <small>Supprimé le {new Date(item.deletedAt).toLocaleString('fr-FR')}</small>
            </div>
            <div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void restore(item.booking.id)}
              >
                Restaurer
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void purge(item)}>
                Supprimer définitivement
              </button>
            </div>
          </article>
        ))}
      </div>
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
