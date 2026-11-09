import { useEffect, useState } from 'react';
import { useApp } from '../context';

export function useIntegrationSummary() {
  const { api } = useApp();
  const [claudeConnected, setClaudeConnected] = useState(false);
  const [mapsConfigured, setMapsConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([api.claudeStatus(), api.googleMapsApiKey()]).then(([claude, maps]) => {
      if (!active) return;
      if (claude.status === 'fulfilled') setClaudeConnected(claude.value.connected);
      if (maps.status === 'fulfilled') setMapsConfigured(Boolean(maps.value.trim()));
    });
    return () => { active = false; };
  }, [api]);

  return { claudeConnected, mapsConfigured, setClaudeConnected, setMapsConfigured };
}
