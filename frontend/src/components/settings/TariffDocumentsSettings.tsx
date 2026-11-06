import { useState } from 'react';
import type { Catalogue } from '../../domain/model';
import { exportTariffDocument } from '../../adapters/tariff-documents';
import { useApp } from '../../application/context';

export function TariffDocumentsSettings({ catalogue }: { catalogue: Catalogue }) {
  const { api } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function exportPdf(kind: 'client' | 'agent', share: boolean) {
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
  return (
    <section className="reference-settings-wide reference-settings-card reference-tariff-documents">
      <div>
        <h3>Grille tarifaire client</h3>
        <p>PDF généré à partir des tarifs actuels enregistrés dans la base de données.</p>
        <div className="reference-tariff-actions">
          <button type="button" disabled={busy} onClick={() => void exportPdf('client', false)}>
            Télécharger le PDF
          </button>
          <button type="button" disabled={busy} onClick={() => void exportPdf('client', true)}>
            Partager
          </button>
        </div>
      </div>
      <div>
        <h3>Guide tarifaire pour agent IA</h3>
        <p>
          Formules, véhicules, transport, manœuvres, menuiserie, location et règles de calcul issus
          des paramètres enregistrés.
        </p>
        <div className="reference-tariff-actions">
          <button type="button" disabled={busy} onClick={() => void exportPdf('agent', false)}>
            Télécharger le PDF
          </button>
          <button type="button" disabled={busy} onClick={() => void exportPdf('agent', true)}>
            Partager
          </button>
        </div>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
