import { uiText } from '../content/reference-ui-text';
import { useState } from 'react';
import { useApp } from '../application/context';
import { useDriverWorkspace } from '../application/controllers/useDriverWorkspace';
import { useEmployeeCommands } from '../application/controllers/useEmployeeCommands';
import { showHeaderSuccess } from '../application/header-notice';
import { errorMessage } from '../application/error-message';
import type { DriverAvailabilityDay } from '../domain/model';
import { EmployeeVehicleCheck } from '../components/employee/EmployeeVehicleCheck';
import { EmployeePhotoViewer } from '../components/employee/EmployeePhotoViewer';
import { employeeDate, employeePhoto } from '../components/employee/photos';
const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const defaults = days.map((_, i) => ({ available: i < 6, startTime: '08:00', endTime: '18:00' }));
const roles = { chauffeur: 'CHAUFFEUR', menuisier: 'MENUISIER', manoeuvre: 'MANŒUVRE' };
export function DriverWorkspace() {
  const { profile, bookings, setBookings, loading, error, saveAvailability } = useDriverWorkspace();
  const { user } = useApp();
  const { addProofs } = useEmployeeCommands();
  const [photo, setPhoto] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const availability = profile?.availability?.length === 7 ? profile.availability : defaults;
  const driver = (profile?.role ?? 'chauffeur') === 'chauffeur';
  function updateDay(index: number, patch: Partial<DriverAvailabilityDay>) {
    void saveAvailability(availability.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }
  async function proofs(id: string, kind: 'retrait' | 'depot', files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const images = await Promise.all(files.map(employeePhoto));
      const updated = await addProofs(id, kind, images);
      setBookings((old) => old.map((b) => (b.id === id ? updated : b)));
      showHeaderSuccess(
        `${images.length} photo${images.length > 1 ? 's' : ''} de ${kind === 'retrait' ? 'retrait' : 'dépôt'} enregistrée${images.length > 1 ? 's' : ''}.`,
      );
    } catch (e) {
      setUploadError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="reference-employee" data-screen-label="Espace employé">
      <header>
        <span>
          {uiText['espaceEMPLOYE']}
          {profile ? ` · ${roles[profile.role ?? 'chauffeur']}` : ''}
        </span>
        <h1>{profile?.name ?? user?.name ?? ''}</h1>
      </header>
      {error || uploadError ? (
        <p role="alert" className="employee-error">
          {error || uploadError}
        </p>
      ) : null}
      {loading ? (
        <p>{uiText['chargement']}</p>
      ) : !profile ? (
        <div className="employee-panel">{uiText['ceNumeroNEstPasEnregistreDansLEquipe']}</div>
      ) : (
        <>
          <section className="employee-panel">
            <h2>{uiText['mesDISPONIBILITES']}</h2>
            <div className="employee-days">
              {availability.map((day, index) => (
                <div className="employee-day" key={days[index]}>
                  <strong>{days[index]}</strong>
                  <button
                    className={`employee-pill ${day.available ? 'available' : ''}`}
                    aria-pressed={day.available}
                    onClick={() => updateDay(index, { available: !day.available })}
                  >
                    {day.available ? 'Disponible' : 'Repos'}
                  </button>
                  {day.available ? (
                    <div className="employee-times">
                      <input
                        type="time"
                        aria-label={`Début · ${days[index]}`}
                        value={day.startTime}
                        onChange={(e) => updateDay(index, { startTime: e.target.value || '08:00' })}
                      />
                      <span>{uiText['a']}</span>
                      <input
                        type="time"
                        aria-label={`Fin · ${days[index]}`}
                        value={day.endTime}
                        onChange={(e) => updateDay(index, { endTime: e.target.value || '18:00' })}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          {driver ? <EmployeeVehicleCheck profile={profile} onView={setPhoto} /> : null}
          <section className="employee-panel">
            <h2>{uiText['mesMISSIONS']}</h2>
            {!bookings.length ? (
              <span className="employee-muted">{uiText['aucuneMissionAffectee']}</span>
            ) : (
              bookings.map((booking) => (
                <article className="employee-mission" key={booking.id}>
                  <div className="employee-mission-heading">
                    <strong>
                      {booking.reference} ·{' '}
                      {booking.date
                        ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('fr-FR')
                        : 'Date à définir'}
                      {booking.timeSlot ? ` · ${booking.timeSlot}` : ''}
                    </strong>
                    <a href={`tel:${booking.phone}`}>
                      {uiText['client2']}
                      {booking.phone || '-'}
                    </a>
                  </div>
                  <span>
                    {booking.fromAddress || '-'} → {booking.toAddress || '-'}
                  </span>
                  {driver ? (
                    <>
                      <div className="employee-actions">
                        {(['retrait', 'depot'] as const).map((kind) => (
                          <label
                            className={`employee-pill ${kind === 'retrait' ? 'selected' : 'outlined'}`}
                            key={kind}
                          >
                            {uiText['photo2']}
                            {kind === 'retrait' ? 'retrait' : 'dépôt'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              hidden
                              disabled={uploading}
                              onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                e.target.value = '';
                                void proofs(booking.id, kind, files);
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      {booking.employeeProofs?.length ? (
                        <div className="employee-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                {['TYPE', 'PHOTO', 'HEURE', 'NOTE'].map((label) => (
                                  <th key={label}>{label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...booking.employeeProofs]
                                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                                .map((proof) => (
                                  <tr key={proof.id}>
                                    <td
                                      className={
                                        proof.kind === 'retrait'
                                          ? 'employee-yellow'
                                          : 'employee-good'
                                      }
                                    >
                                      {proof.kind === 'retrait' ? 'Retrait' : 'Dépôt'}
                                    </td>
                                    <td>
                                      <button
                                        className="employee-thumbnail"
                                        onClick={() => setPhoto(proof.image)}
                                      >
                                        <img
                                          src={proof.image}
                                          alt={
                                            proof.kind === 'retrait'
                                              ? 'Photo retrait'
                                              : 'Photo dépôt'
                                          }
                                        />
                                      </button>
                                    </td>
                                    <td>{employeeDate(proof.createdAt)}</td>
                                    <td>{proof.note}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </>
      )}
      {photo ? <EmployeePhotoViewer key={photo} src={photo} onClose={() => setPhoto('')} /> : null}
    </section>
  );
}
