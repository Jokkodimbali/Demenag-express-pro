import { Check, Play, Truck } from 'lucide-react';
import { useState } from 'react';
import type { Booking } from '../domain/model';
import { useApp } from '../application/context';
import { PhotoPicker } from './PhotoPicker';

async function compressPhoto(file: File): Promise<string> {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (image) => (image ? resolve(image) : reject(new Error('Impossible de traiter cette photo.'))),
      'image/jpeg',
      0.72,
    ),
  );
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Photo invalide.'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function DriverCourseActions({
  booking,
  onChange,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
}) {
  const { api } = useApp();
  const [mode, setMode] = useState<'loading' | 'unloading' | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trips = booking.trips ?? [];
  const openTrip = [...trips].reverse().find((trip) => !trip.finishedAt);
  const nextSequence = trips.length + 1;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mode || !photos.length || busy) return;
    setBusy(true);
    setError('');
    try {
      const encoded = await Promise.all(photos.map(compressPhoto));
      const updated =
        mode === 'loading'
          ? await api.startBookingTrip(booking.id, encoded)
          : await api.finishBookingTrip(booking.id, encoded);
      onChange(updated);
      setPhotos([]);
      setMode(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'La preuve photo n’a pas pu être envoyée.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function signalFinished() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api.finishDriverWork(booking.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le signalement n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  }

  if (
    booking.status === 'completed' ||
    booking.status === 'cancelled' ||
    booking.status === 'pending'
  )
    return null;
  return (
    <section className="driver-course-panel">
      <div className="driver-course-heading">
        <strong>
          <Truck size={17} /> Courses effectuées : {trips.length}
        </strong>
      </div>
      {booking.driverFinishedAt ? (
        <p className="driver-course-complete" role="status">
          <Check size={16} /> Fin signalée à l’administration pour {trips.length}{' '}
          aller(s)-retour(s). En attente de vérification et clôture.
        </p>
      ) : booking.status === 'in_progress' && !openTrip && trips.length > 0 ? (
        <button
          className="button secondary small"
          type="button"
          disabled={busy}
          onClick={() => void signalFinished()}
        >
          <Check size={16} /> Signaler la fin des courses à l’administration
        </button>
      ) : booking.status === 'confirmed' || (booking.status === 'in_progress' && !openTrip) ? (
        <button
          className="button primary small"
          type="button"
          onClick={() => {
            setPhotos([]);
            setError('');
            setMode('loading');
          }}
        >
          <Play size={16} />{' '}
          {trips.length ? `Démarrer la course ${nextSequence}` : 'Démarrer la mission · course 1'}
        </button>
      ) : openTrip ? (
        <button
          className="button primary small"
          type="button"
          onClick={() => {
            setPhotos([]);
            setError('');
            setMode('unloading');
          }}
        >
          <Check size={16} /> Terminer la course {openTrip.sequence}
        </button>
      ) : null}
      {mode && (
        <form className="driver-course-form" onSubmit={(event) => void submit(event)}>
          <h4>
            {mode === 'loading'
              ? `Preuve de chargement · course ${nextSequence}`
              : `Preuve de déchargement · course ${openTrip?.sequence}`}
          </h4>
          <p>
            {mode === 'loading'
              ? 'Prenez au moins une photo des colis chargés avant le départ.'
              : 'Prenez au moins une photo des colis déchargés pour terminer cette course.'}
          </p>
          <PhotoPicker
            label="Photos de preuve (1 à 5)"
            files={photos}
            required
            onChange={setPhotos}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="driver-course-form-actions">
            <button
              className="button primary small"
              type="submit"
              disabled={busy || !photos.length}
            >
              {busy
                ? 'Envoi…'
                : mode === 'loading'
                  ? 'Enregistrer et démarrer'
                  : 'Enregistrer et terminer la course'}
            </button>
            <button
              className="button secondary small"
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(null);
                setPhotos([]);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && !mode && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
