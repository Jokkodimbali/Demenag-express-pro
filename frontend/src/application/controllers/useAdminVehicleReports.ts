import { useEffect, useState } from 'react';
import type { VehicleReports } from '../ports';
import { errorMessage } from '../error-message';
import { useApp } from '../context';

export function useAdminVehicleReports() {
  const { api } = useApp();
  const [reports, setReports] = useState<VehicleReports>({ inspections: [], breakdowns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refreshOnReport = (event: Event) => {
      const notification = (event as CustomEvent<{ title?: string }>).detail;
      if (
        notification?.title === 'Contrôle véhicule reçu' ||
        notification?.title === 'Panne signalée'
      )
        setRetry((value) => value + 1);
    };
    window.addEventListener('demenag:notification', refreshOnReport);
    return () => window.removeEventListener('demenag:notification', refreshOnReport);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .adminVehicleReports()
      .then((value) => active && setReports(value))
      .catch((reason: unknown) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api, retry]);
  return { reports, loading, error, refresh: () => setRetry((value) => value + 1) };
}
