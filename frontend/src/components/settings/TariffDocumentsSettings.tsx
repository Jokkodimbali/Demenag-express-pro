import { visibleUiText } from '../../content/visible-ui-text';
import type { Catalogue } from '../../domain/model';
import { useTariffDocuments } from '../../application/controllers/useTariffDocuments';

export function TariffDocumentsSettings({ catalogue }: { catalogue: Catalogue }) {
  const { busy, message, exportDocument } = useTariffDocuments(catalogue);
  return (
    <section className="reference-settings-wide reference-settings-card reference-tariff-documents">
      <div>
        <h3>{visibleUiText.text193}</h3>
        <p>{visibleUiText.text194}</p>
        <div className="reference-tariff-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportDocument('client', false)}
          >
            {visibleUiText.text195}
          </button>
          <button type="button" disabled={busy} onClick={() => void exportDocument('client', true)}>
            {visibleUiText.text196}
          </button>
        </div>
      </div>
      <div>
        <h3>{visibleUiText.text197}</h3>
        <p>{visibleUiText.text198}</p>
        <div className="reference-tariff-actions">
          <button type="button" disabled={busy} onClick={() => void exportDocument('agent', false)}>
            {visibleUiText.pricingAgentDownload}
          </button>
          <button type="button" disabled={busy} onClick={() => void exportDocument('agent', true)}>
            {visibleUiText.text196}
          </button>
        </div>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
