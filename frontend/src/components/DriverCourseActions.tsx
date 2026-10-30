import { uiText } from '../content/reference-ui-text';
import { Check, Play, Truck } from 'lucide-react';
import { useState } from 'react';
import type { Booking } from '../domain/model';
import { useBookingCommands } from '../application/controllers/useBookingCommands';
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
  adminMode = false,
}: {
  booking: Booking;
  onChange: (booking: Booking) => void;
  adminMode?: boolean;
}) {
  const commands = useBookingCommands();
  const [mode, setMode] = useState<'loading' | 'unloading' | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trips = booking.trips ?? [];
  const openTrip = [...trips].reverse().find((trip) => !trip.finishedAt);
  const nextSequence = trips.length + 1;
  const needsLoadingProof = Boolean(openTrip && !openTrip.loadingPhotos.length);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mode || (!adminMode && !photos.length) || busy) return;
    setBusy(true);
    setError('');
    try {
      const encoded = await Promise.all(photos.map(compressPhoto));
      const updated =
        mode === 'loading'
          ? await commands.startTrip(booking.id, encoded)
          : await commands.finishTrip(booking.id, encoded);
      onChange(updated);
      setPhotos([]);
      setMode(null);
    } catch (reason) {
      try {
        const refreshed = adminMode
          ? await commands.booking(booking.id)
          : (await commands.driverBookings()).find((entry) => entry.id === booking.id);
        if (!refreshed) {
          setError('La réservation n’est plus disponible.');
        } else {
          onChange(refreshed);
          const savedTrip = refreshed.trips?.find((trip) => trip.id === openTrip?.id);
          const operationAlreadyCompleted =
            (mode === 'unloading' && Boolean(savedTrip?.finishedAt)) ||
            (mode === 'loading' &&
              (openTrip
                ? Boolean(savedTrip?.loadingPhotos.length)
                : (refreshed.trips?.length ?? 0) > trips.length));
          setError(
            operationAlreadyCompleted
              ? ''
              : reason instanceof Error
                ? reason.message
                : 'La preuve photo n’a pas pu être envoyée.',
          );
        }
      } catch {
        setError(
          reason instanceof Error ? reason.message : 'La preuve photo n’a pas pu être envoyée.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function signalFinished() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await commands.finishDriverWork(booking.id));
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
          <Truck size={17} /> {uiText['coursesEffectuees']}
          {trips.length}
        </strong>
      </div>
      {booking.driverFinishedAt ? (
        <p className="driver-course-complete" role="status">
          <Check size={16} /> {uiText['finSignaleeALAdministrationPour']}
          {trips.length} {uiText['allerSRetourSEnAttenteDeVerificationEtCloture']}
        </p>
      ) : adminMode && booking.status === 'in_progress' && !openTrip && trips.length > 0 ? (
        <div className="driver-course-form-actions">
          <button
            className="button secondary small"
            type="button"
            disabled={busy}
            onClick={() => {
              setPhotos([]);
              setError('');
              setMode('loading');
            }}
          >
            <Play size={16} /> {uiText['demarrerLaCourse']}
            {nextSequence}
          </button>
          <button
            className="button primary small"
            type="button"
            disabled={busy}
            onClick={() => void signalFinished()}
          >
            <Check size={16} /> {uiText['signalerLaFinDesCourses']}
          </button>
        </div>
      ) : booking.status === 'in_progress' && !openTrip && trips.length > 0 ? (
        <button
          className="button secondary small"
          type="button"
          disabled={busy}
          onClick={() => void signalFinished()}
        >
          <Check size={16} /> {uiText['signalerLaFinDesCoursesALAdministration']}
        </button>
      ) : openTrip && needsLoadingProof && !adminMode ? (
        <button
          className="button primary small"
          type="button"
          onClick={() => {
            setPhotos([]);
            setError('');
            setMode('loading');
          }}
        >
          <Check size={16} /> {uiText['ajouterLesPreuvesDeChargementCourse']}
          {openTrip.sequence}
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
          <Check size={16} /> {uiText['terminerLaCourse']}
          {openTrip.sequence}
        </button>
      ) : null}
      {mode && (
        <form className="driver-course-form" onSubmit={(event) => void submit(event)}>
          <h4>
            {mode === 'loading'
              ? `Preuve de chargement · course ${openTrip?.sequence ?? nextSequence}`
              : `Preuve de déchargement · course ${openTrip?.sequence}`}
          </h4>
          <p>
            {mode === 'loading'
              ? adminMode
                ? 'La preuve de chargement est facultative pour l’administration.'
                : 'Prenez au moins une photo des colis chargés avant le départ.'
              : adminMode
                ? 'La preuve de déchargement est facultative pour l’administration.'
                : 'Prenez au moins une photo des colis déchargés pour terminer cette course.'}
          </p>
          <PhotoPicker
            label={adminMode ? 'Photos de preuve facultatives (1 à 5)' : 'Photos de preuve (1 à 5)'}
            files={photos}
            required={!adminMode}
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
              disabled={busy || (!adminMode && !photos.length)}
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
              {uiText['annuler']}
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
