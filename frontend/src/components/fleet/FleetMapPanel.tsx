import { uiText } from '../../content/reference-ui-text';
import type { useAdminFleetPageModel } from '../../application/controllers/useAdminFleetPageModel';
type Model = ReturnType<typeof useAdminFleetPageModel>;
export function FleetMapPanel({ model }: { model: Model }) {
  const {
    employees,
    selectedDay,
    mapTraffic,
    setMapTraffic,
    mapLayers,
    setMapLayers,
    placingId,
    setPlacingId,
    setSelectedEmployee,
    setMapElement,
    selectedRoute,
    selectedRouteStatus,
    employeeById,
    selected,
    selectedJob,
    roles,
    shortDate,
  } = model;
  return (
    <section className="teams-panel teams-map-panel">
      <div className="teams-panel-heading">
        <div>
          <span className="teams-eyebrow">{uiText['carteDESEQUIPES']}</span>
          <span className="teams-muted">
            {
              employees.filter(
                (employee) => employee.latitude != null && employee.longitude != null,
              ).length
            }{' '}
            / {employees.length} {uiText['employeSLocaliseSDemenagementsDu']}{' '}
            {shortDate(selectedDay)}
          </span>
        </div>
        <div className="teams-chips">
          <button
            className={mapLayers.employees ? 'team-chip active' : 'team-chip'}
            onClick={() => setMapLayers((value) => ({ ...value, employees: !value.employees }))}
          >
            {mapLayers.employees ? '✓ ' : ''}
            {uiText['logementsDesEmployes']}
          </button>
          <button
            className={mapLayers.bookings ? 'team-chip active' : 'team-chip'}
            onClick={() => setMapLayers((value) => ({ ...value, bookings: !value.bookings }))}
          >
            {mapLayers.bookings ? '✓ ' : ''}
            {uiText['demenagementsDuJour']}
          </button>
        </div>
      </div>
      {placingId && (
        <div className="teams-map-place">
          <strong>
            {uiText['touchezLaCarteALEndroitDuLogementDe']}
            {employeeById.get(placingId)?.name}
          </strong>
          <button className="team-button" onClick={() => setPlacingId('')}>
            {uiText['annuler']}
          </button>
        </div>
      )}
      <div className="teams-map-wrap">
        <div className="teams-map" ref={setMapElement} />
        <button className="teams-traffic" onClick={() => setMapTraffic((value) => !value)}>
          {mapTraffic ? 'Trafic en direct : activé' : 'Trafic en direct : désactivé'}
        </button>
        {selected && (
          <div className="teams-map-selected">
            <button aria-label={uiText['fermer']} onClick={() => setSelectedEmployee('')}>
              ×
            </button>
            <strong>
              {selectedJob
                ? `${selected.name.split(' ')[0]} → A · ${selectedJob.reference} · ${selectedJob.timeSlot || 'Journée'}`
                : selected.name.split(' ')[0]}
            </strong>
            {!selectedJob ? (
              <span>{uiText['aucuneMissionCeJour']}</span>
            ) : selected.latitude == null || selected.longitude == null ? (
              <span>{uiText['logementNonPointeSurLaCarte']}</span>
            ) : (
              <>
                {selectedRoute?.bookingId === selectedJob.id ? (
                  <div className="teams-route-summary">
                    <strong>
                      {Math.round(selectedRoute.durationMinutes)} {uiText['min']}
                    </strong>
                    <span>
                      {selectedRoute.distanceKm.toFixed(1).replace('.', ',')} {uiText['km']}
                    </span>
                    <small>{uiText['sansTrafic']}</small>
                  </div>
                ) : (
                  <span>
                    {selectedRouteStatus === 'error'
                      ? 'Itinéraire indisponible.'
                      : 'Calcul de l’itinéraire…'}
                  </span>
                )}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${selected.latitude},${selected.longitude}&destination=${selectedJob.from[0]},${selectedJob.from[1]}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {uiText['tempsAvecTraficEnDirectGoogleMaps']}
                </a>
              </>
            )}
          </div>
        )}
      </div>
      <div className="teams-map-legend">
        {roles.map((role) => (
          <span key={role.id}>
            <i style={{ background: role.color }} />
            {role.label}
          </span>
        ))}
        <span>
          <i style={{ background: '#2ECC71' }} />
          {uiText['departA']}
        </span>
        <span>
          <i style={{ background: '#FF6B6B' }} />
          {uiText['arriveeB']}
        </span>
      </div>
    </section>
  );
}
