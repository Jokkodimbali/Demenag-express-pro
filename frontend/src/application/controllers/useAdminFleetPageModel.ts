import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdministration } from '../../application/controllers/useAdministration';
import { useApp } from '../../application/context';
import { useAdminFleet } from '../../application/controllers/useAdminFleet';
import { errorMessage } from '../../application/error-message';
import type { Booking, Driver, Point } from '../../domain/model';
import {
  activeBookings,
  availabilitySummary,
  blankAvailability,
  dayDistance,
  days,
  defaultMissionMessage,
  formatMinutes,
  googleMapLink,
  iso,
  jobSpan,
  moveDay,
  needsOf,
  overlaps,
  referenceVehicleName,
  roleName,
  roles,
  shortDate,
  shortTimestamp,
  slotKey,
  slotTimes,
  spanOverlaps,
  tags,
  teamIds,
  teamOf,
  timeMinutes,
  trafficTiles,
  weekStart,
  type AvailabilityResult,
  type TeamRole,
} from '../../application/services/team-planning';

export function useAdminFleetPageModel() {
  const { catalogue } = useApp();
  const fleetCommands = useAdminFleet();
  const businessWhatsAppPhone =
    catalogue?.settings.whatsappPhone || catalogue?.settings.businessPhone || '';
  const businessWhatsAppCountry = catalogue?.settings.whatsappCountryCode || '221';
  const { bookings, setBookings, loading, error: bookingsError } = useAdministration();
  const [employees, setEmployees] = useState<Driver[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => iso(new Date()));
  const selectedDayManuallyRef = useRef(false);
  const [mapTraffic, setMapTraffic] = useState(true);
  const [mapLayers, setMapLayers] = useState({ employees: true, bookings: true });
  const [placingId, setPlacingId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
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
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    phone: '',
    password: '',
    address: '',
    role: 'manoeuvre' as TeamRole,
    authorizedVehicleIds: [] as string[],
  });
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const employeeSaveQueuesRef = useRef(new Map<string, Promise<Driver>>());
  const confirmedEmployeesRef = useRef(new Map<string, Driver>());

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
  const chooseDay = useCallback((day: string) => {
    selectedDayManuallyRef.current = true;
    setSelectedDay(day);
  }, []);
  useEffect(() => {
    if (loading || selectedDayManuallyRef.current) return;
    const today = iso(new Date());
    const nextBookingDay = currentBookings
      .map((booking) => booking.date)
      .filter((day): day is string => Boolean(day && day >= today))
      .sort()[0];
    const initialDay = nextBookingDay ?? today;
    setSelectedDay((day) => (day === initialDay ? day : initialDay));
  }, [currentBookings, loading]);
  const dayBookings = useMemo(
    () =>
      currentBookings
        .filter((booking) => booking.date === selectedDay)
        .sort((a, b) => {
          const order = { journee: 0, matin: 1, aprem: 2 };
          return order[slotKey(a.timeSlot)] - order[slotKey(b.timeSlot)];
        }),
    [currentBookings, selectedDay],
  );
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const dayIndex = (day: string) => (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
  const availabilityOf = (employee: Driver) =>
    employee.availability?.length === 7 ? employee.availability : blankAvailability();
  const busyBooking = (id: string, current: Booking, source = currentBookings) => {
    if (!current.date) return undefined;
    const currentSpan = jobSpan(current);
    return source.find((booking) => {
      if (booking.id === current.id || !booking.date || !teamIds(booking).includes(id))
        return false;
      const offset = dayDistance(current.date!, booking.date);
      if (Math.abs(offset) > 1) return false;
      return spanOverlaps(currentSpan, jobSpan(booking), offset);
    });
  };
  const sameDayJobs = (id: string, current: Booking, source = currentBookings) =>
    source.filter(
      (booking) =>
        booking.id !== current.id && booking.date === current.date && teamIds(booking).includes(id),
    );
  const weekLoad = (id: string, day: string) => {
    const start = weekStart(day);
    return currentBookings.filter(
      (booking) =>
        booking.date! >= start &&
        booking.date! <= moveDay(start, 6) &&
        teamIds(booking).includes(id),
    ).length;
  };
  const availableOn = (employee: Driver, day: string, booking: Booking): AvailabilityResult => {
    if (!employee.active) return { ok: false, why: 'indisponible' };
    const availability = availabilityOf(employee)[dayIndex(day)];
    if (!availability?.available)
      return {
        ok: false,
        why: `repos le ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][dayIndex(day)]}`,
      };
    const span = jobSpan(booking);
    const start = timeMinutes(availability.startTime) ?? 480;
    const end = timeMinutes(availability.endTime) || 1440;
    const estimatedEnd = Math.min(span.e, 1440);
    if (span.s < start || span.s >= end)
      return {
        ok: false,
        why: `hors horaires : dispo ${availability.startTime}-${availability.endTime}, début ${formatMinutes(span.s)}`,
      };
    if (span.real && estimatedEnd > end)
      return {
        ok: true,
        why: '',
        note: `fin estimée ${formatMinutes(span.e)}, après ${availability.endTime}`,
      };
    return { ok: true, why: '' };
  };
  const refusalCount = (employee: Driver) =>
    Math.max(0, (employee.refusals?.length ?? 0) - (employee.clearedRefusals ?? 0));
  const isSuspect = (employee: Driver) => refusalCount(employee) >= 3;
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
      const next = { ...booking, ...patch };
      setSavingBooking(booking.id);
      setPageError('');
      try {
        const updated = await fleetCommands.updateCrew(booking.id, {
          crew: teamOf(next),
          crewBriefs: next.crewBriefs ?? {},
          crewRefusedBy: next.crewRefusedBy ?? [],
          crewReplies: next.crewReplies ?? {},
          crewMessages: next.crewMessages ?? {},
          version: booking.version,
        });
        setBookings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        return updated;
      } catch (cause) {
        setPageError(errorMessage(cause));
        return null;
      } finally {
        setSavingBooking('');
      }
    },
    [fleetCommands, setBookings],
  );

  const employeesRef = useRef(employees);
  const placingIdRef = useRef(placingId);
  const saveEmployeeRef = useRef(saveEmployee);
  employeesRef.current = employees;
  placingIdRef.current = placingId;
  saveEmployeeRef.current = saveEmployee;

  useEffect(() => {
    if (!mapElement || mapRef.current) return;
    const map = L.map(mapElement, { scrollWheelZoom: true }).setView([14.72, -17.35], 11);
    const tile = L.tileLayer(trafficTiles(true), {
      subdomains: '0123',
      maxZoom: 20,
      attribution: 'Données cartographiques et trafic © Google',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    map.on('click', async (event) => {
      const selectedId = placingIdRef.current;
      if (!selectedId) return;
      const point: Point = [event.latlng.lat, event.latlng.lng];
      const target = employeesRef.current.find((employee) => employee.id === selectedId);
      setPlacingId('');
      if (!target) return;
      let address = target.address ?? '';
      if (!address.trim()) {
        try {
          address = (await fleetCommands.reverseAddress(point)).label || address;
        } catch {
          /* Keep the placed coordinates when reverse lookup is unavailable. */
        }
      }
      await saveEmployeeRef.current(target, {
        latitude: point[0],
        longitude: point[1],
        ...(address.trim() ? { address, geocodedAddress: address.trim() } : {}),
      });
      setToast(`Logement de ${target.name} enregistré sur la carte.`);
    });
    mapRef.current = map;
    tileRef.current = tile;
    layerRef.current = layer;
    const resize = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layerRef.current = null;
    };
  }, [fleetCommands, mapElement]);

  useEffect(() => {
    tileRef.current?.setUrl(trafficTiles(mapTraffic));
  }, [mapTraffic]);
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    const assigned = new Map<string, Booking>();
    for (const booking of dayBookings) for (const id of teamIds(booking)) assigned.set(id, booking);
    if (mapLayers.employees)
      for (const employee of employees) {
        if (employee.latitude == null || employee.longitude == null) continue;
        const job = assigned.get(employee.id);
        const role = roles.find((value) => value.id === (employee.role ?? 'chauffeur')) ?? roles[0];
        const markerLabel = document.createElement('span');
        markerLabel.className = `team-map-marker${employee.id === selectedEmployee ? ' selected' : ''}`;
        markerLabel.style.setProperty('--marker-color', role.color);
        const dot = document.createElement('span');
        dot.className = 'team-map-marker-dot';
        if (!employee.active) dot.classList.add('inactive');
        const name = document.createElement('span');
        name.className = 'team-map-marker-name';
        name.textContent = `${employee.name.split(' ')[0]}${job ? ` · ${job.reference}` : ''}`;
        markerLabel.append(dot, name);
        const marker = L.marker([employee.latitude, employee.longitude], {
          draggable: true,
          zIndexOffset: employee.id === selectedEmployee ? 1000 : 0,
          icon: L.divIcon({
            className: 'team-map-marker-shell',
            html: markerLabel.outerHTML,
            iconSize: [0, 0],
          }),
        }).addTo(layer);
        marker.on('click', () => {
          if (selectedEmployee === employee.id) setSelectedEmployee('');
          else {
            setSelectedEmployee(employee.id);
            map.setView([employee.latitude!, employee.longitude!], 15);
          }
        });
        marker.on('dragend', async () => {
          const point = marker.getLatLng();
          await saveEmployee(employee, { latitude: point.lat, longitude: point.lng });
        });
        const popup = document.createElement('div');
        popup.textContent = `${employee.name}\n${role.label}\n${employee.address ?? ''}\n${employee.phone}${job ? `\nCe jour : ${job.reference} (${job.timeSlot || 'journée'})` : ''}`;
        marker.bindPopup(popup);
        bounds.push([employee.latitude, employee.longitude]);
        if (mapLayers.bookings && job?.from) {
          const isSelectedRoute =
            employee.id === selectedEmployee && selectedRoute?.bookingId === job.id;
          if (isSelectedRoute && selectedRoute.geometry.length > 1) {
            L.polyline(selectedRoute.geometry, {
              color: '#1E2023',
              weight: 8,
              opacity: 0.55,
            }).addTo(layer);
            L.polyline(selectedRoute.geometry, {
              color: role.color,
              weight: 5,
              opacity: 0.95,
            }).addTo(layer);
          } else {
            L.polyline([[employee.latitude, employee.longitude], job.from], {
              color: role.color,
              weight: 2,
              opacity: 0.65,
              dashArray: '5 6',
            }).addTo(layer);
          }
        }
      }
    if (mapLayers.bookings)
      for (const booking of dayBookings) {
        for (const [point, label, color, address] of [
          [booking.from, 'A', '#2ECC71', booking.fromAddress],
          [booking.to, 'B', '#FF6B6B', booking.toAddress],
        ] as [Point, string, string, string][]) {
          if (!point) continue;
          const markerLabel = document.createElement('span');
          markerLabel.className = 'team-map-job-marker';
          markerLabel.style.setProperty('--job-marker-color', color);
          markerLabel.textContent = `${label} · ${booking.reference}`;
          const stem = document.createElement('span');
          stem.className = 'team-map-job-marker-stem';
          const popup = document.createElement('div');
          popup.textContent = `${booking.reference} · ${booking.customerName || ''}\n${label === 'A' ? 'Départ' : 'Arrivée'} : ${address || ''}`;
          L.marker(point, {
            icon: L.divIcon({
              className: 'team-map-marker-shell',
              html: `${markerLabel.outerHTML}${stem.outerHTML}`,
              iconSize: [0, 0],
            }),
          })
            .addTo(layer)
            .bindPopup(popup);
          bounds.push(point);
        }
      }
    if (!fittedRef.current && bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35], maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [employees, dayBookings, mapLayers, saveEmployee, selectedEmployee, selectedRoute]);

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
    if (!name) return setPageError('Indiquez le nom.');
    if (phone.replace(/\D/g, '').length < 9) return setPageError('Indiquez le téléphone.');
    if (newEmployee.password.length < 10)
      return setPageError('Choisissez un mot de passe initial d’au moins 10 caractères.');
    setPageError('');
    try {
      const created = await fleetCommands.createDriver({
        name,
        phone,
        password: newEmployee.password,
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
      confirmedEmployeesRef.current.set(created.id, created);
      setEmployees((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewEmployee({
        name: '',
        phone: '',
        password: '',
        address: '',
        role: 'manoeuvre',
        authorizedVehicleIds: [],
      });
      setToast(`${name} ajouté(e).`);
      if (created.address) {
        try {
          const result = await fleetCommands.searchAddress(`${created.address}, Sénégal`);
          if (result[0])
            await saveEmployee(created, {
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
  const removeEmployee = async (employee: Driver) => {
    if (!window.confirm(`Supprimer ${employee.name} ? Les affectations à venir seront retirées.`))
      return;
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

  const addDaysForWeek = useMemo(() => {
    const start = weekStart(selectedDay);
    return days.map((day, index) => {
      const date = moveDay(start, index);
      const dayJobs = currentBookings.filter((booking) => booking.date === date);
      const complete =
        dayJobs.length > 0 &&
        dayJobs.every((booking) => {
          const need = needsOf(booking);
          const team = teamOf(booking);
          return roles.every((role) => team[role.id].length >= need[role.id]);
        });
      const sent =
        dayJobs.length > 0 &&
        dayJobs.every((booking) =>
          teamIds(booking).every((id) => Boolean(booking.crewBriefs?.[id])),
        );
      return { day, date, count: dayJobs.length, complete, sent, selected: date === selectedDay };
    });
  }, [currentBookings, selectedDay]);

  const autoCompose = async () => {
    let plannedBookings = [...currentBookings];
    let added = 0;
    let missing = 0;
    const autoJobs = dayBookings
      .filter((booking) => booking.status !== 'completed')
      .sort((a, b) => {
        const slotOrder = (slot: string) => (slotKey(slot) === 'journee' ? 0 : 1);
        return (
          slotOrder(a.timeSlot) - slotOrder(b.timeSlot) ||
          needsOf(b).manoeuvre - needsOf(a).manoeuvre
        );
      });
    for (const booking of autoJobs) {
      const currentBooking = plannedBookings.find((item) => item.id === booking.id) ?? booking;
      const need = needsOf(currentBooking);
      const crew = teamOf(currentBooking);
      for (const role of roles) {
        let remaining = need[role.id] - crew[role.id].length;
        while (remaining > 0) {
          const candidates = employees
            .filter((employee) => {
              if (
                (employee.role ?? 'chauffeur') !== role.id ||
                !employee.active ||
                teamIds({ ...currentBooking, crew }).includes(employee.id)
              )
                return false;
              if ((currentBooking.crewRefusedBy ?? []).includes(employee.id) || isSuspect(employee))
                return false;
              const collision = busyBooking(employee.id, currentBooking, plannedBookings);
              if (collision || !availableOn(employee, selectedDay, currentBooking).ok) return false;
              if (
                role.id === 'chauffeur' &&
                employee.authorizedVehicleIds?.length &&
                !employee.authorizedVehicleIds.includes(currentBooking.vehicle.id)
              )
                return false;
              return true;
            })
            .sort((a, b) => {
              const currentTeam = teamIds({ ...currentBooking, crew });
              const cowork = (employee: Driver) =>
                plannedBookings.filter((item) => {
                  const team = teamIds(item);
                  return team.includes(employee.id) && team.some((id) => currentTeam.includes(id));
                }).length;
              const load = (id: string) => {
                const start = weekStart(selectedDay);
                return plannedBookings.filter(
                  (item) =>
                    item.date! >= start &&
                    item.date! <= moveDay(start, 6) &&
                    teamIds(item).includes(id),
                ).length;
              };
              return (
                cowork(b) - cowork(a) || load(a.id) - load(b.id) || a.name.localeCompare(b.name)
              );
            });
          const choice = candidates[0];
          if (!choice) {
            missing += remaining;
            break;
          }
          crew[role.id].push(choice.id);
          crew.chef ||= choice.id;
          added += 1;
          remaining -= 1;
        }
      }
      const saved = await saveTeam(currentBooking, { crew });
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
    const crew = teamOf(booking);
    crew[role] = add ? [...crew[role], memberId] : crew[role].filter((id) => id !== memberId);
    if (!add && crew.chef === memberId) crew.chef = '';
    if (add && !crew.chef) crew.chef = memberId;
    await saveTeam(booking, { crew });
  };

  const changeReply = async (booking: Booking, member: Driver, reply: 'ok' | 'no' | '') => {
    const replies = { ...(booking.crewReplies ?? {}) };
    const crew = teamOf(booking);
    let refusedBy = [...(booking.crewRefusedBy ?? [])];
    if (reply === 'no') {
      crew.chauffeur = crew.chauffeur.filter((id) => id !== member.id);
      crew.menuisier = crew.menuisier.filter((id) => id !== member.id);
      crew.manoeuvre = crew.manoeuvre.filter((id) => id !== member.id);
      if (crew.chef === member.id) crew.chef = '';
      refusedBy = [...refusedBy, member.id];
      await applyMemberPatch(member, {
        refusals: [
          ...(member.refusals ?? []),
          { ref: booking.reference, at: new Date().toISOString() },
        ],
      });
    }
    if (reply) replies[member.id] = reply;
    else delete replies[member.id];
    await saveTeam(booking, { crew, crewReplies: replies, crewRefusedBy: refusedBy });
  };

  const sendBrief = async (booking: Booking, members: Driver[]) => {
    const urls = members.flatMap((member) => {
      const phone = member.phone.replace(/\D/g, '');
      if (!phone) return [];
      const key = `${booking.id}|${member.id}`;
      const message =
        customMessages[key] ??
        booking.crewMessages?.[member.id] ??
        defaultMissionMessage(
          booking,
          member,
          members,
          businessWhatsAppPhone,
          businessWhatsAppCountry,
        );
      const number = phone.length <= 9 ? `221${phone}` : phone;
      return [`https://wa.me/${number}?text=${encodeURIComponent(message)}`];
    });
    if (!urls.length) return setPageError('Aucun numéro de téléphone dans l’équipe.');
    urls.forEach((url, index) =>
      window.setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), index * 650),
    );
    const crewBriefs = { ...(booking.crewBriefs ?? {}) };
    members
      .filter((member) => member.phone.replace(/\D/g, ''))
      .forEach((member) => {
        crewBriefs[member.id] = new Date().toISOString();
      });
    await saveTeam(booking, { crewBriefs });
    setToast(`Brief envoyé à ${urls.length} personne(s) : une conversation WhatsApp par personne.`);
  };

  const copyBrief = async (booking: Booking, members: Driver[]) => {
    const roleLabel = (member: Driver) => roleName(member.role ?? 'chauffeur').toLowerCase();
    const brief = [
      `Demenag Express · Déménagement ${booking.reference}`,
      `${booking.date ? shortDate(booking.date) : 'Date à définir'} · ${booking.timeSlot || 'Journée'}`,
      `Véhicule : ${referenceVehicleName(booking.vehicle.name)}`,
      `Lieu de retrait : ${booking.fromAddress || 'à compléter'}`,
      `Lien Google Maps : ${googleMapLink(booking.from, booking.fromAddress) || 'adresse de retrait à compléter'}`,
      `Arrivée : ${booking.toAddress || 'à compléter'}`,
      ...(googleMapLink(booking.to, booking.toAddress)
        ? [`Lien Google Maps : ${googleMapLink(booking.to, booking.toAddress)}`]
        : []),
      `Client : ${booking.customerName || '-'} ${booking.phone || ''}`.trim(),
      `Équipe : ${members.map((member) => `${member.name} (${roleLabel(member)})`).join(', ')}`,
    ].join('\n');
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
    () =>
      employees
        .filter((employee) => filterRole === 'all' || (employee.role ?? 'chauffeur') === filterRole)
        .sort((a, b) => {
          if (sortByAccepted) {
            const accepted = (employee: Driver) =>
              bookings.filter(
                (booking) =>
                  booking.status !== 'cancelled' && booking.crewReplies?.[employee.id] === 'ok',
              ).length;
            return accepted(b) - accepted(a) || a.name.localeCompare(b.name);
          }
          return (
            roles.findIndex((role) => role.id === (a.role ?? 'chauffeur')) -
              roles.findIndex((role) => role.id === (b.role ?? 'chauffeur')) ||
            a.name.localeCompare(b.name)
          );
        }),
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
  const availableCounts = roles.map((role) => ({
    ...role,
    available: employees.filter(
      (employee) =>
        (employee.role ?? 'chauffeur') === role.id &&
        employee.active &&
        availabilityOf(employee)[dayIndex(selectedDay)]?.available,
    ).length,
    resting: employees
      .filter(
        (employee) =>
          (employee.role ?? 'chauffeur') === role.id &&
          (!employee.active || !availabilityOf(employee)[dayIndex(selectedDay)]?.available),
      )
      .map((employee) => employee.name.split(' ')[0]),
  }));

  return {
    catalogue,
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
    tileRef,
    layerRef,
    fittedRef,
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
    employeesRef,
    placingIdRef,
    saveEmployeeRef,
    applyMemberPatch,
    updateEmployeeAddress,
    addEmployee,
    removeEmployee,
    addDaysForWeek,
    autoCompose,
    setMemberRole,
    changeReply,
    sendBrief,
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
    trafficTiles,
    googleMapLink,
    defaultMissionMessage,
  };
}
