import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';

export function useReferenceGoogleMapsSettings() {
  const { api } = useApp();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .googleMapsApiKey()
      .then((value) => {
        if (active) setKey(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function save(value: string) {
    try {
      await api.updateGoogleMapsApiKey(value.trim());
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return { key, setKey, error, loaded, save };
}
