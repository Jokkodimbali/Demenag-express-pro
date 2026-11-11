import { useState } from 'react';
import type { Catalogue } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';

export function useTariffDocuments(catalogue: Catalogue) {
  const { api, exportTariffDocument } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function exportDocument(kind: 'client' | 'agent', share: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const tollPoints = kind === 'agent' ? await api.tollPoints() : [];
      await exportTariffDocument(catalogue, kind, share, tollPoints);
      setMessage(kind === 'client' ? 'Grille tarifaire prête.' : 'Guide tarifaire prêt.');
    } catch {
      setMessage('Le document tarifaire n’a pas pu être généré.');
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, exportDocument };
}
