import { useState } from 'react';
import { useApp } from '../../../shared/application/context';
import { errorMessage } from '../../../shared/application/error-message';
import { visibleUiText } from '../../../shared/content/visible-ui-text';

export function AssemblyResetButton({ onReset }: { onReset: () => Promise<boolean> }) {
  const { requestConfirmation } = useApp();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function reset() {
    const confirmed = await requestConfirmation({
      titleId: 'reference-assembly-reset-confirmation',
      eyebrow: visibleUiText.pricingResetConfirmEyebrow,
      title: visibleUiText.assemblyResetConfirmTitle,
      description: visibleUiText.assemblyResetConfirmDescription,
      confirmLabel: visibleUiText.assemblyResetConfirmLabel,
    });
    if (!confirmed) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      if (await onReset()) setStatus(visibleUiText.assemblyResetSuccess);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reference-settings-assembly-reset-control">
      <button type="button" disabled={busy} onClick={() => void reset()}>
        {busy ? 'Rétablissement…' : visibleUiText.assemblyResetButton}
      </button>
      {status && (
        <p role="status" className="reference-settings-reset-status">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
    </div>
  );
}
