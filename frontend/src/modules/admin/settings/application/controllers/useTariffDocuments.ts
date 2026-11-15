import { useState } from 'react';
import type { Catalogue } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';

export function useTariffDocuments(catalogue: Catalogue) {
  const { api, exportTariffDocument, showSuccessToast, showErrorToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function exportDocument(kind: 'client' | 'agent', share: boolean) {
    setBusy(true);
    setError('');
    try {
      const tollPoints = kind === 'agent' ? await api.tollPoints() : [];
      await exportTariffDocument(catalogue, kind, share, tollPoints);
      showSuccessToast(kind === 'client' ? 'Grille tarifaire prête.' : 'Guide tarifaire prêt.');
    } catch {
      const message = 'Le document tarifaire n’a pas pu être généré.';
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, exportDocument };
}
