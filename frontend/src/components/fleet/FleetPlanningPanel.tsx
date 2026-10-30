import type { Driver } from '../../domain/model';
import { uiText } from '../../content/reference-ui-text';
import type { useAdminFleetPageModel } from '../../application/controllers/useAdminFleetPageModel';
type Model = ReturnType<typeof useAdminFleetPageModel>;
export function FleetPlanningPanel({ model }: { model: Model }) {
  const {
    businessWhatsAppPhone,
    businessWhatsAppCountry,
    bookings,
    loading,
    bookingsError,
    employees,
    selectedDay,
    savingBooking,
    copiedBooking,
    openSections,
    setOpenSections,
    openOptions,
    setOpenOptions,
    recipient,
    setRecipient,
    customMessages,
    setCustomMessages,
    chooseDay,
    dayBookings,
    employeeById,
    busyBooking,
    sameDayJobs,
    weekLoad,
    availableOn,
    refusalCount,
    isSuspect,
    saveTeam,
    addDaysForWeek,
    autoCompose,
    setMemberRole,
    changeReply,
    sendBrief,
    copyBrief,
    availableCounts,
    roles,
    roleName,
    iso,
    moveDay,
    shortDate,
    shortTimestamp,
    slotKey,
    formatMinutes,
    jobSpan,
    overlaps,
    teamOf,
    teamIds,
    needsOf,
    defaultMissionMessage,
  } = model;
  return (
    <section className="teams-panel teams-planning">
      <div className="teams-panel-heading teams-planning-heading">
        <div>
          <span className="teams-eyebrow">{uiText['planningDESEQUIPES']}</span>
          <strong>{shortDate(selectedDay)}</strong>
        </div>
        <div className="teams-date-controls">
          <button
            aria-label={uiText['jourPrecedent']}
            onClick={() => chooseDay(moveDay(selectedDay, -1))}
          >
            ‹
          </button>
          <button onClick={() => chooseDay(iso(new Date()))}>{uiText['aujourdHui']}</button>
          <button
            aria-label={uiText['jourSuivant']}
            onClick={() => chooseDay(moveDay(selectedDay, 1))}
          >
            ›
          </button>
          <input
            type="date"
            value={selectedDay}
            onChange={(event) => event.target.value && chooseDay(event.target.value)}
          />
        </div>
      </div>
      <div className="teams-week">
        {addDaysForWeek.map((item) => (
          <button
            key={item.date}
            className={item.selected ? 'selected' : ''}
            onClick={() => chooseDay(item.date)}
          >
            <span>{item.day}</span>
            <strong>{item.date.slice(8, 10)}</strong>
            <i
              className={
                !item.count
                  ? 'empty'
                  : !item.complete
                    ? 'incomplete'
                    : item.sent
                      ? 'complete'
                      : 'pending'
              }
            />
            <small>{item.count ? `${item.count} déménag.` : '—'}</small>
          </button>
        ))}
      </div>
      <div className="teams-stats">
        {availableCounts.map((item) => (
          <div key={item.id}>
            <span>{item.plural}</span>
            <strong style={{ color: item.color }}>{item.available}</strong>
            <small>{item.available > 1 ? 'disponibles' : 'disponible'}</small>
            {item.resting.length > 0 && (
              <em>
                {uiText['repos']}
                {item.resting.join(', ')}
              </em>
            )}
          </div>
        ))}
      </div>
      {!!dayBookings.length && (
        <button className="team-button primary" onClick={() => void autoCompose()}>
          {uiText['composerLesEquipesAutomatiquement']}
        </button>
      )}
      {loading ? (
        <p className="teams-empty">{uiText['chargementDuPlanning']}</p>
      ) : bookingsError ? (
        <p className="teams-error">{bookingsError}</p>
      ) : !dayBookings.length ? (
        <p className="teams-empty">{uiText['aucunDemenagementCeJourLa']}</p>
      ) : null}

      {dayBookings.map((booking) => {
        const crew = teamOf(booking);
        const needs = needsOf(booking);
        const members = teamIds(booking)
          .map((id) => employeeById.get(id))
          .filter((member): member is Driver => Boolean(member));
        const staleAddressBriefs = members.filter((member) => {
          const sentAt = booking.crewBriefs?.[member.id];
          return Boolean(
            booking.crewAddressChange && sentAt && sentAt < booking.crewAddressChange.at,
          );
        });
        const complete = roles.every((role) => crew[role.id].length >= needs[role.id]);
        const wasSent = members.filter((member) => booking.crewBriefs?.[member.id]).length;
        const accepted = members.filter(
          (member) => booking.crewReplies?.[member.id] === 'ok',
        ).length;
        const allAccepted = members.length > 0 && accepted === members.length && complete;
        const jobKey = booking.id;
        const to = recipient[jobKey] ?? 'all';
        const editMember =
          to === 'all' ? null : (members.find((member) => member.id === to) ?? null);
        const route = `${booking.fromAddress || '—'} → ${booking.toAddress || '—'}`;
        const warningSet = new Set<string>();
        if (!booking.fromAddress)
          warningSet.add(
            'Adresse de retrait manquante : complétez-la dans le devis pour préparer le lien Google Maps.',
          );
        const vehicleConflicts = dayBookings.filter(
          (item) =>
            item.id !== booking.id &&
            item.vehicle.id === booking.vehicle.id &&
            overlaps(slotKey(item.timeSlot), slotKey(booking.timeSlot)),
        );
        if (vehicleConflicts.length)
          warningSet.add(
            `Le ${booking.vehicle.name} est aussi prévu sur ${vehicleConflicts.map((item) => item.reference).join(', ')} au même créneau.`,
          );
        for (const member of members) {
          const busy = busyBooking(member.id, booking);
          if (busy)
            warningSet.add(
              `${member.name} est aussi affecté(e) au déménagement ${busy.reference} au même créneau.`,
            );
          if (isSuspect(member))
            warningSet.add(
              `${member.name} est signalé(e) suspect (${member.refusals?.length ?? 0} refus) : à remplacer.`,
            );
          if (
            (member.role ?? 'chauffeur') === 'chauffeur' &&
            member.authorizedVehicleIds?.length &&
            !member.authorizedVehicleIds.includes(booking.vehicle.id)
          )
            warningSet.add(
              `${member.name} n'est pas habilité(e) à conduire le ${booking.vehicle.name}.`,
            );
          const availability = availableOn(member, selectedDay, booking);
          if (!availability.ok) warningSet.add(`${member.name} : ${availability.why}.`);
        }
        const messageText = editMember
          ? (customMessages[`${booking.id}|${editMember.id}`] ??
            booking.crewMessages?.[editMember.id] ??
            defaultMissionMessage(
              booking,
              editMember,
              members,
              businessWhatsAppPhone,
              businessWhatsAppCountry,
            ))
          : '';
        const jobNeeds = roles.map((role) => ({
          role,
          list: employees.filter((employee) => (employee.role ?? 'chauffeur') === role.id),
          selectedIds: crew[role.id],
        }));
        return (
          <article className="teams-job" key={booking.id}>
            <div className="teams-job-heading">
              <div>
                <div>
                  <span className="teams-slot">{booking.timeSlot || 'Journée'}</span>
                  <strong>
                    {booking.reference} · {booking.customerName}
                  </strong>
                </div>
                <span>
                  {booking.vehicle.name} · {route}
                </span>
              </div>
              <div className={complete ? 'team-status complete' : 'team-status'}>
                {complete ? 'Équipe complète' : 'Équipe incomplète'}
                {members.length > 0 && (
                  <small style={{ color: allAccepted ? '#3ddc84' : '#ffd23f' }}>
                    {allAccepted
                      ? '✓ Mission acceptée par toute l’équipe'
                      : `Réponses : ${accepted} / ${members.length} acceptée${accepted > 1 ? 's' : ''}`}
                  </small>
                )}
              </div>
            </div>
            {!!warningSet.size && (
              <ul className="teams-warnings">
                {[...warningSet].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {staleAddressBriefs.length > 0 && (
              <aside className="teams-address-update" role="status">
                <strong>{uiText['adresseModifieeConsigneARenvoyer']}</strong>
                <span>
                  {staleAddressBriefs.map((member) => member.name).join(', ')}{' '}
                  {uiText['nOntPasRecuLesNouvellesAdresses']}
                </span>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void sendBrief(booking, staleAddressBriefs)}
                >
                  {uiText['renvoyerA']}
                  {staleAddressBriefs.length} {uiText['personne']}
                  {staleAddressBriefs.length > 1 ? 's' : ''}
                </button>
              </aside>
            )}
            {!!booking.crewRefusedBy?.filter((id) => !teamIds(booking).includes(id)).length && (
              <p className="teams-refusals">
                {uiText['refusPrecedents']}{' '}
                {booking.crewRefusedBy
                  .filter((id) => !teamIds(booking).includes(id))
                  .map((id) => employeeById.get(id))
                  .filter((member): member is Driver => Boolean(member))
                  .map(
                    (member) =>
                      `${member.name} (${roleName(member.role ?? 'chauffeur').toLowerCase()}, ${member.refusals?.length ?? 0} refus${isSuspect(member) ? ', suspect' : ''})`,
                  )
                  .join(' · ')}
                {uiText['remplacezLesPersonnesAyantRefuse']}
              </p>
            )}
            <div className="teams-accordions">
              <section className="teams-accordion">
                <button
                  className="teams-accordion-heading"
                  onClick={() =>
                    setOpenSections((value) => ({
                      ...value,
                      [`${jobKey}:assign`]: !value[`${jobKey}:assign`],
                    }))
                  }
                >
                  <span>{openSections[`${jobKey}:assign`] ? '⌄' : '›'}</span>
                  <strong>{uiText['affectation']}</strong>
                  <b className={complete ? 'good' : 'bad'}>
                    {complete ? 'Complète' : 'Incomplète'}
                  </b>
                </button>
                {Boolean(openSections[`${jobKey}:assign`]) && (
                  <div className="teams-accordion-content">
                    {jobNeeds
                      .filter(
                        ({ role, selectedIds }) => needs[role.id] > 0 || selectedIds.length > 0,
                      )
                      .map(({ role, list, selectedIds }) => (
                        <div className="teams-role" key={role.id}>
                          <strong style={{ color: role.color }}>
                            {needs[role.id] > 1 || selectedIds.length > 1
                              ? role.plural
                              : role.label}{' '}
                            · {selectedIds.length} / {needs[role.id]}
                          </strong>
                          <div className="teams-chips">
                            {selectedIds.map((id) => {
                              const member = employeeById.get(id);
                              const conflict = busyBooking(id, booking);
                              const availability = member
                                ? availableOn(member, selectedDay, booking)
                                : { ok: true, why: '' };
                              const warning = !availability.ok
                                ? availability.why
                                : conflict
                                  ? `déjà sur ${conflict.reference}`
                                  : '';
                              return (
                                <span
                                  className="teams-person-chip"
                                  key={id}
                                  style={warning ? { borderColor: '#ff6b6b' } : undefined}
                                >
                                  {member?.name ?? 'Employé supprimé'}
                                  {warning && (
                                    <small className="teams-person-warning">{warning}</small>
                                  )}
                                  <button
                                    title={uiText['retirer']}
                                    onClick={() => void setMemberRole(booking, role.id, id, false)}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                            <button
                              className="team-chip add"
                              onClick={() =>
                                setOpenOptions(
                                  openOptions === `${jobKey}:${role.id}`
                                    ? ''
                                    : `${jobKey}:${role.id}`,
                                )
                              }
                            >
                              {openOptions === `${jobKey}:${role.id}` ? 'Fermer' : '+ Ajouter'}
                            </button>
                          </div>
                          {openOptions === `${jobKey}:${role.id}` && (
                            <div className="teams-options">
                              {list
                                .filter((employee) => !teamIds(booking).includes(employee.id))
                                .map((employee) => {
                                  const busy = busyBooking(employee.id, booking);
                                  const availability = availableOn(employee, selectedDay, booking);
                                  const cannotDrive =
                                    role.id === 'chauffeur' &&
                                    employee.authorizedVehicleIds?.length &&
                                    !employee.authorizedVehicleIds.includes(booking.vehicle.id);
                                  const wasRefused = (booking.crewRefusedBy ?? []).includes(
                                    employee.id,
                                  );
                                  const acceptedCount = bookings.filter(
                                    (item) =>
                                      item.status !== 'cancelled' &&
                                      item.crewReplies?.[employee.id] === 'ok',
                                  ).length;
                                  const refusalTotal = employee.refusals?.length ?? 0;
                                  const dayJobs = sameDayJobs(employee.id, booking);
                                  const availabilityText = busy
                                    ? `Déjà sur ${busy.reference}`
                                    : !availability.ok
                                      ? availability.why
                                      : availability.note ||
                                        (cannotDrive
                                          ? `Non habilité ${booking.vehicle.name}`
                                          : dayJobs.length
                                            ? `Déjà ${dayJobs
                                                .map((item) => {
                                                  const span = jobSpan(item);
                                                  return `${item.reference.replace(/^DEM-/u, '')} ${formatMinutes(span.s)}–${formatMinutes(span.e)}`;
                                                })
                                                .join(', ')}, sans chevauchement`
                                            : `${weekLoad(employee.id, selectedDay)} déménagement${weekLoad(employee.id, selectedDay) > 1 ? 's' : ''} cette semaine`);
                                  return (
                                    <button
                                      key={employee.id}
                                      disabled={!employee.active || !!busy || !availability.ok}
                                      onClick={() =>
                                        void setMemberRole(booking, role.id, employee.id, true)
                                      }
                                    >
                                      <strong>
                                        {isSuspect(employee) ? '⚠ ' : ''}
                                        {employee.name}
                                      </strong>
                                      <span>
                                        <span
                                          style={{
                                            color:
                                              !availability.ok || busy
                                                ? '#ff6b6b'
                                                : wasRefused || isSuspect(employee)
                                                  ? '#ffd23f'
                                                  : '#aeb4bb',
                                          }}
                                        >
                                          {wasRefused ? 'a déjà refusé cette mission · ' : ''}
                                          {isSuspect(employee)
                                            ? `suspect, ${refusalCount(employee)} refus · `
                                            : ''}
                                          {availabilityText} · {acceptedCount} {uiText['accepteeS']}
                                          {refusalTotal ? ` · ${refusalTotal} refus` : ''}
                                          {employee.tags?.length
                                            ? ` · ${employee.tags.join(', ')}`
                                            : ''}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              {!list.some((employee) => !teamIds(booking).includes(employee.id)) &&
                                selectedIds.length < needs[role.id] && (
                                  <span className="teams-muted">
                                    {employees.some(
                                      (employee) => (employee.role ?? 'chauffeur') === role.id,
                                    )
                                      ? 'Plus personne de libre dans ce rôle.'
                                      : `Aucun ${role.label.toLowerCase()} enregistré : ajoutez-en dans la liste Employés.`}
                                  </span>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </section>
              {members.length > 0 && (
                <>
                  <section className="teams-accordion">
                    <button
                      className="teams-accordion-heading"
                      onClick={() =>
                        setOpenSections((value) => ({
                          ...value,
                          [`${jobKey}:send`]: !value[`${jobKey}:send`],
                        }))
                      }
                    >
                      <span>{openSections[`${jobKey}:send`] ? '⌄' : '›'}</span>
                      <strong>{uiText['envoiDELAMISSION']}</strong>
                      <b>
                        {wasSent} / {members.length} {uiText['envoye']}
                        {wasSent > 1 ? 's' : ''}
                      </b>
                    </button>
                    {Boolean(openSections[`${jobKey}:send`]) && (
                      <div className="teams-accordion-content">
                        <div className="teams-send-controls">
                          <label>
                            {uiText['envoyerA']}
                            <select
                              value={to}
                              onChange={(event) =>
                                setRecipient((value) => ({
                                  ...value,
                                  [jobKey]: event.target.value,
                                }))
                              }
                            >
                              <option value="all">
                                {uiText['touteLEquipe']}
                                {members.length})
                              </option>
                              {members.map((member) => (
                                <option value={member.id} key={member.id}>
                                  {member.name}
                                  {booking.crewMessages?.[member.id] ? ' · personnalisé' : ''}
                                  {!member.phone.replace(/\D/g, '') ? ' · sans numéro' : ''}
                                  {booking.crewBriefs?.[member.id] ? ' · ✓' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="team-button"
                            onClick={() => void copyBrief(booking, members)}
                          >
                            {copiedBooking === booking.id ? 'Copié ✓' : 'Copier le brief'}
                          </button>
                        </div>
                        {editMember && (
                          <label className="teams-message-editor">
                            <span>
                              {uiText['messagePour']}
                              {editMember.name} ·{' '}
                              {roleName(editMember.role ?? 'chauffeur').toLowerCase()}
                            </span>
                            {booking.crewMessages?.[editMember.id] && (
                              <button
                                type="button"
                                className="teams-reset-message"
                                onClick={() => {
                                  const crewMessages = { ...(booking.crewMessages ?? {}) };
                                  delete crewMessages[editMember.id];
                                  setCustomMessages((value) => {
                                    const next = { ...value };
                                    delete next[`${jobKey}|${editMember.id}`];
                                    return next;
                                  });
                                  void saveTeam(booking, { crewMessages });
                                }}
                              >
                                {uiText['retablirLeMessageParDefaut']}
                              </button>
                            )}
                            <textarea
                              rows={8}
                              value={messageText}
                              onChange={(event) =>
                                setCustomMessages((value) => ({
                                  ...value,
                                  [`${jobKey}|${editMember.id}`]: event.target.value,
                                }))
                              }
                              onBlur={() =>
                                void saveTeam(booking, {
                                  crewMessages: {
                                    ...(booking.crewMessages ?? {}),
                                    [editMember.id]: messageText,
                                  },
                                })
                              }
                            />
                          </label>
                        )}
                        {editMember && !editMember.phone.replace(/\D/g, '') && (
                          <span className="teams-no-phone">
                            {uiText['pasDeNumeroPourCettePersonneAjoutezLeDansLaListeEmploy']}
                          </span>
                        )}
                        <button
                          className="team-button success"
                          disabled={
                            !members.some((member) => member.phone.replace(/\D/g, '').length >= 9)
                          }
                          onClick={() =>
                            void sendBrief(booking, editMember ? [editMember] : members)
                          }
                        >
                          {editMember
                            ? `Envoyer à ${editMember.name.split(' ')[0]} (WhatsApp)`
                            : `Envoyer à toute l'équipe (${members.filter((member) => member.phone.replace(/\D/g, '')).length})`}
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="teams-accordion">
                    <button
                      className="teams-accordion-heading"
                      onClick={() =>
                        setOpenSections((value) => ({
                          ...value,
                          [`${jobKey}:replies`]: !value[`${jobKey}:replies`],
                        }))
                      }
                    >
                      <span>{openSections[`${jobKey}:replies`] ? '⌄' : '›'}</span>
                      <strong>{uiText['suiviDESREPONSES']}</strong>
                      <b>
                        {accepted} / {members.length} {uiText['acceptee']}
                        {accepted > 1 ? 's' : ''}
                      </b>
                    </button>
                    {Boolean(openSections[`${jobKey}:replies`]) && (
                      <div className="teams-accordion-content">
                        {members.map((member) => {
                          const reply = booking.crewReplies?.[member.id];
                          return (
                            <div className="teams-reply" key={member.id}>
                              <strong>
                                {member.name}
                                {isSuspect(member) ? ' ⚠' : ''}
                              </strong>
                              <button
                                className="team-button"
                                onClick={() => {
                                  const crewBriefs = { ...(booking.crewBriefs ?? {}) };
                                  if (crewBriefs[member.id]) delete crewBriefs[member.id];
                                  else crewBriefs[member.id] = new Date().toISOString();
                                  void saveTeam(booking, { crewBriefs });
                                }}
                              >
                                {booking.crewBriefs?.[member.id]
                                  ? 'Marquer non envoyé'
                                  : 'Marquer envoyé'}
                              </button>
                              {booking.crewBriefs?.[member.id] && (
                                <small>
                                  {uiText['envoyeLe']}
                                  {shortTimestamp(booking.crewBriefs[member.id])}
                                </small>
                              )}
                              <span
                                className={
                                  reply === 'ok' ? 'reply-ok' : reply === 'no' ? 'reply-no' : ''
                                }
                              >
                                {reply === 'ok'
                                  ? `✓ A accepté${(booking.crewRefusedBy ?? []).includes(member.id) ? ' (après un refus)' : ''}`
                                  : reply === 'no'
                                    ? 'A refusé puis réaffecté · en attente de réponse'
                                    : 'En attente de réponse'}
                              </span>
                              <div>
                                {reply !== 'ok' && (
                                  <button
                                    className="team-button success"
                                    onClick={() => void changeReply(booking, member, 'ok')}
                                  >
                                    {uiText['aAccepte']}
                                  </button>
                                )}
                                {reply === 'ok' && (
                                  <button
                                    className="team-button"
                                    onClick={() => void changeReply(booking, member, '')}
                                  >
                                    {uiText['annuler']}
                                  </button>
                                )}
                                <button
                                  className="team-button danger"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `${member.name} a refusé la mission ? Il/elle sera retiré(e) de l’équipe.`,
                                      )
                                    )
                                      void changeReply(booking, member, 'no');
                                  }}
                                >
                                  {uiText['aRefuse']}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
            {savingBooking === booking.id && (
              <small className="teams-saving">{uiText['enregistrement']}</small>
            )}
          </article>
        );
      })}
    </section>
  );
}
