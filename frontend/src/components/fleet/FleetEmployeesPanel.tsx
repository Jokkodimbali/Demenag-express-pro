import { uiText } from '../../content/reference-ui-text';
import { Copy, KeyRound, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { messages } from '../../content/fr';
import { whatsappUrl } from '../../application/services/whatsapp';
import type { useAdminFleetPageModel } from '../../application/controllers/useAdminFleetPageModel';
type Model = ReturnType<typeof useAdminFleetPageModel>;
export function FleetEmployeesPanel({ model }: { model: Model }) {
  const {
    catalogue,
    requestConfirmation,
    bookings,
    employees,
    employeesLoading,
    selectedDay,
    setPlacingId,
    setSelectedEmployee,
    mapElement,
    mapRef,
    mapError,
    savingEmployee,
    openInfo,
    setOpenInfo,
    openNotes,
    setOpenNotes,
    openHours,
    setOpenHours,
    filterRole,
    setFilterRole,
    sortByAccepted,
    setSortByAccepted,
    newEmployee,
    setNewEmployee,
    createdEmployeeAccess,
    setCreatedEmployeeAccess,
    dayIndex,
    availabilityOf,
    weekLoad,
    refusalCount,
    isSuspect,
    applyMemberPatch,
    updateEmployeeAddress,
    addEmployee,
    resetEmployeePassword,
    removeEmployee,
    visibleEmployees,
    roles,
    roleName,
    days,
    tags,
    availabilitySummary,
    iso,
  } = model;
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [credentialCopyError, setCredentialCopyError] = useState('');
  useEffect(() => {
    setCopiedCredential(false);
    setCredentialCopyError('');
  }, [createdEmployeeAccess?.password]);
  return (
    <section className="teams-panel teams-employees">
      <div>
        <span className="teams-eyebrow">{uiText['employes']}</span>
      </div>
      <div className="teams-new-employee">
        <div className="teams-chips">
          {roles.map((role) => (
            <button
              key={role.id}
              className={newEmployee.role === role.id ? 'team-chip active' : 'team-chip'}
              onClick={() => setNewEmployee((value) => ({ ...value, role: role.id }))}
            >
              {role.label}
            </button>
          ))}
        </div>
        <div className="teams-form-grid">
          <input
            placeholder={uiText['nomEtPrenom']}
            value={newEmployee.name}
            onChange={(event) =>
              setNewEmployee((value) => ({ ...value, name: event.target.value }))
            }
          />
          <input
            placeholder={uiText['telephone771234567']}
            inputMode="tel"
            value={newEmployee.phone}
            onChange={(event) =>
              setNewEmployee((value) => ({ ...value, phone: event.target.value }))
            }
          />
          <input
            placeholder={uiText['adresseDuLogement']}
            value={newEmployee.address}
            onChange={(event) =>
              setNewEmployee((value) => ({ ...value, address: event.target.value }))
            }
          />
        </div>
        {newEmployee.role === 'chauffeur' && catalogue && (
          <div className="teams-new-driver-vehicles">
            <span>{uiText['vehiculesAutorises']}</span>
            <div className="teams-chips">
              {catalogue.vehicles.map((vehicle) => {
                const chosen = newEmployee.authorizedVehicleIds.includes(vehicle.id);
                return (
                  <button
                    key={vehicle.id}
                    className={chosen ? 'team-chip active' : 'team-chip'}
                    onClick={() =>
                      setNewEmployee((current) => ({
                        ...current,
                        authorizedVehicleIds: chosen
                          ? current.authorizedVehicleIds.filter((id) => id !== vehicle.id)
                          : [...current.authorizedVehicleIds, vehicle.id],
                      }))
                    }
                  >
                    {chosen ? '✓ ' : ''}
                    {vehicle.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <button className="team-button primary" onClick={() => void addEmployee()}>
          {uiText['ajouterLEmploye']}
        </button>
      </div>
      {createdEmployeeAccess && (
        <section className="teams-generated-credentials" role="status">
          <div className="teams-generated-heading">
            <div>
              <strong>
                {createdEmployeeAccess.purpose === 'creation'
                  ? 'Compte employé créé'
                  : 'Mot de passe employé réinitialisé'}
              </strong>
              <span>
                {createdEmployeeAccess.purpose === 'creation'
                  ? `Transmettez ces identifiants à ${createdEmployeeAccess.name}.`
                  : `Le nouveau mot de passe de ${createdEmployeeAccess.name} remplace l’ancien.`}
              </span>
            </div>
            <button
              type="button"
              className="team-icon-button"
              aria-label="Masquer les identifiants"
              onClick={() => setCreatedEmployeeAccess(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="teams-generated-fields">
            <label>
              Téléphone
              <input readOnly value={createdEmployeeAccess.phone} />
            </label>
            <label>
              Mot de passe{' '}
              {createdEmployeeAccess.purpose === 'creation' ? 'initial' : 'à transmettre'}
              <input readOnly value={createdEmployeeAccess.password} />
            </label>
          </div>
          {credentialCopyError && <p className="teams-generated-error">{credentialCopyError}</p>}
          <div className="teams-generated-actions">
            <button
              type="button"
              className="team-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdEmployeeAccess.password);
                  setCopiedCredential(true);
                  setCredentialCopyError('');
                } catch {
                  setCredentialCopyError(
                    'Copie indisponible. Sélectionnez le mot de passe pour le copier.',
                  );
                }
              }}
            >
              <Copy size={15} />{' '}
              {copiedCredential ? 'Mot de passe copié' : 'Copier le mot de passe'}
            </button>
            <a
              className="team-button primary"
              href={whatsappUrl(
                createdEmployeeAccess.phone,
                `Bonjour ${createdEmployeeAccess.name}, voici vos accès à l’espace employé Demenag Express. Téléphone : ${createdEmployeeAccess.phone}. Mot de passe : ${createdEmployeeAccess.password}. Connectez-vous avec ces identifiants puis changez votre mot de passe.`,
                catalogue?.settings,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={15} /> Envoyer par WhatsApp
            </a>
          </div>
        </section>
      )}
      <div className="teams-chips teams-filter-chips">
        <button
          className={!sortByAccepted ? 'team-chip active' : 'team-chip'}
          onClick={() => setSortByAccepted(false)}
        >
          {uiText['trierParRole']}
        </button>
        <button
          className={sortByAccepted ? 'team-chip active' : 'team-chip'}
          onClick={() => setSortByAccepted(true)}
        >
          {uiText['trierParMissionsAcceptees']}
        </button>
        {[
          { id: 'all' as const, label: `Tous · ${employees.length}` },
          ...roles.map((role) => ({
            id: role.id,
            label: `${role.plural} · ${employees.filter((employee) => (employee.role ?? 'chauffeur') === role.id).length}`,
          })),
        ].map((item) => (
          <button
            key={item.id}
            className={filterRole === item.id ? 'team-chip active' : 'team-chip'}
            onClick={() => setFilterRole(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {employeesLoading && !employees.length && (
        <p className="teams-empty" role="status">
          {uiText['chargementDesEmployes']}
        </p>
      )}
      {!employeesLoading && !visibleEmployees.length && (
        <p className="teams-empty">
          {employees.length
            ? 'Aucun employé dans ce rôle.'
            : 'Aucun employé enregistré. Ajoutez vos chauffeurs, menuisiers et manœuvres ci-dessus.'}
        </p>
      )}
      {visibleEmployees.map((employee) => {
        const role = employee.role ?? 'chauffeur';
        const availability = availabilityOf(employee);
        const employeeDayAvailability = availability[dayIndex(selectedDay)];
        const activeToday = employee.active && employeeDayAvailability?.available;
        const notesOpen = Boolean(openNotes[employee.id]);
        const infoOpen = Boolean(openInfo[employee.id]);
        const hoursOpen = Boolean(openHours[employee.id]);
        const authorized = employee.authorizedVehicleIds ?? [];
        const acceptedJobs = bookings.filter(
          (booking) =>
            booking.status !== 'cancelled' && booking.crewReplies?.[employee.id] === 'ok',
        );
        const month = iso(new Date()).slice(0, 7);
        const acceptedThisMonth = acceptedJobs.filter((booking) =>
          booking.date?.startsWith(month),
        ).length;
        const refusalTotal = employee.refusals?.length ?? 0;
        const activeRefusals = refusalCount(employee);
        const suspicion = isSuspect(employee);
        const acceptanceRate =
          acceptedJobs.length + refusalTotal
            ? Math.round((acceptedJobs.length / (acceptedJobs.length + refusalTotal)) * 100)
            : null;
        const empStats = [
          ['Acceptées', String(acceptedJobs.length), '#3DDC84'],
          ['Ce mois', String(acceptedThisMonth), '#fff'],
          [
            'Réalisées',
            String(
              acceptedJobs.filter(
                (booking) =>
                  booking.status === 'completed' ||
                  (booking.date != null && booking.date < iso(new Date())),
              ).length,
            ),
            '#fff',
          ],
          [
            'Refusées',
            String(employee.refusals?.length ?? 0),
            employee.refusals?.length ? '#FF6B6B' : '#fff',
          ],
          [
            'Taux d’acceptation',
            acceptanceRate === null ? '—' : `${acceptanceRate} %`,
            acceptanceRate === null
              ? '#AEB4BB'
              : acceptanceRate >= 80
                ? '#3DDC84'
                : acceptanceRate >= 50
                  ? '#F6D73C'
                  : '#FF6B6B',
          ],
        ];
        return (
          <article
            className={`teams-employee${employee.active ? '' : ' inactive'}`}
            key={employee.id}
          >
            <div className="teams-employee-heading">
              <button
                className="team-icon-button"
                onClick={() => setOpenInfo((value) => ({ ...value, [employee.id]: !infoOpen }))}
              >
                {infoOpen ? '⌄' : '›'}
              </button>
              <span
                className="teams-role-badge"
                style={{ background: roles.find((item) => item.id === role)?.color }}
              >
                {roleName(role).toUpperCase()}
              </span>
              <input
                className="teams-name-input"
                defaultValue={employee.name}
                onBlur={(event) =>
                  event.target.value.trim() !== employee.name &&
                  void applyMemberPatch(employee, { name: event.target.value.trim() })
                }
              />
              {!!refusalTotal && (
                <span className={`teams-refusal-badge${suspicion ? ' suspect' : ''}`}>
                  {suspicion
                    ? `⚠ Suspect · ${activeRefusals} refus`
                    : `${refusalTotal} refus${employee.clearedRefusals ? ' au total' : ''}`}
                </span>
              )}
              <button
                className={activeToday ? 'team-status-pill online' : 'team-status-pill offline'}
                onClick={() => void applyMemberPatch(employee, { active: !employee.active })}
              >
                {activeToday
                  ? `Disponible ${employeeDayAvailability.startTime}–${employeeDayAvailability.endTime}`
                  : 'Repos'}
              </button>
              <button
                type="button"
                className="team-icon-button"
                title="Réinitialiser et copier le mot de passe"
                aria-label={`Réinitialiser le mot de passe de ${employee.name}`}
                disabled={savingEmployee === employee.id}
                onClick={() => void resetEmployeePassword(employee)}
              >
                <KeyRound size={16} />
              </button>
              <button
                className="team-delete"
                title={uiText['supprimerLEmploye']}
                onClick={() => void removeEmployee(employee)}
              >
                ×
              </button>
            </div>
            {infoOpen && (
              <div className="teams-employee-details">
                <div className="teams-contact-row">
                  <input
                    inputMode="tel"
                    placeholder={uiText['telephone']}
                    defaultValue={employee.phone}
                    onBlur={(event) =>
                      event.target.value !== employee.phone &&
                      void applyMemberPatch(employee, { phone: event.target.value })
                    }
                  />
                  <a href={`tel:${employee.phone.replace(/\D/g, '')}`}>{uiText['appeler']}</a>
                  <span>
                    {weekLoad(employee.id, selectedDay)} {uiText['demenagement']}
                    {weekLoad(employee.id, selectedDay) > 1 ? 's' : ''} {uiText['cetteSemaine']}
                  </span>
                </div>
                {role === 'chauffeur' && (
                  <div className="teams-vehicle-tags">
                    <span>{uiText['conduit']}</span>
                    {(catalogue?.vehicles ?? []).map((vehicle) => {
                      const chosen = authorized.includes(vehicle.id);
                      return (
                        <button
                          key={vehicle.id}
                          className={chosen ? 'team-chip active' : 'team-chip'}
                          onClick={() =>
                            void applyMemberPatch(employee, {
                              authorizedVehicleIds: chosen
                                ? authorized.filter((id) => id !== vehicle.id)
                                : [...authorized, vehicle.id],
                            })
                          }
                        >
                          {vehicle.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="teams-contact-row">
                  <input
                    placeholder={uiText['adresseDuLogementQuartierRueRepere']}
                    defaultValue={employee.address ?? ''}
                    onBlur={(event) => {
                      const address = event.target.value;
                      if (
                        address !== employee.address ||
                        (address.trim() && employee.geocodedAddress !== address.trim())
                      )
                        void updateEmployeeAddress(employee, address);
                    }}
                  />
                  <button
                    className="team-button"
                    onClick={() => {
                      setPlacingId(employee.id);
                      mapElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {employee.latitude != null && employee.longitude != null
                      ? 'Déplacer sur la carte'
                      : 'Placer sur la carte'}
                  </button>
                  <span
                    className={
                      employee.latitude != null && employee.longitude != null
                        ? 'team-map-ready'
                        : 'team-map-missing'
                    }
                  >
                    {employee.latitude != null && employee.longitude != null
                      ? '✓ Pointé sur la carte'
                      : 'Pas encore pointé sur la carte'}
                  </span>
                  {employee.latitude != null && employee.longitude != null && (
                    <button
                      className="team-button"
                      onClick={() => {
                        setSelectedEmployee(employee.id);
                        mapRef.current?.setView([employee.latitude!, employee.longitude!], 15);
                        mapElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {uiText['voir']}
                    </button>
                  )}
                </div>
                {!!mapError && <span className="teams-error">{mapError}</span>}
                <div className="teams-employee-stats">
                  {empStats.map(([label, value, color]) => (
                    <div key={label}>
                      <strong style={{ color }}>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="teams-disclosure"
                  onClick={() => setOpenNotes((value) => ({ ...value, [employee.id]: !notesOpen }))}
                >
                  {notesOpen ? '⌄' : '›'} {uiText['notes']}{' '}
                  <span>
                    {[...(employee.tags ?? []), employee.notes].filter(Boolean).join(' · ') ||
                      'Aucune note'}
                  </span>
                </button>
                {notesOpen && (
                  <div className="teams-note-editor">
                    <div className="teams-chips">
                      {tags.map((tag) => {
                        const chosen = (employee.tags ?? []).includes(tag);
                        return (
                          <button
                            key={tag}
                            className={chosen ? 'team-chip active' : 'team-chip'}
                            onClick={() =>
                              void applyMemberPatch(employee, {
                                tags: chosen
                                  ? (employee.tags ?? []).filter((item) => item !== tag)
                                  : [...(employee.tags ?? []), tag],
                              })
                            }
                          >
                            {chosen ? '✓ ' : ''}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      rows={3}
                      placeholder={uiText['exAllergieContactDUrgenceQuartierPrefereLesMatinsPermi']}
                      defaultValue={employee.notes ?? ''}
                      onBlur={(event) =>
                        event.target.value !== employee.notes &&
                        void applyMemberPatch(employee, { notes: event.target.value })
                      }
                    />
                  </div>
                )}
                <button
                  className="teams-disclosure"
                  onClick={() => setOpenHours((value) => ({ ...value, [employee.id]: !hoursOpen }))}
                >
                  {hoursOpen ? '⌄' : '›'} {uiText['disponibilites']}{' '}
                  <span>{availabilitySummary(availability)}</span>
                </button>
                {hoursOpen && (
                  <div className="teams-hours">
                    {availability.map((item, index) => (
                      <div className="teams-hours-day" key={days[index]}>
                        <strong>{days[index]}</strong>
                        <button
                          className={
                            item.available ? 'teams-hours-toggle available' : 'teams-hours-toggle'
                          }
                          onClick={() => {
                            const next = [...availability];
                            next[index] = { ...item, available: !item.available };
                            void applyMemberPatch(employee, { availability: next });
                          }}
                        >
                          {item.available ? 'Travaille' : 'Repos'}
                        </button>
                        {item.available && (
                          <div className="teams-hours-range">
                            <input
                              type="time"
                              value={item.startTime}
                              onChange={(event) => {
                                const next = [...availability];
                                next[index] = {
                                  ...item,
                                  startTime: event.target.value || '08:00',
                                };
                                void applyMemberPatch(employee, { availability: next });
                              }}
                            />
                            <span>{uiText['a']}</span>
                            <input
                              type="time"
                              value={item.endTime}
                              onChange={(event) => {
                                const next = [...availability];
                                next[index] = {
                                  ...item,
                                  endTime: event.target.value || '18:00',
                                };
                                void applyMemberPatch(employee, { availability: next });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      className="teams-link-button"
                      onClick={() => {
                        const monday = availability[0];
                        const next = availability.map((item) =>
                          item.available
                            ? { ...item, startTime: monday.startTime, endTime: monday.endTime }
                            : item,
                        );
                        void applyMemberPatch(employee, { availability: next });
                      }}
                    >
                      {uiText['appliquerLHoraireDuLundiATousLesJoursTravailles']}
                    </button>
                  </div>
                )}
                {!!employee.refusals?.length && (
                  <div className="teams-refusals">
                    <span>
                      {suspicion
                        ? `⚠ Compte signalé suspect : ${activeRefusals} refus (${employee.refusals
                            .slice(employee.clearedRefusals ?? 0)
                            .map((item) => item.ref)
                            .join(
                              ', ',
                            )}). Il n’est plus proposé automatiquement. Remplacez-le sur ses missions.`
                        : `${refusalTotal} refus au total. Historique des refus.`}
                    </span>
                    {suspicion && (
                      <button
                        className="team-button"
                        onClick={() => {
                          void (async () => {
                            const confirmed = await requestConfirmation({
                              titleId: 'clear-employee-report-title',
                              eyebrow: messages.confirmationRequise,
                              title: messages.leverSignalementTitre(employee.name),
                              description: messages.leverSignalementDescription(employee.name),
                              confirmLabel: uiText['leverLeSignalement'],
                            });
                            if (confirmed)
                              await applyMemberPatch(employee, {
                                clearedRefusals: employee.refusals?.length ?? 0,
                              });
                          })();
                        }}
                      >
                        {uiText['leverLeSignalement']}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {savingEmployee === employee.id && (
              <small className="teams-saving">{uiText['enregistrement']}</small>
            )}
          </article>
        );
      })}
    </section>
  );
}
