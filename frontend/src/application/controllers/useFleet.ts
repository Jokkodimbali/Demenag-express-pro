import { useState } from 'react';
import { messages } from '../../content/fr';
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
    setBusy(true);
    setError('');
    try {
      const value = await vehicleFromForm(data, editing);
      setCatalogue(await new CatalogueService(api).saveVehicle(catalogue, value));
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(vehicle: Vehicle) {
    if (busy || !window.confirm(messages.retirerLeVehicule(vehicle.name))) return;
    setBusy(true);
    setError('');
    try {
      setCatalogue(await new CatalogueService(api).removeVehicle(vehicle.id));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return { catalogue, editing, setEditing, busy, error, setError, save, remove };
}
