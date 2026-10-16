import { useEffect, useState } from 'react';
import type { Booking, Driver } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { dataUrl } from '../validation/forms';

export function useDriverWorkspace() {
  const { api } = useApp();
  const [profile, setProfile] = useState<Driver | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.driverProfile(), api.driverBookings()])
      .then(([nextProfile, nextBookings]) => {
        if (active) {
          setProfile(nextProfile);
          setBookings(nextBookings);
        }
      })
      .catch((reason: unknown) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api, retry]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const photo = await dataUrl(form.get('photo'), profile.photo ?? '');
      setProfile(
        await api.updateDriverProfile({
          name: String(form.get('name')),
          phone: String(form.get('phone')),
          photo: photo || null,
        }),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  return { profile, bookings, loading, error, saving, setRetry, save };
}
