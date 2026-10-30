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
  const [photoSaving, setPhotoSaving] = useState(false);
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
  async function savePhoto(file: File | null) {
    if (!profile || photoSaving) return false;
    setPhotoSaving(true);
    setError('');
    try {
      const photo = file ? await dataUrl(file, '') : null;
      const updated = await api.updateDriverPhoto(photo);
      setProfile(updated);
      if (user) setUser({ ...user, photo: updated.photo });
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setPhotoSaving(false);
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
    photoSaving,
    availabilitySaving,
    setRetry,
    savePhoto,
    saveAvailability,
  };
}
