import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '../application/context';
import type { VehicleReports } from '../application/ports';
import { errorMessage } from '../application/error-message';

const levelName: Record<string, string> = {
  engineOil: 'Huile moteur',
  coolant: 'Liquide de refroidissement',
  brakeFluid: 'Liquide de frein',
  powerSteering: 'Direction assistée',
  washerFluid: 'Lave-glace',
};
const proofLabels = [
  'Huile moteur',
  'Liquide de refroidissement',
  'Liquide de frein',
  'Direction assistée',
  'Lave-glace',
  'État général',
];
const levelLabel = (value: string) => (value === 'good' ? 'Bon' : value === 'low' ? 'Bas' : 'Vide');
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

export function AdminVehicleReports() {
  const { api } = useApp();
  const [reports, setReports] = useState<VehicleReports>({ inspections: [], breakdowns: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
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
  return (
    <div className="vehicle-admin-reports">
      <div className="section-heading report-admin-heading">
        <div>
          <p className="eyebrow">SUIVI DE LA FLOTTE</p>
          <h2>Contrôles et pannes</h2>
          <p>Les vérifications quotidiennes et signalements envoyés par les chauffeurs.</p>
        </div>
        <button
          className="button secondary small"
          onClick={() => setRetry((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section>
        <h3>
          <AlertTriangle size={20} /> Signalements de panne{' '}
          <span className="report-count">{reports.breakdowns.length}</span>
        </h3>
        {loading ? (
          <p className="panel loading">Chargement…</p>
        ) : reports.breakdowns.length ? (
          <div className="report-card-grid">
            {reports.breakdowns.map((report) => (
              <article className="panel admin-report-card" key={report.id}>
                <div className="report-card-heading">
                  <div>
                    <p className="eyebrow">{report.vehicleName}</p>
                    <h4>{report.driverName}</h4>
                    <a href={`tel:${report.driverPhone}`}>{report.driverPhone}</a>
                  </div>
                  <time>{dateLabel(report.createdAt)}</time>
                </div>
                <p>{report.description}</p>
                <a
                  className="report-location"
                  href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={17} /> Ouvrir la position du chauffeur
                </a>
                {report.accuracy && <small>Précision GPS : ±{Math.round(report.accuracy)} m</small>}
                <div className="report-photo-grid">
                  {report.photos.map((photo, index) => (
                    <a key={`${report.id}-${index}`} href={photo} target="_blank" rel="noreferrer">
                      <img src={photo} alt={`Preuve de panne ${index + 1}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="panel report-empty">Aucune panne signalée.</p>
        )}
      </section>
      <section>
        <h3>
          <CheckCircle2 size={20} /> Contrôles quotidiens{' '}
          <span className="report-count">{reports.inspections.length}</span>
        </h3>
        {loading ? (
          <p className="panel loading">Chargement…</p>
        ) : reports.inspections.length ? (
          <div className="report-card-grid">
            {reports.inspections.map((report) => (
              <article className="panel admin-report-card" key={report.id}>
                <div className="report-card-heading">
                  <div>
                    <p className="eyebrow">{report.vehicleName}</p>
                    <h4>{report.driverName}</h4>
                    <a href={`tel:${report.driverPhone}`}>{report.driverPhone}</a>
                  </div>
                  <time>
                    {report.date} · {dateLabel(report.createdAt).split(' à ').at(-1)}
                  </time>
                </div>
                <p className={`condition-pill condition-${report.condition}`}>
                  {report.condition === 'good'
                    ? 'Véhicule en bon état'
                    : report.condition === 'attention'
                      ? 'À surveiller'
                      : 'Véhicule déclaré dangereux'}
                </p>
                <dl className="fluid-level-list">
                  {Object.entries(report.levels).map(([key, value]) => (
                    <div key={key}>
                      <dt>{levelName[key] ?? key}</dt>
                      <dd>{levelLabel(String(value))}</dd>
                    </div>
                  ))}
                </dl>
                {report.notes && <p>{report.notes}</p>}
                <div className="report-photo-grid inspection-proof-grid">
                  {report.photos.map((photo, index) => (
                    <figure key={`${report.id}-${index}`}>
                      <a href={photo} target="_blank" rel="noreferrer">
                        <img
                          src={photo}
                          alt={`Preuve ${proofLabels[index] ?? `photo ${index + 1}`} · ${report.vehicleName}`}
                          loading="lazy"
                        />
                      </a>
                      <figcaption>
                        {report.photos.length === 6
                          ? (proofLabels[index] ?? `Photo ${index + 1}`)
                          : `Ancienne photo ${index + 1}`}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="panel report-empty">Aucun contrôle reçu pour le moment.</p>
        )}
      </section>
    </div>
  );
}
