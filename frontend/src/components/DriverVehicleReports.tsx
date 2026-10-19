import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Send, Wrench } from 'lucide-react';
import { useApp } from '../application/context';
import type { VehicleReports } from '../application/ports';
import { errorMessage } from '../application/error-message';
import { dataUrl } from '../application/validation/forms';
import { showHeaderSuccess } from '../application/header-notice';
import { PhotoPicker } from './PhotoPicker';

const fluidItems = [
  ['engineOil', 'Huile moteur'],
  ['coolant', 'Liquide de refroidissement'],
  ['brakeFluid', 'Liquide de frein'],
  ['powerSteering', 'Direction assistée'],
  ['washerFluid', 'Lave-glace'],
] as const;
const todayDakar = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export function DriverVehicleReports() {
  const { api } = useApp();
  const [reports, setReports] = useState<VehicleReports>({ inspections: [], breakdowns: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, File[]>>(() =>
    Object.fromEntries([...fluidItems.map(([key]) => key), 'condition'].map((key) => [key, []])),
  );
  const [breakdownPhotos, setBreakdownPhotos] = useState<File[]>([]);
  const inspectedToday = reports.inspections.some(
    (report) => report.date === todayDakar() && report.photos.length === 6,
  );
  useEffect(() => {
    let active = true;
    api
      .driverReports()
      .then((value) => active && setReports(value))
      .catch((reason: unknown) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [api]);
  async function filesToDataUrls(files: File[]) {
    const selected = files;
    return Promise.all(
      selected.map(async (file) => {
        if (file.size <= 400_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
          return dataUrl(file, '');
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Impossible de préparer cette photo.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const compressed = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error('Impossible de préparer cette photo.')),
            'image/jpeg',
            0.72,
          ),
        );
        if (compressed.size > 650_000)
          throw new Error('La photo est trop volumineuse après compression.');
        return dataUrl(new File([compressed], 'preuve.jpg', { type: 'image/jpeg' }), '');
      }),
    );
  }
  async function submitInspection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const validation: Record<string, string> = {};
    for (const [key] of fluidItems)
      if (!['good', 'low', 'empty'].includes(String(form.get(key))))
        validation[key] = 'Choisissez un niveau.';
    if (!['good', 'attention', 'unsafe'].includes(String(form.get('condition'))))
      validation.condition = 'Indiquez l’état du véhicule.';
    if (String(form.get('notes')).length > 1500)
      validation.notes = 'Les observations ne peuvent pas dépasser 1 500 caractères.';
    for (const [key, label] of [...fluidItems, ['condition', 'État général'] as const]) {
      if (!inspectionPhotos[key]?.length)
        validation[`${key}Photo`] = `Ajoutez la photo de preuve : ${label.toLowerCase()}.`;
    }
    setFieldErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    setError('');
    try {
      const levels = Object.fromEntries(
        fluidItems.map(([key]) => [key, String(form.get(key))]),
      ) as Record<string, 'good' | 'low' | 'empty'>;
      const encoded = await filesToDataUrls([
        ...fluidItems.map(([key]) => inspectionPhotos[key][0]),
        inspectionPhotos.condition[0],
      ]);
      const photos = {
        engineOil: encoded[0],
        coolant: encoded[1],
        brakeFluid: encoded[2],
        powerSteering: encoded[3],
        washerFluid: encoded[4],
        condition: encoded[5],
      };
      const report = await api.submitVehicleInspection({
        levels,
        condition: String(form.get('condition')) as 'good' | 'attention' | 'unsafe',
        notes: String(form.get('notes')),
        photos,
      });
      setReports((current) => ({ ...current, inspections: [report, ...current.inspections] }));
      showHeaderSuccess('Contrôle envoyé à l’administration.');
      setInspectionPhotos(
        Object.fromEntries(
          [...fluidItems.map(([key]) => key), 'condition'].map((key) => [key, []]),
        ),
      );
      formElement.reset();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  function captureLocation() {
    setFieldErrors((current) => ({ ...current, location: '' }));
    if (!navigator.geolocation) {
      setFieldErrors((current) => ({
        ...current,
        location: 'La géolocalisation n’est pas disponible sur cet appareil.',
      }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setFieldErrors((current) => ({ ...current, location: '' }));
      },
      () =>
        setFieldErrors((current) => ({
          ...current,
          location: 'Position inaccessible. Autorisez la géolocalisation puis réessayez.',
        })),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function submitBreakdown(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const description = String(form.get('description')).trim();
    const validation: Record<string, string> = {};
    if (description.length < 5)
      validation.description = 'Décrivez la panne en au moins 5 caractères.';
    if (description.length > 1500)
      validation.description = 'La description ne peut pas dépasser 1 500 caractères.';
    if (!location)
      validation.location = 'Partagez votre position pour aider l’administration à vous localiser.';
    setFieldErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    setError('');
    try {
      const currentLocation = location;
      if (!currentLocation) return;
      const report = await api.reportBreakdown({
        description: String(form.get('description')),
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
        photos: await filesToDataUrls(breakdownPhotos),
      });
      setReports((current) => ({ ...current, breakdowns: [report, ...current.breakdowns] }));
      showHeaderSuccess('Signalement de panne envoyé à l’administration.');
      setBreakdownPhotos([]);
      formElement.reset();
      setLocation(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="vehicle-report-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SÉCURITÉ DU VÉHICULE</p>
          <h2>Contrôle avant départ</h2>
          <p>Effectuez le contrôle chaque jour avant de commencer vos missions.</p>
        </div>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="panel loading">Chargement de vos contrôles…</p>
      ) : inspectedToday ? (
        <div className="alert success">
          <CheckCircle2 size={18} /> Contrôle du jour déjà transmis. Merci.
        </div>
      ) : (
        <form className="panel vehicle-report-form" onSubmit={submitInspection} noValidate>
          <p className="muted">
            Joignez une photo distincte pour chacun des cinq niveaux et une photo de l’état général
            : six preuves obligatoires chaque matin.
          </p>
          <div className="fluid-level-grid">
            {fluidItems.map(([key, label]) => (
              <div className="fluid-check-item" key={key}>
                <label>
                  {label}
                  <select
                    name={key}
                    defaultValue="good"
                    aria-invalid={!!fieldErrors[key]}
                    aria-describedby={fieldErrors[key] ? `${key}-error` : undefined}
                    onChange={() => setFieldErrors((current) => ({ ...current, [key]: '' }))}
                  >
                    <option value="good">Bon niveau</option>
                    <option value="low">Niveau bas</option>
                    <option value="empty">Vide / à compléter</option>
                  </select>
                  {fieldErrors[key] && (
                    <small id={`${key}-error`} className="field-error">
                      {fieldErrors[key]}
                    </small>
                  )}
                </label>
                <PhotoPicker
                  label={`Preuve photo · ${label.toLowerCase()}`}
                  files={inspectionPhotos[key]}
                  maxPhotos={1}
                  required
                  validationError={fieldErrors[`${key}Photo`]}
                  onChange={(files) => {
                    setInspectionPhotos((current) => ({ ...current, [key]: files }));
                    if (files.length)
                      setFieldErrors((current) => ({ ...current, [`${key}Photo`]: '' }));
                  }}
                />
              </div>
            ))}
          </div>
          <div className="fluid-check-item">
            <label>
              État général du véhicule
              <select
                name="condition"
                defaultValue="good"
                aria-invalid={!!fieldErrors.condition}
                aria-describedby={fieldErrors.condition ? 'condition-error' : undefined}
                onChange={() => setFieldErrors((current) => ({ ...current, condition: '' }))}
              >
                <option value="good">Bon état, véhicule sûr</option>
                <option value="attention">Anomalie à surveiller</option>
                <option value="unsafe">Véhicule dangereux, ne pas rouler</option>
              </select>
              {fieldErrors.condition && (
                <small id="condition-error" className="field-error">
                  {fieldErrors.condition}
                </small>
              )}
            </label>
            <PhotoPicker
              label="Preuve photo · état général"
              files={inspectionPhotos.condition}
              maxPhotos={1}
              required
              validationError={fieldErrors.conditionPhoto}
              onChange={(files) => {
                setInspectionPhotos((current) => ({ ...current, condition: files }));
                if (files.length) setFieldErrors((current) => ({ ...current, conditionPhoto: '' }));
              }}
            />
          </div>
          <label>
            Observations
            <textarea
              name="notes"
              maxLength={1500}
              rows={3}
              placeholder="Dégâts, bruit inhabituel, voyant allumé…"
              aria-invalid={!!fieldErrors.notes}
              aria-describedby={fieldErrors.notes ? 'notes-error' : undefined}
              onChange={() => setFieldErrors((current) => ({ ...current, notes: '' }))}
            />
            {fieldErrors.notes && (
              <small id="notes-error" className="field-error">
                {fieldErrors.notes}
              </small>
            )}
          </label>
          <button className="button primary" disabled={busy}>
            <Send size={16} />
            {busy ? 'Envoi…' : 'Envoyer mon contrôle'}
          </button>
        </form>
      )}
      <form
        className="panel vehicle-report-form breakdown-form"
        onSubmit={submitBreakdown}
        noValidate
      >
        <h3>
          <AlertTriangle size={20} /> Signaler une panne
        </h3>
        <p>
          En cas de panne, transmettez les détails et votre position pour que l’administration
          puisse vous assister.
        </p>
        <label>
          Description de la panne
          <textarea
            name="description"
            maxLength={1500}
            rows={3}
            placeholder="Décrivez le problème et votre situation…"
            aria-invalid={!!fieldErrors.description}
            aria-describedby={fieldErrors.description ? 'description-error' : undefined}
            onChange={() => setFieldErrors((current) => ({ ...current, description: '' }))}
          />
          {fieldErrors.description && (
            <small id="description-error" className="field-error">
              {fieldErrors.description}
            </small>
          )}
        </label>
        <div className="location-field">
          <button type="button" className="button secondary" onClick={captureLocation}>
            <MapPin size={17} />
            {location
              ? `Position capturée (${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`
              : 'Partager ma position actuelle'}
          </button>
          {fieldErrors.location && (
            <small className="field-error" role="alert">
              {fieldErrors.location}
            </small>
          )}
        </div>
        <PhotoPicker
          label="Photos de la panne (facultatif, jusqu’à 5)"
          files={breakdownPhotos}
          onChange={setBreakdownPhotos}
        />
        <button className="button danger" disabled={busy}>
          <Wrench size={16} />
          {busy ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </form>
    </section>
  );
}
