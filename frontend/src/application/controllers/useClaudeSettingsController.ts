import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import type { ClaudeSettingsStatus } from '../ports';

const disconnected: ClaudeSettingsStatus = { connected: false, model: '', models: [] };

export function useClaudeSettingsController() {
  const { api, requestConfirmation } = useApp();
  const [status, setStatus] = useState<ClaudeSettingsStatus>(disconnected);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
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
    if (!/^sk-/u.test(key.trim())) {
      setError('Collez une clé API valide (elle commence par sk-).');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const connected = await api.connectClaudeKey(key.trim());
      setStatus(connected);
      setKey('');
      setNotice(
        `Compte Claude connecté${connected.model ? ` · ${connected.models.find((item) => item.id === connected.model)?.name ?? connected.model}` : ''}.`,
      );
    } catch (cause) {
      setError(`Clé refusée : ${errorMessage(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.testClaude();
      setNotice(`Claude répond : ${result.response.trim().slice(0, 20)}`);
    } catch (cause) {
      setError(`Échec : ${errorMessage(cause)}`);
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
    setNotice('');
    try {
      await api.disconnectClaude();
      setStatus(disconnected);
      setNotice('Compte Claude déconnecté.');
    } catch (cause) {
      setError(errorMessage(cause));
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
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return { status, key, setKey, busy, notice, error, connect, test, disconnect, selectModel };
}
