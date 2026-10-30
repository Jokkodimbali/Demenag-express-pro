import { uiText } from '../../content/reference-ui-text';
import { useEffect, useState } from 'react';
import { useApp } from '../../application/context';
import { useEmployeeCommands } from '../../application/controllers/useEmployeeCommands';
import { showHeaderSuccess } from '../../application/header-notice';
import { errorMessage } from '../../application/error-message';
import type { VehicleInspection } from '../../application/ports';
import type { Driver } from '../../domain/model';
import { PhotoPicker } from '../PhotoPicker';
import { employeeDate, employeePhoto } from './photos';
const checks = [
  ['engineOil', 'Niveau d’huile'],
  ['brakeFluid', 'Liquide de frein'],
  ['coolant', 'Liquide de refroidissement'],
  ['washerFluid', 'Lave-glace'],
  ['fuel', 'Niveau d’essence'],
] as const;
type Item = { image?: string; ok?: boolean };
export function EmployeeVehicleCheck({
  profile,
  onView,
}: {
  profile: Driver;
  onView: (src: string) => void;
}) {
  const { catalogue } = useApp();
  const { submitInspection, driverReports } = useEmployeeCommands();
  const vehicles = (catalogue?.vehicles ?? []).filter(
    (v) => !profile.authorizedVehicleIds?.length || profile.authorizedVehicleIds.includes(v.id),
  );
  const [selected, setSelected] = useState('');
  const vehicleId = vehicles.some((v) => v.id === selected) ? selected : (vehicles[0]?.id ?? '');
  const [items, setItems] = useState<Record<string, Item>>({});
  const [photoFiles, setPhotoFiles] = useState<Record<string, File[]>>({});
  const [reports, setReports] = useState<VehicleInspection[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    driverReports()
      .then((r) => {
        if (active) setReports(r.inspections);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [driverReports]);
  function update(key: string, patch: Item) {
    setItems((old) => ({ ...old, [key]: { ...old[key], ...patch } }));
    setError('');
  }
  async function photo(key: string, file?: File) {
    if (!file) return;
    try {
      update(key, { image: await employeePhoto(file) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function submit() {
    if (busy) return;
    const missing = checks.filter(
      ([key]) => !items[key]?.image || typeof items[key]?.ok !== 'boolean',
    );
    if (missing.length) {
      setError(`À compléter : ${missing.map(([, label]) => label.toLowerCase()).join(', ')}.`);
      return;
    }
    if (!vehicleId) {
      setError('Sélectionnez un véhicule.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const report = await submitInspection({
        vehicleId,
        items: Object.fromEntries(
          checks.map(([key]) => [key, { image: items[key].image!, ok: items[key].ok! }]),
        ),
      });
      setReports((old) => [report, ...old]);
      setItems({});
      setPhotoFiles({});
      showHeaderSuccess('Contrôle technique enregistré.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="employee-panel">
      <h2>{uiText['controleTECHNIQUEDUVEHICULE']}</h2>
      <div className="employee-actions">
        {vehicles.map((v) => (
          <button
            key={v.id}
            className={`employee-pill ${v.id === vehicleId ? 'selected' : ''}`}
            aria-pressed={v.id === vehicleId}
            disabled={busy}
            onClick={() => setSelected(v.id)}
          >
            {v.name}
          </button>
        ))}
      </div>
      <div className="employee-check-grid">
        {checks.map(([key, label]) => (
          <div className="employee-check" key={key}>
            <strong>{label}</strong>
            <PhotoPicker
              label={`Photo · ${label}`}
              files={photoFiles[key] ?? []}
              maxPhotos={1}
              disabled={busy}
              cameraButtonLabel="Activer la caméra"
              importButtonLabel="Importer une photo"
              onChange={(files) => {
                setPhotoFiles((current) => ({ ...current, [key]: files }));
                if (files[0]) void photo(key, files[0]);
                else update(key, { image: undefined });
              }}
            />
            {items[key]?.image ? (
              <button className="employee-enlarge" onClick={() => onView(items[key].image!)}>
                {uiText['agrandir']}
              </button>
            ) : null}
            <div className="employee-check-status">
              {[true, false].map((ok) => (
                <button
                  key={String(ok)}
                  className={`${ok ? 'good' : 'bad'} ${items[key]?.ok === ok ? 'selected' : ''}`}
                  aria-pressed={items[key]?.ok === ok}
                  disabled={busy}
                  onClick={() => update(key, { ok })}
                >
                  {ok ? 'Bon' : 'Pas bon'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error ? (
        <p className="employee-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="employee-submit" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Enregistrement…' : 'Enregistrer le contrôle'}
      </button>
      {reports.length ? (
        <div className="employee-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{uiText['date']}</th>
                <th>{uiText['vehicule']}</th>
                {checks.map(([key, label]) => (
                  <th key={key}>{label.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{employeeDate(report.createdAt)}</td>
                  <td>{report.vehicleName}</td>
                  {checks.map(([key], index) => {
                    const legacy = !('fuel' in report.levels);
                    const photoIndex = legacy
                      ? { engineOil: 0, brakeFluid: 2, coolant: 1, washerFluid: 4, fuel: -1 }[key]
                      : index;
                    const image = report.photos[photoIndex];
                    return (
                      <td key={key}>
                        <div className="employee-history-cell">
                          {image ? (
                            <button className="employee-thumbnail" onClick={() => onView(image)}>
                              <img src={image} alt={key} />
                            </button>
                          ) : null}
                          <span
                            className={
                              report.levels[key] === 'good' ? 'employee-good' : 'employee-bad'
                            }
                          >
                            {report.levels[key]
                              ? report.levels[key] === 'good'
                                ? 'Bon'
                                : 'Pas bon'
                              : '—'}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
