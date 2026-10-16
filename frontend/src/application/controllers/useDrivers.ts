import { useEffect, useState } from 'react';
import type { Driver } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { driverFromForm } from '../validation/forms';

export function useDrivers() {
  const { api, catalogue } = useApp();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api
      .drivers()
      .then((value) => active && setDrivers(value))
      .catch((reason: unknown) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [api]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const driver = await driverFromForm(form, editing);
      const saved = editing.userId
        ? await api.updateDriver(driver)
        : await api.createDriver({ ...driver, password: String(form.get('password')) });
      setDrivers((values) =>
        values.some((value) => value.id === saved.id)
          ? values.map((value) => (value.id === saved.id ? saved : value))
          : [...values, saved],
      );
      setEditing(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  function create() {
    setError('');
    setEditing({
      id: '',
      userId: null,
      name: '',
      phone: '',
      photo: null,
      active: true,
      vehicleId: null,
    });
  }
  return { catalogue, drivers, editing, setEditing, busy, error, create, save };
}
