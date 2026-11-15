import { useEffect, useState } from 'react';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';
import type { ClaudeSettingsStatus } from '../../../../shared/application/ports';
import {
  claudeApiKeyValidationError,
  claudeTestNotice,
  connectedClaudeNotice,
} from '../services/claude-settings-policy';

const disconnected: ClaudeSettingsStatus = { connected: false, model: '', models: [] };

export function useClaudeSettingsController() {
  const { api, requestConfirmation, showSuccessToast, showErrorToast } = useApp();
  const [status, setStatus] = useState<ClaudeSettingsStatus>(disconnected);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api
      .claudeStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active) setError('Impossible de lire l’état du compte Claude.');
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function connect() {
    const validationError = claudeApiKeyValidationError(key);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const connected = await api.connectClaudeKey(key.trim());
      setStatus(connected);
      setKey('');
      showSuccessToast(connectedClaudeNotice(connected));
    } catch (cause) {
      const message = `Clé refusée : ${errorMessage(cause)}`;
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError('');
    try {
      const result = await api.testClaude();
      showSuccessToast(claudeTestNotice(result.response));
    } catch (cause) {
      const message = `Échec : ${errorMessage(cause)}`;
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    const confirmed = await requestConfirmation({
      titleId: 'claude-disconnect',
      eyebrow: 'COMPTE CLAUDE',
      title: 'Déconnecter ce compte ?',
      description: 'La clé chiffrée sera retirée et les analyses Claude seront désactivées.',
      confirmLabel: 'Déconnecter',
    });
    if (!confirmed) return;
    setBusy(true);
    setError('');
    try {
      await api.disconnectClaude();
      setStatus(disconnected);
      showSuccessToast('Compte Claude déconnecté.');
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  async function selectModel(model: string) {
    setBusy(true);
    setError('');
    try {
      const selected = await api.selectClaudeModel(model);
      setStatus((current) => ({ ...current, model: selected.model, models: selected.models }));
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  }

  return { status, key, setKey, busy, error, connect, test, disconnect, selectModel };
}
