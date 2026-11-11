import { useCallback, useEffect, useState } from 'react';
import type { Booking } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';

type TrashedBooking = { booking: Booking; deletedAt: string };

export function useAdminData() {
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

  const restore = useCallback(
    async (id: string) => {
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
    },
    [api],
  );

  const purge = useCallback(
    async (item: TrashedBooking) => {
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
    },
    [api, requestConfirmation],
  );

  return { items, loading, busy, error, notice, restore, purge };
}
