import { messages } from '../content/fr';
import { Modal } from './Modal';

export function ConfirmationDialog({
  titleId,
  eyebrow,
  title,
  description,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  titleId: string;
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal titleId={titleId} busy={busy} onClose={onClose}>
      <section className="confirmation-dialog">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {messages.annuler}
          </button>
          <button type="button" className="button primary" disabled={busy} onClick={onConfirm}>
            {busy ? messages.enregistrement : confirmLabel}
          </button>
        </div>
      </section>
    </Modal>
  );
}
