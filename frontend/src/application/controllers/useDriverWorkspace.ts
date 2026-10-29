import { useEffect, useRef, useState } from 'react';
import type { Booking, Driver, DriverAvailabilityDay } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { dataUrl } from '../validation/forms';

export function useDriverWorkspace(loadBookings = true) {
  const { api, user, setUser } = useApp();
  const [profile, setProfile] = useState<Driver | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const pendingAvailability = useRef<DriverAvailabilityDay[] | null>(null);
  const availabilityRunning = useRef(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!loadBookings) return;
    let active = true;
    const refresh = () => {
      void api
        .driverBookings()
        .then((next) => {
          if (active) setBookings(next);
        })
        .catch(() => undefined);
    };
    window.addEventListener('demenag:notification', refresh);
    return () => {
      active = false;
      window.removeEventListener('demenag:notification', refresh);
    };
  }, [api, loadBookings]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.driverProfile(), loadBookings ? api.driverBookings() : Promise.resolve([])])
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
  }, [api, loadBookings, retry]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const photo = await dataUrl(form.get('photo'), profile.photo ?? '');
      const updated = await api.updateDriverProfile({
        name: String(form.get('name')),
        phone: String(form.get('phone')),
        photo: photo || null,
      });
      setProfile(updated);
      if (user) setUser({ ...user, name: updated.name, phone: updated.phone });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  async function saveAvailability(availability: DriverAvailabilityDay[]) {
    let confirmed = profile;
    pendingAvailability.current = availability;
    setProfile((current) => (current ? { ...current, availability } : current));
    if (availabilityRunning.current) return true;
    availabilityRunning.current = true;
    setAvailabilitySaving(true);
    setError('');
    try {
      while (pendingAvailability.current) {
        const next = pendingAvailability.current;
        pendingAvailability.current = null;
        const updated = await api.updateDriverAvailability(next);
        confirmed = updated;
        if (!pendingAvailability.current) setProfile(updated);
      }
      return true;
    } catch (reason) {
      pendingAvailability.current = null;
      setProfile(confirmed);
      setError(errorMessage(reason));
      return false;
    } finally {
      availabilityRunning.current = false;
      setAvailabilitySaving(false);
    }
  }

  return {
    profile,
    bookings,
    setBookings,
    loading,
    error,
    saving,
    availabilitySaving,
    setRetry,
    save,
    saveAvailability,
  };
}
