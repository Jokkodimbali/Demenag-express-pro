import { useState } from 'react';
import type { Vehicle } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { vehicleFromForm } from '../validation/forms';
import { CatalogueService } from '../services/catalogue';
export function useFleet() {
  const { api, catalogue, setCatalogue } = useApp();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue || !editing || busy) return;
    const data = new FormData(e.currentTarget);
    const value = vehicleFromForm(data, editing);
    setBusy(true);
    setError('');
    try {
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, value));
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { catalogue, editing, setEditing, busy, error, setError, save };
}
