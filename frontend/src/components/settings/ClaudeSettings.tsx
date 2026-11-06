import { useClaudeSettingsController } from '../../application/controllers/useClaudeSettingsController';
import { referenceSettingsText as text } from '../../content/reference-settings-text';

export function ClaudeSettings() {
  const { status, key, setKey, busy, notice, error, connect, test, disconnect, selectModel } =
    useClaudeSettingsController();
  const modelName = status.models.find((item) => item.id === status.model)?.name ?? status.model;

  return (
    <section className="reference-settings-wide reference-settings-card reference-claude-settings">
      <div className="reference-settings-section-heading">
        <span className="reference-settings-card-title">{text.claudeTitle}</span>
        <span
          className={
            status.connected ? 'reference-claude-status connected' : 'reference-claude-status'
          }
        >
          {status.connected
            ? `${text.claudeConnected} · ${modelName || text.claudeNoModel}`
            : text.claudeDisconnected}
        </span>
      </div>
      <span className="reference-claude-purpose">{text.claudePurpose}</span>
      <div className="reference-claude-connect-row">
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder={
            status.connected
              ? `${text.claudeSavedKey} ${status.keyHint ?? ''}`
              : text.claudeKeyPlaceholder
          }
          aria-label={text.claudeAccessibleLabel}
        />
        <button
          type="button"
          className="reference-claude-connect"
          disabled={busy}
          onClick={() => void connect()}
        >
          {busy && !status.connected ? text.claudeConnecting : text.claudeConnect}
        </button>
        {status.connected && (
          <>
            <button
              type="button"
              className="reference-claude-secondary"
              disabled={busy}
              onClick={() => void test()}
            >
              {busy ? text.claudeChecking : text.claudeTest}
            </button>
            <button
              type="button"
              className="reference-claude-disconnect"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {text.claudeDisconnect}
            </button>
          </>
        )}
      </div>
      {status.connected && status.models.length > 0 && (
        <label className="reference-claude-model">
          {text.claudeModel}
          <select
            value={status.model}
            disabled={busy}
            onChange={(event) => {
              event.stopPropagation();
              void selectModel(event.target.value);
            }}
          >
            {status.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="reference-claude-instructions">
        <span>
          {text.claudeInstructionOne}{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            {text.claudeConsole}
          </a>
          .
        </span>
        <span>{text.claudeInstructionTwo}</span>
        <span>{text.claudeInstructionThree}</span>
      </div>
      <span className="reference-claude-security-note">{text.claudeSecurityNote}</span>
      {notice && (
        <span className="reference-claude-notice" role="status">
          {notice}
        </span>
      )}
      {error && (
        <span className="reference-claude-error" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}
