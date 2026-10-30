import { Download, X } from 'lucide-react';
import { uiText } from '../content/reference-ui-text';
import { Modal } from './Modal';

export function BookingPdfPreview({
  bookingId,
  url,
  fileName,
  busy,
  onClose,
}: {
  bookingId: string;
  url: string;
  fileName: string;
  busy: boolean;
  onClose: () => void;
}) {
  if (!url) return null;
  return (
    <Modal
      titleId={`pdf-preview-title-${bookingId}`}
      busy={busy}
      onClose={onClose}
      className="account-dialog quote-pdf-preview"
    >
      <div className="quote-pdf-preview-heading">
        <h2 id={`pdf-preview-title-${bookingId}`}>{uiText['apercuDuDevis']}</h2>
        <div className="dialog-actions">
          <a className="button primary small" href={url} download={fileName}>
            <Download size={16} /> {uiText['telechargerLePDF']}
          </a>
          <button type="button" className="button secondary small" onClick={onClose}>
            <X size={16} /> {uiText['fermer3']}
          </button>
        </div>
      </div>
      <iframe title={uiText['apercuDuDevisPDF2']} src={url} />
    </Modal>
  );
}
