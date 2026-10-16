import { useState } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { catalogueFromForm } from '../validation/forms';
export function useSettings() {
  const { api, catalogue, setCatalogue } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.updateCatalogue(catalogueFromForm(form, catalogue));
      setCatalogue(updated);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { catalogue, busy, error, saved, submit };
}
