import { uiText } from '../content/reference-ui-text';
import { AlertTriangle, CheckCircle2, MapPin, RefreshCw } from 'lucide-react';
import { useAdminVehicleReports } from '../application/controllers/useAdminVehicleReports';

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
const inspectionPhotoLabel = (index: number) =>
  index < 5
    ? proofLabels[index]
    : index === 5
      ? 'État général'
      : `État général · photo ${index - 4}`;
const levelLabel = (value: string) => (value === 'good' ? 'Bon' : value === 'low' ? 'Bas' : 'Vide');
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

export function AdminVehicleReports() {
  const { reports, loading, error, refresh } = useAdminVehicleReports();
  return (
    <div className="vehicle-admin-reports">
      <div className="section-heading report-admin-heading">
        <div>
          <p className="eyebrow">{uiText['suiviDELAFLOTTE']}</p>
          <h2>{uiText['controlesEtPannes']}</h2>
          <p>{uiText['lesVerificationsQuotidiennesEtSignalementsEnvoyesParLe']}</p>
        </div>
        <button className="button secondary small" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} />
          {uiText['actualiser']}
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section>
        <h3>
          <AlertTriangle size={20} /> {uiText['signalementsDePanne']}{' '}
          <span className="report-count">{reports.breakdowns.length}</span>
        </h3>
        {loading ? (
          <p className="panel loading">{uiText['chargement']}</p>
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
                  <MapPin size={17} /> {uiText['ouvrirLaPositionDuChauffeur']}
                </a>
                {report.accuracy && (
                  <small>
                    {uiText['precisionGPS']}
                    {Math.round(report.accuracy)} {uiText['m']}
                  </small>
                )}
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
          <p className="panel report-empty">{uiText['aucunePanneSignalee']}</p>
        )}
      </section>
      <section>
        <h3>
          <CheckCircle2 size={20} /> {uiText['controlesQuotidiens']}{' '}
          <span className="report-count">{reports.inspections.length}</span>
        </h3>
        {loading ? (
          <p className="panel loading">{uiText['chargement']}</p>
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
                          alt={`Preuve ${inspectionPhotoLabel(index) ?? `photo ${index + 1}`} · ${report.vehicleName}`}
                          loading="lazy"
                        />
                      </a>
                      <figcaption>{inspectionPhotoLabel(index) ?? `Photo ${index + 1}`}</figcaption>
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="panel report-empty">{uiText['aucunControleRecuPourLeMoment']}</p>
        )}
      </section>
    </div>
  );
}
