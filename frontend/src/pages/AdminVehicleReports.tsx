import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { errorMessage } from '../application/error-message';
import { uiText } from '../content/reference-ui-text';
import { EmployeePhotoViewer } from '../components/employee/EmployeePhotoViewer';
import { employeePhoto } from '../components/employee/photos';
import { useAdminVehicleReports } from '../application/controllers/useAdminVehicleReports';
import { useApp } from '../application/context';
import { usePagination } from '../application/usePagination';
import { Pagination } from '../components/Pagination';
import { messages } from '../content/fr';
import { pageSizes } from '../config/pagination';
import type { VehicleInspection } from '../application/ports';
import '../styles/admin-controls.css';

const controlItems = [
  { key: 'engineOil', label: uiText['niveauDHuile'] },
  { key: 'brakeFluid', label: uiText['liquideDeFrein'] },
  { key: 'coolant', label: uiText['liquideDeRefroidissement'] },
  { key: 'washerFluid', label: uiText['laveGlace'] },
  { key: 'fuel', label: uiText['niveauDEssence'] },
] as const;
type ControlKey = (typeof controlItems)[number]['key'];
const legacyPhotoIndices: Record<ControlKey, number> = {
  engineOil: 0,
  brakeFluid: 2,
  coolant: 1,
  washerFluid: 4,
  fuel: -1,
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Dakar',
  }).format(new Date(value));
const isoDate = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const vehicleTag = (value: string) =>
  value.replace(/^(?:mercedes|renault)\s+/i, '').replace(/\s+(?:iii|iv)(?:\s+phase\s+\d+)?$/i, '');

export function AdminVehicleReports() {
  const { catalogue, requestConfirmation } = useApp();
  const {
    reports,
    proofs,
    loading,
    proofsLoading,
    error,
    updateProof,
    deleteProof,
    updateInspectionLevel,
    deleteInspection,
  } = useAdminVehicleReports();
  const [missionFilter, setMissionFilter] = useState('all');
  const [proofTypeFilter, setProofTypeFilter] = useState('all');
  const [controlQuery, setControlQuery] = useState('');
  const [proofQuery, setProofQuery] = useState('');
  const [controlStatusFilter, setControlStatusFilter] = useState('all');
  const [controlDateFilter, setControlDateFilter] = useState('');
  const [controlVehicleFilter, setControlVehicleFilter] = useState('all');
  const [controlPersonFilter, setControlPersonFilter] = useState('all');
  const [proofDateFilter, setProofDateFilter] = useState('');
  const [proofVehicleFilter, setProofVehicleFilter] = useState('all');
  const [proofPersonFilter, setProofPersonFilter] = useState('all');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const noteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const missions = useMemo(
    () => [...new Map(proofs.map((proof) => [proof.bookingId, proof.missionOption])).entries()],
    [proofs],
  );
  const controlPeople = useMemo(
    () =>
      [
        ...new Map(
          reports.inspections.map((report) => [report.driverId, report.driverName]),
        ).entries(),
      ].filter(([id]) => id),
    [reports.inspections],
  );
  const proofPeople = useMemo(
    () => [...new Map(proofs.map((proof) => [proof.employeeId, proof.employeeName])).entries()],
    [proofs],
  );
  const filteredInspections = useMemo(() => {
    const needle = controlQuery.trim().toLocaleLowerCase('fr');
    return [...reports.inspections]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .filter((report) => {
        const levels = Object.values(report.levels);
        const allGood = levels.length > 0 && levels.every((level) => level === 'good');
        const searchable =
          `${report.driverName} ${report.vehicleName} ${dateLabel(report.createdAt)}`.toLocaleLowerCase(
            'fr',
          );
        return (
          (!needle || searchable.includes(needle)) &&
          (!controlDateFilter || isoDate(report.createdAt) === controlDateFilter) &&
          (controlVehicleFilter === 'all' || report.vehicleId === controlVehicleFilter) &&
          (controlPersonFilter === 'all' || report.driverId === controlPersonFilter) &&
          (controlStatusFilter === 'all' || (controlStatusFilter === 'good' ? allGood : !allGood))
        );
      });
  }, [
    controlDateFilter,
    controlPersonFilter,
    controlQuery,
    controlStatusFilter,
    controlVehicleFilter,
    reports.inspections,
  ]);
  const controlsPage = usePagination(
    filteredInspections,
    pageSizes.controls,
    `${controlQuery}|${controlStatusFilter}|${controlDateFilter}|${controlVehicleFilter}|${controlPersonFilter}`,
  );
  const filteredProofs = useMemo(() => {
    const needle = proofQuery.trim().toLocaleLowerCase('fr');
    return proofs.filter((proof) => {
      const matchesMission = missionFilter === 'all' || proof.bookingId === missionFilter;
      const matchesType = proofTypeFilter === 'all' || proof.kind === proofTypeFilter;
      const searchable =
        `${proof.mission} ${proof.employeeName} ${proof.note} ${proof.vehicleName}`.toLocaleLowerCase(
          'fr',
        );
      return (
        matchesMission &&
        matchesType &&
        (!proofDateFilter || isoDate(proof.createdAt) === proofDateFilter) &&
        (proofVehicleFilter === 'all' || proof.vehicleId === proofVehicleFilter) &&
        (proofPersonFilter === 'all' || proof.employeeId === proofPersonFilter) &&
        (!needle || searchable.includes(needle))
      );
    });
  }, [
    missionFilter,
    proofDateFilter,
    proofPersonFilter,
    proofQuery,
    proofTypeFilter,
    proofVehicleFilter,
    proofs,
  ]);
  const proofsPage = usePagination(
    filteredProofs,
    pageSizes.proofs,
    `${missionFilter}|${proofTypeFilter}|${proofQuery}|${proofDateFilter}|${proofVehicleFilter}|${proofPersonFilter}`,
  );

  useEffect(() => () => noteTimers.current.forEach((timer) => clearTimeout(timer)), []);

  function updateProofNote(bookingId: string, proofId: string, note: string) {
    setNoteDrafts((current) => ({ ...current, [proofId]: note }));
    const previous = noteTimers.current.get(proofId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      noteTimers.current.delete(proofId);
      void updateProof(bookingId, proofId, { note }).catch(() => undefined);
    }, 350);
    noteTimers.current.set(proofId, timer);
  }

  function saveProofNote(bookingId: string, proofId: string, note: string) {
    const timer = noteTimers.current.get(proofId);
    if (timer) clearTimeout(timer);
    noteTimers.current.delete(proofId);
    void updateProof(bookingId, proofId, { note }).catch(() => undefined);
  }

  async function replaceProofPhoto(bookingId: string, proofId: string, file?: File) {
    if (!file) return;
    setPhotoError('');
    try {
      const image = await employeePhoto(file);
      await updateProof(bookingId, proofId, { image });
    } catch (reason) {
      setPhotoError(errorMessage(reason));
    }
  }

  return (
    <div className="reference-controls-page">
      {(photoError || error) && (
        <p className="reference-controls-error" aria-live="polite">
          {photoError || error}
        </p>
      )}
      <section className="reference-controls-card">
        <span className="reference-controls-title">{uiText['controlesTechniques']}</span>
        <div className="reference-controls-filters">
          <label className="reference-controls-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={controlQuery}
              onChange={(event) => setControlQuery(event.target.value)}
              placeholder={uiText['rechercherUnControle']}
              aria-label={uiText['rechercherUnControle']}
            />
            {controlQuery && (
              <button
                type="button"
                onClick={() => setControlQuery('')}
                aria-label={uiText['effacerLaRecherche']}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </label>
          <select
            value={controlStatusFilter}
            onChange={(event) => setControlStatusFilter(event.target.value)}
            aria-label={uiText['filtrerLesControles']}
          >
            <option value="all">{uiText['tousLesControles']}</option>
            <option value="good">{uiText['controlesBons']}</option>
            <option value="attention">{uiText['controlesARevoir']}</option>
          </select>
          <input
            type="date"
            value={controlDateFilter}
            onChange={(event) => setControlDateFilter(event.target.value)}
            aria-label={uiText['filtrerParDate']}
            title={uiText['filtrerParDate']}
          />
          <select
            value={controlVehicleFilter}
            onChange={(event) => setControlVehicleFilter(event.target.value)}
            aria-label={uiText['filtrerParVehicule']}
          >
            <option value="all">{uiText['tousLesVehicules']}</option>
            {(catalogue?.vehicles ?? []).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleTag(vehicle.shortName || vehicle.name)}
              </option>
            ))}
          </select>
          <select
            value={controlPersonFilter}
            onChange={(event) => setControlPersonFilter(event.target.value)}
            aria-label={uiText['filtrerParPersonne']}
          >
            <option value="all">{uiText['toutesLesPersonnes']}</option>
            {controlPeople.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <span className="reference-controls-empty">{uiText['chargement']}</span>
        ) : reports.inspections.length === 0 ? (
          <span className="reference-controls-empty">{uiText['aucunControleEnregistre']}</span>
        ) : filteredInspections.length === 0 ? (
          <span className="reference-controls-empty">{uiText['aucuneCorrespondanceControle']}</span>
        ) : (
          <div className="reference-controls-table-wrap">
            <table className="reference-controls-table">
              <thead>
                <tr>
                  <th>{uiText['enteteDate']}</th>
                  <th>{uiText['enteteChauffeur']}</th>
                  <th>{uiText['enteteVehicule']}</th>
                  {controlItems.map((item) => (
                    <th key={item.key}>{item.label.toLocaleUpperCase('fr')}</th>
                  ))}
                  <th aria-label={uiText['actions']} />
                </tr>
              </thead>
              <tbody>
                {controlsPage.rows.map((report) => (
                  <InspectionRow
                    key={report.id}
                    report={report}
                    vehicleName={vehicleTag(
                      catalogue?.vehicles.find((vehicle) => vehicle.id === report.vehicleId)
                        ?.shortName ?? report.vehicleName,
                    )}
                    onView={setPhoto}
                    onToggle={(key, good) => void updateInspectionLevel(report.id, key, good)}
                    onDelete={async () => {
                      const confirmed = await requestConfirmation({
                        titleId: 'delete-vehicle-control-title',
                        eyebrow: messages.confirmationRequise,
                        title: uiText['supprimerCeControle'],
                        description: messages.suppressionControleDescription,
                        confirmLabel: uiText['supprimer'],
                      });
                      if (confirmed) await deleteInspection(report.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredInspections.length > 0 && (
          <Pagination
            page={controlsPage.page}
            pageCount={controlsPage.pageCount}
            total={controlsPage.total}
            onPageChange={controlsPage.setPage}
            showSinglePage
          />
        )}
      </section>

      <section className="reference-controls-card reference-proofs-card">
        <div className="reference-proofs-heading">
          <span className="reference-controls-title">{uiText['preuvesPhotoRetraitsDepots']}</span>
          <div className="reference-proofs-filters">
            <label className="reference-controls-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={proofQuery}
                onChange={(event) => setProofQuery(event.target.value)}
                placeholder={uiText['rechercherUnePreuve']}
                aria-label={uiText['rechercherUnePreuve']}
              />
              {proofQuery && (
                <button
                  type="button"
                  onClick={() => setProofQuery('')}
                  aria-label={uiText['effacerLaRecherche']}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </label>
            <select
              value={missionFilter}
              onChange={(event) => setMissionFilter(event.target.value)}
              aria-label={uiText['toutesLesMissions']}
            >
              <option value="all">{uiText['toutesLesMissions']}</option>
              {missions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label || uiText['missionSupprimee']}
                </option>
              ))}
            </select>
            <select
              value={proofTypeFilter}
              onChange={(event) => setProofTypeFilter(event.target.value)}
              aria-label={uiText['filtrerLeType']}
            >
              <option value="all">{uiText['tousLesTypes']}</option>
              <option value="retrait">{uiText['retraitAvecMajuscule']}</option>
              <option value="depot">{uiText['depotAvecMajuscule']}</option>
            </select>
            <input
              type="date"
              value={proofDateFilter}
              onChange={(event) => setProofDateFilter(event.target.value)}
              aria-label={uiText['filtrerParDate']}
              title={uiText['filtrerParDate']}
            />
            <select
              value={proofVehicleFilter}
              onChange={(event) => setProofVehicleFilter(event.target.value)}
              aria-label={uiText['filtrerParVehicule']}
            >
              <option value="all">{uiText['tousLesVehicules']}</option>
              {(catalogue?.vehicles ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleTag(vehicle.shortName || vehicle.name)}
                </option>
              ))}
            </select>
            <select
              value={proofPersonFilter}
              onChange={(event) => setProofPersonFilter(event.target.value)}
              aria-label={uiText['filtrerParPersonne']}
            >
              <option value="all">{uiText['toutesLesPersonnes']}</option>
              {proofPeople.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {proofsLoading ? (
          <span className="reference-controls-empty">{uiText['chargement']}</span>
        ) : proofs.length === 0 ? (
          <span className="reference-controls-empty">{uiText['aucunePhoto']}</span>
        ) : filteredProofs.length === 0 ? (
          <span className="reference-controls-empty">{uiText['aucuneCorrespondancePreuve']}</span>
        ) : (
          <div className="reference-controls-table-wrap">
            <table className="reference-proofs-table">
              <thead>
                <tr>
                  <th>{uiText['enteteMission']}</th>
                  <th>{uiText['enteteChauffeur']}</th>
                  <th>{uiText['enteteType']}</th>
                  <th>{uiText['entetePhoto']}</th>
                  <th>{uiText['enteteHeure']}</th>
                  <th>{uiText['enteteNote']}</th>
                  <th aria-label={uiText['actions']} />
                </tr>
              </thead>
              <tbody>
                {proofsPage.rows.map((proof) => (
                  <tr key={`${proof.bookingId}-${proof.id}`}>
                    <td className="reference-proof-mission">{proof.mission}</td>
                    <td>{proof.employeeName}</td>
                    <td>
                      <button
                        type="button"
                        className={`reference-proof-kind ${proof.kind}`}
                        onClick={() =>
                          void updateProof(proof.bookingId, proof.id, {
                            kind: proof.kind === 'depot' ? 'retrait' : 'depot',
                          }).catch(() => undefined)
                        }
                      >
                        {proof.kind === 'depot'
                          ? uiText['depotAvecMajuscule']
                          : uiText['retraitAvecMajuscule']}
                      </button>
                    </td>
                    <td>
                      <div className="reference-proof-photo-cell">
                        <button
                          type="button"
                          className="reference-proof-thumbnail"
                          onClick={() => setPhoto(proof.image)}
                          aria-label={`${uiText['agrandir']} · ${proof.mission}`}
                        >
                          <img src={proof.image} alt={proof.mission} />
                        </button>
                        <label className="reference-proof-replace">
                          {uiText['remplacer']}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              void replaceProofPhoto(proof.bookingId, proof.id, file);
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="reference-proof-time">{dateLabel(proof.createdAt)}</td>
                    <td>
                      <input
                        className="reference-proof-note"
                        value={noteDrafts[proof.id] ?? proof.note}
                        onChange={(event) =>
                          updateProofNote(proof.bookingId, proof.id, event.target.value)
                        }
                        onBlur={(event) =>
                          saveProofNote(proof.bookingId, proof.id, event.target.value)
                        }
                        placeholder={uiText['note']}
                        aria-label={`${uiText['note']} · ${proof.mission}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="reference-controls-delete"
                        onClick={() => {
                          void (async () => {
                            const confirmed = await requestConfirmation({
                              titleId: 'delete-employee-proof-title',
                              eyebrow: messages.confirmationRequise,
                              title: uiText['supprimerCettePhoto'],
                              description: messages.suppressionPreuveDescription,
                              confirmLabel: uiText['supprimer'],
                            });
                            if (confirmed)
                              await deleteProof(proof.bookingId, proof.id).catch(() => undefined);
                          })();
                        }}
                      >
                        {uiText['supprimer']}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!proofsLoading && filteredProofs.length > 0 && (
          <Pagination
            page={proofsPage.page}
            pageCount={proofsPage.pageCount}
            total={proofsPage.total}
            onPageChange={proofsPage.setPage}
            showSinglePage
          />
        )}
      </section>
      {photo && <EmployeePhotoViewer src={photo} onClose={() => setPhoto('')} />}
    </div>
  );
}

function InspectionRow({
  report,
  vehicleName,
  onView,
  onToggle,
  onDelete,
}: {
  report: VehicleInspection;
  vehicleName: string;
  onView: (src: string) => void;
  onToggle: (key: ControlKey, good: boolean) => void;
  onDelete: () => void | Promise<void>;
}) {
  const legacy = !('fuel' in report.levels);
  return (
    <tr>
      <td className="reference-controls-date">{dateLabel(report.createdAt)}</td>
      <td className="reference-controls-driver">{report.driverName || '-'}</td>
      <td>{vehicleName}</td>
      {controlItems.map((item, index) => {
        const photoIndex = legacy ? legacyPhotoIndices[item.key] : index;
        const image = photoIndex >= 0 ? report.photos[photoIndex] : undefined;
        const value = report.levels[item.key];
        const good = value === 'good';
        const label = good ? uiText['bon'] : value === 'low' ? uiText['pasBon'] : '-';
        return (
          <td key={item.key}>
            <div className="reference-control-cell">
              {image ? (
                <button
                  type="button"
                  className="reference-control-thumbnail"
                  onClick={() => onView(image)}
                  aria-label={`${uiText['agrandir']} · ${item.label}`}
                >
                  <img src={image} alt={item.label} />
                </button>
              ) : null}
              <button
                type="button"
                className={`reference-control-status ${good ? 'good' : value === 'low' ? 'bad' : ''}`}
                onClick={() => onToggle(item.key, !good)}
              >
                {label}
              </button>
            </div>
          </td>
        );
      })}
      <td>
        <button type="button" className="reference-controls-delete" onClick={onDelete}>
          {uiText['supprimer']}
        </button>
      </td>
    </tr>
  );
}
