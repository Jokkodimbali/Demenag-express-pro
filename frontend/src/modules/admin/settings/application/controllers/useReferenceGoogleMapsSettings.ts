import { useEffect, useState } from 'react';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';

export function useReferenceGoogleMapsSettings() {
  const { api, showSuccessToast, showErrorToast } = useApp();
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
      showSuccessToast('Clé Google Maps enregistrée.');
      return true;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      showErrorToast(message);
      return false;
    }
  }

  return { key, setKey, error, loaded, save };
}
