import { useEffect, useState } from 'react';
import type { Point } from '../../../../shared/domain/model';
import { useApp } from '../../../../shared/application/context';

export function useCompanyApproachDistance(
  businessLatitude: number | null | undefined,
  businessLongitude: number | null | undefined,
  clientDeparture: Point | null | undefined,
) {
  const { api } = useApp();
  const departureLatitude = clientDeparture?.[0];
  const departureLongitude = clientDeparture?.[1];
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (
      businessLatitude == null ||
      businessLongitude == null ||
      departureLatitude == null ||
      departureLongitude == null
    ) {
      setDistanceKm(null);
      setBusy(false);
      setError('');
      return () => {
        active = false;
      };
    }

    setDistanceKm(null);
    setBusy(true);
    setError('');
    void api
      .route([businessLatitude, businessLongitude], [departureLatitude, departureLongitude])
      .then((route) => {
        if (active) setDistanceKm(Math.max(0, route.distanceKm));
      })
      .catch(() => {
        if (active) setError('Distance routière entreprise → départ indisponible.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [api, businessLatitude, businessLongitude, departureLatitude, departureLongitude]);

  return { distanceKm, busy, error };
}
