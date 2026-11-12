import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdministration } from '../../../application/controllers/useAdministration';
import { useApp } from '../../../../shared/application/context';
import { messages } from '../../../../shared/content/fr';
import { useAdminFleet } from './useAdminFleet';
import { useAdminFleetMap } from './useAdminFleetMap';
import { errorMessage } from '../../../../shared/application/error-message';
import { whatsappUrl } from '../../../../shared/messaging/application/services/whatsapp';
import { queueTeamSave } from '../../../planning/application/services/team-save-queue';
import type { Booking, Driver, Point } from '../../../../shared/domain/model';
import {
  activeBookings,
  autoAssignTeamForBooking,
  availabilitySummary,
  availabilityOf,
  availableOn,
  blankAvailability,
  busyBooking as findBusyBooking,
  bookingsForTeamDay,
  bookingsWithCrewForDay,
  crewReplyChanges,
  dayDistance,
  dayIndex,
  driverRefusalPatch,
  employeeAvailabilityCounts,
  firstUpcomingBookingDay,
  isSuspect,
  days,
  defaultMissionMessage,
  formatMinutes,
  googleMapLink,
  iso,
  jobSpan,
  moveDay,
  needsOf,
  newEmployeeValidationError,
  normalizeCrewLead,
  orderBookingsForAutoComposition,
  overlaps,
  referenceVehicleName,
  roleName,
  roles,
  refusalCount,
  shortDate,
  shortTimestamp,
  sortEmployeesByName,
  slotKey,
  slotTimes,
  spanOverlaps,
  sameDayJobs as findSameDayJobs,
  teamWeekDaySummaries,
  tags,
  teamIds,
  teamOf,
  teamBriefRecipients,
  teamCopyBrief,
  updateTeamMemberRole,
  visibleTeamMembers,
  timeMinutes,
  weekStart,
  weekLoad as getWeekLoad,
  type TeamRole,
} from '../../../planning/application/services/team-planning';

export function useAdminFleetPageModel() {
  const [searchParams] = useSearchParams();
  const targetDay = searchParams.get('date') ?? '';
  const targetBooking = searchParams.get('booking') ?? '';
  const { catalogue, requestConfirmation } = useApp();
  const fleetCommands = useAdminFleet();
  const businessWhatsAppPhone =
    catalogue?.settings.whatsappPhone || catalogue?.settings.businessPhone || '';
  const businessWhatsAppCountry = catalogue?.settings.whatsappCountryCode || '221';
  const { bookings, setBookings, loading, error: bookingsError } = useAdministration();
  const [employees, setEmployees] = useState<Driver[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(targetDay) ? targetDay : iso(new Date()),
  );
  const selectedDayManuallyRef = useRef(/^\d{4}-\d{2}-\d{2}$/.test(targetDay));
  const [mapTraffic, setMapTraffic] = useState(true);
  const [mapLayers, setMapLayers] = useState({ employees: true, bookings: true });
  const [placingId, setPlacingId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<{
    bookingId: string;
    distanceKm: number;
    durationMinutes: number;
    geometry: Point[];
  } | null>(null);
  const [selectedRouteStatus, setSelectedRouteStatus] = useState<
    'loading' | 'error' | 'ready' | null
  >(null);
  const [savingBooking, setSavingBooking] = useState('');
  const [savingEmployee, setSavingEmployee] = useState('');
  const [pageError, setPageError] = useState('');
  const [toast, setToast] = useState('');
  const [copiedBooking, setCopiedBooking] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openInfo, setOpenInfo] = useState<Record<string, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [openHours, setOpenHours] = useState<Record<string, boolean>>({});
  const [openOptions, setOpenOptions] = useState('');
  const [filterRole, setFilterRole] = useState<TeamRole | 'all'>('all');
  const [sortByAccepted, setSortByAccepted] = useState(false);
  const [recipient, setRecipient] = useState<Record<string, string>>({});
  const [createdEmployeeAccess, setCreatedEmployeeAccess] = useState<{
    name: string;
    phone: string;
    password: string;
    purpose: 'creation' | 'reset';
  } | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    phone: '',
    address: '',
    role: 'manoeuvre' as TeamRole,
    authorizedVehicleIds: [] as string[],
  });
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [whatsappBriefQueue, setWhatsappBriefQueue] = useState<
    Array<{ booking: Booking; member: Driver; href: string }>
  >([]);
  const employeeSaveQueuesRef = useRef(new Map<string, Promise<Driver>>());
  const confirmedEmployeesRef = useRef(new Map<string, Driver>());
  const bookingSaveQueuesRef = useRef(new Map<string, Promise<Booking | null>>());
  const confirmedBookingsRef = useRef(new Map<string, Booking>());

  useEffect(() => {
    let alive = true;
    fleetCommands
      .loadDrivers()
      .then((data) => {
        if (!alive) return;
        for (const employee of data) confirmedEmployeesRef.current.set(employee.id, employee);
        setEmployees(data);
      })
      .catch((cause: unknown) => alive && setPageError(errorMessage(cause)))
      .finally(() => {
        if (alive) setEmployeesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fleetCommands]);

  const currentBookings = useMemo(() => activeBookings(bookings), [bookings]);
  const busyBooking = (employeeId: string, booking: Booking, source = currentBookings) =>
    findBusyBooking(employeeId, booking, source);
  const sameDayJobs = (employeeId: string, booking: Booking, source = currentBookings) =>
    findSameDayJobs(employeeId, booking, source);
  const weekLoad = (employeeId: string, day: string) =>
    getWeekLoad(employeeId, day, currentBookings);
  const chooseDay = useCallback((day: string) => {
    selectedDayManuallyRef.current = true;
    setSelectedDay(day);
  }, []);
  useEffect(() => {
    if (loading || selectedDayManuallyRef.current) return;
    const today = iso(new Date());
    const initialDay = firstUpcomingBookingDay(currentBookings, today);
    setSelectedDay((day) => (day === initialDay ? day : initialDay));
  }, [currentBookings, loading]);
  const dayBookings = useMemo(
    () => bookingsForTeamDay(currentBookings, selectedDay),
    [currentBookings, selectedDay],
  );
  useEffect(() => {
    if (!targetBooking || loading || !dayBookings.some((booking) => booking.id === targetBooking))
      return;
    const timer = window.setTimeout(() => {
      const card = [...document.querySelectorAll<HTMLElement>('.teams-job')].find(
        (element) => element.dataset.bookingId === targetBooking,
      );
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('teams-job-highlight');
      window.setTimeout(() => card?.classList.remove('teams-job-highlight'), 2500);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [targetBooking, loading, dayBookings]);
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const saveEmployee = useCallback(
    async (employee: Driver, patch: Partial<Driver>) => {
      const next = { ...employee, ...patch };
      const previousSave = employeeSaveQueuesRef.current.get(employee.id);
      setEmployees((current) => current.map((item) => (item.id === employee.id ? next : item)));
      setSavingEmployee(employee.id);
      setPageError('');
      const save = (previousSave ? previousSave.catch(() => undefined) : Promise.resolve())
        .then(() => fleetCommands.updateDriver(next))
        .then((updated) => {
          confirmedEmployeesRef.current.set(updated.id, updated);
          return updated;
        });
      employeeSaveQueuesRef.current.set(employee.id, save);
      try {
        const updated = await save;
        if (employeeSaveQueuesRef.current.get(employee.id) === save)
          setEmployees((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        return updated;
      } catch (cause) {
        if (employeeSaveQueuesRef.current.get(employee.id) === save) {
          const confirmed = confirmedEmployeesRef.current.get(employee.id) ?? employee;
          setEmployees((current) =>
            current.map((item) => (item.id === employee.id ? confirmed : item)),
          );
          setPageError(errorMessage(cause));
        }
        return null;
      } finally {
        if (employeeSaveQueuesRef.current.get(employee.id) === save) {
          employeeSaveQueuesRef.current.delete(employee.id);
          setSavingEmployee('');
        }
      }
    },
    [fleetCommands],
  );
  const saveTeam = useCallback(
    async (booking: Booking, patch: Partial<Booking>) => {
      setSavingBooking(booking.id);
      setPageError('');
      const save = queueTeamSave(
        booking,
        patch,
        bookingSaveQueuesRef.current,
        confirmedBookingsRef.current,
        fleetCommands.updateCrew,
      );
      try {
        const updated = await save;
        setBookings((currentBookings) =>
          currentBookings.map((item) => (item.id === updated.id ? updated : item)),
        );
        return updated;
      } catch (cause) {
        setPageError(errorMessage(cause));
        return null;
      } finally {
        if (!bookingSaveQueuesRef.current.has(booking.id)) setSavingBooking('');
      }
    },
    [fleetCommands, setBookings],
  );

  const { mapRef } = useAdminFleetMap({
    mapElement,
    mapTraffic,
    mapLayers,
    employees,
    dayBookings,
    selectedEmployee,
    setSelectedEmployee,
    placingId,
    setPlacingId,
    selectedRoute,
    fleetCommands,
    saveEmployee,
    setToast,
  });

  const applyMemberPatch = async (employee: Driver, patch: Partial<Driver>) => {
    return saveEmployee(employee, patch);
  };
  const updateEmployeeAddress = async (employee: Driver, address: string) => {
    const normalized = address.trim();
    const saved = await applyMemberPatch(employee, { address });
    if (!saved || !normalized) return;
    try {
      const found = await fleetCommands.searchAddress(`${normalized}, Sénégal`);
      if (!found[0]) {
        setMapError('Adresse introuvable : utilisez « Placer sur la carte ».');
        return;
      }
      await applyMemberPatch(saved, {
        latitude: found[0].point[0],
        longitude: found[0].point[1],
        geocodedAddress: normalized,
      });
      setMapError('');
    } catch (cause) {
      setMapError(errorMessage(cause));
    }
  };
  const addEmployee = async () => {
    const name = newEmployee.name.trim();
    const phone = newEmployee.phone.trim();
    const validationError = newEmployeeValidationError(name, phone);
    if (validationError) return setPageError(validationError);
    setPageError('');
    setCreatedEmployeeAccess(null);
    try {
      const created = await fleetCommands.createDriver({
        name,
        phone,
        photo: null,
        vehicleId: null,
        role: newEmployee.role,
        address: newEmployee.address.trim(),
        availability: blankAvailability(),
        authorizedVehicleIds: newEmployee.authorizedVehicleIds,
        tags: [],
        notes: '',
        refusals: [],
        clearedRefusals: 0,
      });
      const { initialPassword, ...employee } = created;
      confirmedEmployeesRef.current.set(employee.id, employee);
      setEmployees((current) => sortEmployeesByName([...current, employee]));
      setCreatedEmployeeAccess({
        name,
        phone: employee.phone,
        password: initialPassword,
        purpose: 'creation',
      });
      setNewEmployee({
        name: '',
        phone: '',
        address: '',
        role: 'manoeuvre',
        authorizedVehicleIds: [],
      });
      setToast(`${name} ajouté(e).`);
      if (employee.address) {
        try {
          const result = await fleetCommands.searchAddress(`${employee.address}, Sénégal`);
          if (result[0])
            await saveEmployee(employee, {
              latitude: result[0].point[0],
              longitude: result[0].point[1],
            });
        } catch {
          /* Address can be placed manually on the map. */
        }
      }
    } catch (cause) {
      setPageError(errorMessage(cause));
    }
  };
  const resetEmployeePassword = async (employee: Driver) => {
    const confirmed = await requestConfirmation({
      titleId: 'reset-employee-password-title',
      eyebrow: messages.confirmationRequise,
      title: `Réinitialiser le mot de passe de ${employee.name} ?`,
      description:
        'L’ancien mot de passe ne fonctionnera plus. Les sessions de cet employé seront fermées et un nouveau mot de passe sera affiché pour être copié ou envoyé.',
      confirmLabel: 'Générer un nouveau mot de passe',
    });
    if (!confirmed) return;
    setSavingEmployee(employee.id);
    setPageError('');
    try {
      const { password } = await fleetCommands.resetDriverPassword(employee.id);
      setCreatedEmployeeAccess({
        name: employee.name,
        phone: employee.phone,
        password,
        purpose: 'reset',
      });
      setToast(`Nouveau mot de passe créé pour ${employee.name}.`);
    } catch (cause) {
      setPageError(errorMessage(cause));
    } finally {
      setSavingEmployee('');
    }
  };
  const removeEmployee = async (employee: Driver) => {
    const confirmed = await requestConfirmation({
      titleId: 'delete-employee-title',
      eyebrow: messages.confirmationRequise,
      title: messages.supprimerEmployeTitre(employee.name),
      description: messages.suppressionEmployeDescription(employee.name),
      confirmLabel: messages.confirmerAction,
    });
    if (!confirmed) return;
    setSavingEmployee(employee.id);
    setPageError('');
    try {
      const result = await fleetCommands.deleteDriver(employee.id);
      if (result.removed) {
        confirmedEmployeesRef.current.delete(employee.id);
        setEmployees((current) => current.filter((item) => item.id !== employee.id));
        setBookings(await fleetCommands.loadBookings());
        if (selectedEmployee === employee.id) setSelectedEmployee('');
        setToast(`${employee.name} supprimé(e).`);
      } else {
        setEmployees((current) =>
          current.map((item) => (item.id === employee.id ? result.employee : item)),
        );
        setToast(`${employee.name} désactivé(e) : son compte chauffeur est conservé.`);
      }
    } catch (cause) {
      setPageError(errorMessage(cause));
    } finally {
      setSavingEmployee('');
    }
  };

  const addDaysForWeek = useMemo(
    () => teamWeekDaySummaries(currentBookings, selectedDay),
    [currentBookings, selectedDay],
  );

  const autoCompose = async () => {
    let plannedBookings = [...currentBookings];
    let added = 0;
    let missing = 0;
    const autoJobs = orderBookingsForAutoComposition(dayBookings);
    for (const booking of autoJobs) {
      const currentBooking = plannedBookings.find((item) => item.id === booking.id) ?? booking;
      const assignment = autoAssignTeamForBooking({
        booking: currentBooking,
        employees,
        date: selectedDay,
        plannedBookings,
      });
      added += assignment.added;
      missing += assignment.missing;
      const saved = await saveTeam(currentBooking, { crew: assignment.crew });
      if (saved)
        plannedBookings = plannedBookings.map((item) => (item.id === saved.id ? saved : item));
    }
    for (const booking of bookingsWithCrewForDay(bookings, selectedDay)) {
      const currentBooking = plannedBookings.find((item) => item.id === booking.id) ?? booking;
      const crew = teamOf(currentBooking);
      const normalizedCrew = normalizeCrewLead(crew);
      if (normalizedCrew.chef === crew.chef) continue;
      const saved = await saveTeam(currentBooking, { crew: normalizedCrew });
      if (saved)
        plannedBookings = plannedBookings.map((item) => (item.id === saved.id ? saved : item));
    }
    setToast(
      added
        ? `${added} affectation(s) ajoutée(s)${missing ? `, il manque encore ${missing} personne(s).` : '.'}`
        : missing
          ? `Personne de disponible : il manque ${missing} personne(s).`
          : 'Toutes les équipes sont déjà complètes.',
    );
  };

  const setMemberRole = async (
    booking: Booking,
    role: TeamRole,
    memberId: string,
    add: boolean,
  ) => {
    await saveTeam(booking, { crew: updateTeamMemberRole(booking, role, memberId, add) });
  };

  const changeReply = async (booking: Booking, member: Driver, reply: 'ok' | 'no' | '') => {
    if (reply === 'no') {
      const confirmed = await requestConfirmation({
        titleId: 'refuse-mission-title',
        eyebrow: messages.confirmationRequise,
        title: messages.refuserMissionTitre(member.name),
        description: messages.refusMissionDescription(member.name),
        confirmLabel: messages.confirmerAction,
      });
      if (!confirmed) return;
    }
    const changes = crewReplyChanges(booking, member.id, reply);
    if (reply === 'no') {
      await applyMemberPatch(member, driverRefusalPatch(member, booking, new Date().toISOString()));
    }
    await saveTeam(booking, changes);
  };

  const sendBrief = async (booking: Booking, members: Driver[]) => {
    if (whatsappBriefQueue.length) {
      setPageError(
        'Terminez ou annulez la série de messages WhatsApp en cours avant de recommencer.',
      );
      return;
    }
    const recipients = teamBriefRecipients({
      booking,
      members,
      customMessages,
      businessPhone: businessWhatsAppPhone,
      countryCode: businessWhatsAppCountry,
    }).map((recipient) => ({
      ...recipient,
      href: whatsappUrl(recipient.phone, recipient.message, catalogue?.settings),
    }));
    const [first, ...remaining] = recipients;
    if (!first) return setPageError('Aucun numéro de téléphone dans l’équipe.');
    const whatsappWindow = window.open(first.href, '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    setWhatsappBriefQueue(remaining);
    const crewBriefs = {
      ...(booking.crewBriefs ?? {}),
      [first.member.id]: new Date().toISOString(),
    };
    await saveTeam(booking, { crewBriefs });
    setToast(
      remaining.length
        ? `Message WhatsApp préparé pour ${first.member.name}. Ouvrez chaque conversation suivante avec le bouton affiché.`
        : `Message WhatsApp préparé pour ${first.member.name}.`,
    );
  };

  const openNextWhatsAppBrief = async () => {
    const [next, ...remaining] = whatsappBriefQueue;
    if (!next) return;
    const whatsappWindow = window.open(next.href, '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    setWhatsappBriefQueue(remaining);
    await saveTeam(next.booking, {
      crewBriefs: {
        ...(next.booking.crewBriefs ?? {}),
        [next.member.id]: new Date().toISOString(),
      },
    });
    setToast(
      remaining.length
        ? `Message WhatsApp préparé pour ${next.member.name}. Ouvrez la conversation suivante avec le bouton affiché.`
        : `Message WhatsApp préparé pour ${next.member.name}.`,
    );
  };

  const copyBrief = async (booking: Booking, members: Driver[]) => {
    const brief = teamCopyBrief(booking, members);
    const done = () => {
      setCopiedBooking(booking.id);
      window.setTimeout(() => setCopiedBooking(''), 1500);
    };
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(brief);
      else throw new Error('Clipboard API unavailable');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = brief;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        /* Clipboard fallback is best effort when browser permissions deny copying. */
      } finally {
        textarea.remove();
      }
    }
    done();
  };

  const visibleEmployees = useMemo(
    () => visibleTeamMembers(employees, bookings, filterRole, sortByAccepted),
    [employees, filterRole, sortByAccepted, bookings],
  );
  const selected = employeeById.get(selectedEmployee);
  const selectedJob = selected
    ? dayBookings.find((booking) => teamIds(booking).includes(selected.id))
    : undefined;

  useEffect(() => {
    if (!selected || !selectedJob || selected.latitude == null || selected.longitude == null) {
      setSelectedRoute(null);
      setSelectedRouteStatus(null);
      return;
    }
    let active = true;
    const start: Point = [selected.latitude, selected.longitude];
    setSelectedRouteStatus('loading');
    void fleetCommands
      .route(start, selectedJob.from)
      .then((route) => {
        if (active)
          setSelectedRoute({
            bookingId: selectedJob.id,
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            geometry: route.geometry,
          });
        if (active) setSelectedRouteStatus('ready');
      })
      .catch(() => {
        if (active) {
          setSelectedRoute(null);
          setSelectedRouteStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [fleetCommands, selected, selectedJob]);
  const availableCounts = employeeAvailabilityCounts(employees, selectedDay);

  return {
    catalogue,
    requestConfirmation,
    fleetCommands,
    businessWhatsAppPhone,
    businessWhatsAppCountry,
    bookings,
    setBookings,
    loading,
    bookingsError,
    employees,
    setEmployees,
    employeesLoading,
    setEmployeesLoading,
    selectedDay,
    setSelectedDay,
    selectedDayManuallyRef,
    mapTraffic,
    setMapTraffic,
    mapLayers,
    setMapLayers,
    placingId,
    setPlacingId,
    selectedEmployee,
    setSelectedEmployee,
    mapElement,
    setMapElement,
    mapRef,
    mapError,
    setMapError,
    selectedRoute,
    setSelectedRoute,
    selectedRouteStatus,
    setSelectedRouteStatus,
    savingBooking,
    setSavingBooking,
    savingEmployee,
    setSavingEmployee,
    pageError,
    setPageError,
    toast,
    setToast,
    copiedBooking,
    setCopiedBooking,
    openSections,
    setOpenSections,
    openInfo,
    setOpenInfo,
    openNotes,
    setOpenNotes,
    openHours,
    setOpenHours,
    openOptions,
    setOpenOptions,
    filterRole,
    setFilterRole,
    sortByAccepted,
    setSortByAccepted,
    createdEmployeeAccess,
    setCreatedEmployeeAccess,
    recipient,
    setRecipient,
    newEmployee,
    setNewEmployee,
    customMessages,
    setCustomMessages,
    employeeSaveQueuesRef,
    confirmedEmployeesRef,
    currentBookings,
    chooseDay,
    dayBookings,
    employeeById,
    dayIndex,
    availabilityOf,
    busyBooking,
    sameDayJobs,
    weekLoad,
    availableOn,
    refusalCount,
    isSuspect,
    saveEmployee,
    saveTeam,
    applyMemberPatch,
    updateEmployeeAddress,
    addEmployee,
    resetEmployeePassword,
    removeEmployee,
    addDaysForWeek,
    autoCompose,
    setMemberRole,
    changeReply,
    sendBrief,
    whatsappBriefQueue,
    openNextWhatsAppBrief,
    cancelWhatsAppBriefs: () => setWhatsappBriefQueue([]),
    copyBrief,
    visibleEmployees,
    selected,
    selectedJob,
    availableCounts,
    roles,
    roleName,
    days,
    tags,
    blankAvailability,
    availabilitySummary,
    iso,
    moveDay,
    weekStart,
    referenceVehicleName,
    shortDate,
    shortTimestamp,
    slotKey,
    slotTimes,
    timeMinutes,
    formatMinutes,
    jobSpan,
    dayDistance,
    spanOverlaps,
    overlaps,
    activeBookings,
    teamOf,
    teamIds,
    needsOf,
    googleMapLink,
    defaultMissionMessage,
  };
}
