import 'leaflet/dist/leaflet.css';
import '../styles/admin-teams.css';
import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdministration } from '../application/controllers/useAdministration';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import type { Booking, Driver, DriverAvailabilityDay, Point } from '../domain/model';

const roles = [
  { id: 'chauffeur', label: 'Chauffeur', plural: 'Chauffeurs', color: '#FFC93C' },
  { id: 'menuisier', label: 'Menuisier', plural: 'Menuisiers', color: '#2ECC71' },
  { id: 'manoeuvre', label: 'Manœuvre', plural: 'Manœuvres', color: '#4DA3FF' },
] as const;
type TeamRole = (typeof roles)[number]['id'];
const roleName = (id: TeamRole) => roles.find((role) => role.id === id)?.label ?? 'Employé';
const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const tags = [
  'Fiable',
  'Ponctuel',
  'Expérimenté',
  'Objets lourds',
  'Montage rapide',
  'Bon contact client',
  'Débutant',
  'À former',
];
const blankAvailability = (): DriverAvailabilityDay[] =>
  days.map((_, index) => ({ available: index < 6, startTime: '08:00', endTime: '18:00' }));
const availabilitySummary = (availability: DriverAvailabilityDay[]) => {
  const indices = availability.flatMap((item, index) => (item.available ? [index] : []));
  if (!indices.length) return 'Aucun jour';
  const runs: Array<[number, number]> = [];
  for (const index of indices) {
    const last = runs[runs.length - 1];
    if (last && last[1] === index - 1) last[1] = index;
    else runs.push([index, index]);
  }
  const range = runs
    .map(([start, end]) => (start === end ? days[start] : `${days[start]}–${days[end]}`))
    .join(', ');
  const first = availability[indices[0]];
  const sameHours = indices.every(
    (index) =>
      availability[index].startTime === first.startTime &&
      availability[index].endTime === first.endTime,
  );
  return `${range}${sameHours ? ` · ${first.startTime}–${first.endTime}` : ' · horaires variables'}`;
};
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const moveDay = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return iso(date);
};
const weekStart = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return iso(date);
};
const referenceVehicleName = (name: string) => {
  const normalized = name.toLocaleLowerCase('fr');
  if (normalized.includes('sprinter')) return 'Mercedes Sprinter';
  if (normalized.includes('trafic')) return 'Renault Trafic';
  if (normalized.includes('master')) return 'Renault Master';
  return name;
};
const shortDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
const shortTimestamp = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
const slotKey = (value: string) =>
  /après-midi|aprem/i.test(value) ? 'aprem' : /matin/i.test(value) ? 'matin' : 'journee';
const slotTimes = (slot: string): [string, string] =>
  slot === 'matin'
    ? ['08:00', '12:00']
    : slot === 'aprem'
      ? ['13:00', '17:00']
      : ['08:00', '17:00'];
type JobSpan = { s: number; e: number; real: boolean };
type AvailabilityResult = { ok: boolean; why: string; note?: string };
const timeMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const formatMinutes = (value: number) =>
  `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const jobSpan = (booking: Booking): JobSpan => {
  const snapshot = booking.inventorySnapshot;
  const snapshotStart = snapshot?.startTime ? timeMinutes(snapshot.startTime) : null;
  const snapshotEnd = snapshot?.endTime ? timeMinutes(snapshot.endTime) : null;
  if (snapshotStart !== null && snapshotEnd !== null) {
    if (snapshotEnd > snapshotStart) return { s: snapshotStart, e: snapshotEnd, real: true };
    if ((snapshot?.totalMinutes ?? 0) > 0)
      return {
        s: snapshotStart,
        e: snapshotStart + (snapshot?.totalMinutes ?? 0),
        real: true,
      };
  }
  const specified = timeMinutes(booking.timeSlot);
  if (specified !== null) return { s: specified, e: specified + 240, real: false };
  const [start, end] = slotTimes(slotKey(booking.timeSlot));
  return { s: timeMinutes(start) ?? 480, e: timeMinutes(end) ?? 1020, real: false };
};
const dayDistance = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000,
  );
const spanOverlaps = (left: JobSpan, right: JobSpan, dayOffset = 0) => {
  const start = right.s + dayOffset * 1440;
  const end = right.e + dayOffset * 1440;
  return left.s < end && start < left.e;
};
const overlaps = (left: string, right: string) =>
  left === 'journee' || right === 'journee' || left === right;
const activeBookings = (bookings: Booking[]) =>
  bookings.filter((booking) => booking.date && booking.status !== 'cancelled');
const teamOf = (booking: Booking) => ({
  chauffeur: booking.crew?.chauffeur ?? (booking.driverId ? [booking.driverId] : []),
  menuisier: booking.crew?.menuisier ?? [],
  manoeuvre: booking.crew?.manoeuvre ?? [],
  chef: booking.crew?.chef ?? '',
});
const teamIds = (booking: Booking) => {
  const crew = teamOf(booking);
  return [...crew.chauffeur, ...crew.menuisier, ...crew.manoeuvre];
};
const needsOf = (booking: Booking) => ({
  chauffeur: 1,
  menuisier: Number(booking.options.bed + booking.options.wardrobe + booking.options.desk > 0),
  manoeuvre: Math.max(0, booking.options.labour ?? 2),
});
function trafficTiles(enabled: boolean) {
  return `https://mt{s}.google.com/vt/lyrs=${enabled ? 'm,traffic' : 'm'}&hl=fr&gl=SN&x={x}&y={y}&z={z}&t=${Math.floor(Date.now() / 120000)}`;
}
function googleMapLink(point: Point | undefined, address: string) {
  if (point?.length === 2 && point.every(Number.isFinite))
    return `https://www.google.com/maps?q=${point[0].toFixed(6)},${point[1].toFixed(6)}`;
  const query = address.trim();
  return query
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        /s[ée]n[ée]gal/i.test(query) ? query : `${query}, Sénégal`,
      )
        .replace(/%20/g, '+')
        .replace(/%2C/g, ',')}`
    : '';
}
function defaultMissionMessage(
  booking: Booking,
  employee: Driver,
  team: Driver[],
  businessPhone = '',
  countryCode = '221',
) {
  const date = booking.date ? shortDate(booking.date) : 'Date à définir';
  const access = booking.workAccess;
  const inventory = booking.inventorySnapshot;
  const fromFloor = inventory?.fromFloor ?? access?.fromFloor;
  const toFloor = inventory?.toFloor ?? access?.toFloor;
  const fromLift = inventory?.fromLift ?? access?.fromLift;
  const toLift = inventory?.toLift ?? access?.toLift;
  const noteValue = (label: 'départ' | 'arrivée') =>
    booking.notes.match(new RegExp(`^\\s*Repère ${label}\\s*:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? '';
  const fromNote = noteValue('départ');
  const toNote = noteValue('arrivée');
  const floor = (value: number, lift: boolean) =>
    `${value > 0 ? (value === 1 ? '1er' : `${value}e`) + ' étage' : 'rez-de-chaussée'}, ${lift ? 'ascenseur' : 'sans ascenseur'}`;
  const businessNumber = businessPhone.replace(/\D/g, '');
  const waBusiness = businessNumber
    ? businessNumber.startsWith(countryCode.replace(/\D/g, ''))
      ? businessNumber
      : `${countryCode.replace(/\D/g, '')}${businessNumber}`
    : '';
  const firstName = employee.name.split(' ')[0];
  const yes = `Mission ${booking.reference} : 1 - J’ACCEPTE (${firstName})`;
  const no = `Mission ${booking.reference} : 2 - JE REFUSE (${firstName})`;
  const furniture = [
    booking.options.bed > 0
      ? `${booking.options.bed} lit${booking.options.bed > 1 ? 's' : ''}`
      : '',
    booking.options.wardrobe > 0
      ? `${booking.options.wardrobe} armoire${booking.options.wardrobe > 1 ? 's' : ''}`
      : '',
    booking.options.desk > 0
      ? `${booking.options.desk} bureau${booking.options.desk > 1 ? 'x' : ''}`
      : '',
  ].filter(Boolean);
  const vehicleShortName = referenceVehicleName(booking.vehicle.name);
  const roleText =
    employee.role === 'chauffeur'
      ? `chauffeur du ${vehicleShortName}`
      : employee.role === 'menuisier'
        ? `menuisier${furniture.length ? ` (démontage et remontage : ${furniture.join(', ')})` : ''}`
        : 'manœuvre';
  const lines = [
    `Bonjour ${firstName},`,
    `Déménagement ${booking.reference} · ${date} · ${booking.timeSlot || 'Journée'}`,
    '',
    `Lieu de retrait : ${booking.fromAddress || 'à compléter'}${fromFloor !== undefined ? ` (${floor(fromFloor, Boolean(fromLift))})` : ''}`,
    `Lien Google Maps : ${googleMapLink(booking.from, booking.fromAddress) || 'adresse de retrait à compléter'}`,
    fromNote ? `Repère : ${fromNote}` : '',
    '',
    `Arrivée : ${booking.toAddress || 'à compléter'}${toFloor !== undefined ? ` (${floor(toFloor, Boolean(toLift))})` : ''}`,
    googleMapLink(booking.to, booking.toAddress)
      ? `Lien Google Maps : ${googleMapLink(booking.to, booking.toAddress)}`
      : '',
    toNote ? `Repère : ${toNote}` : '',
    '',
    `Ton rôle : ${roleText}.`,
    `Client : ${booking.customerName || '-'}${booking.phone ? ` · ${booking.phone}` : ''}`,
    `Équipe : ${team.map((member) => `${member.name} (${roleName(member.role ?? 'chauffeur').toLowerCase()})`).join(', ')}`,
    '',
    `ACCEPTES-TU LA MISSION ${booking.reference} ?`,
    'Réponds par 1 ou 2 :',
    '1 - J’accepte la mission',
    '2 - Je refuse la mission',
    ...(waBusiness
      ? [
          '',
          'Ou touche ta réponse :',
          `✅ J’accepte : https://wa.me/${waBusiness}?text=${encodeURIComponent(yes)}`,
          `❌ Je refuse : https://wa.me/${waBusiness}?text=${encodeURIComponent(no)}`,
        ]
      : []),
  ];
  return lines.filter((line, index) => line || (index > 0 && lines[index - 1])).join('\n');
}

export function AdminFleet() {
  const { api, catalogue } = useApp();
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
    address: '',
    role: 'manoeuvre' as TeamRole,
    authorizedVehicleIds: [] as string[],
  });
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const employeeSaveQueuesRef = useRef(new Map<string, Promise<Driver>>());
  const confirmedEmployeesRef = useRef(new Map<string, Driver>());

  useEffect(() => {
    let alive = true;
    api
      .drivers()
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
  }, [api]);

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
        .then(() => api.updateDriver(next))
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
    [api],
  );
  const saveTeam = useCallback(
    async (booking: Booking, patch: Partial<Booking>) => {
      const next = { ...booking, ...patch };
      setSavingBooking(booking.id);
      setPageError('');
      try {
        const updated = await api.updateCrew(booking.id, {
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
    [api, setBookings],
  );

  const employeesRef = useRef(employees);
  const placingIdRef = useRef(placingId);
  const saveEmployeeRef = useRef(saveEmployee);
  const apiRef = useRef(api);
  employeesRef.current = employees;
  placingIdRef.current = placingId;
  saveEmployeeRef.current = saveEmployee;
  apiRef.current = api;

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
          address = (await apiRef.current.reverse(point)).label || address;
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
  }, [mapElement]);

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
      const found = await api.search(`${normalized}, Sénégal`);
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
    setPageError('');
    try {
      const created = await api.createDriver({
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
      confirmedEmployeesRef.current.set(created.id, created);
      setEmployees((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewEmployee({
        name: '',
        phone: '',
        address: '',
        role: 'manoeuvre',
        authorizedVehicleIds: [],
      });
      setToast(`${name} ajouté(e).`);
      if (created.address) {
        try {
          const result = await api.search(`${created.address}, Sénégal`);
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
      const result = await api.deleteDriver(employee.id);
      if (result.removed) {
        confirmedEmployeesRef.current.delete(employee.id);
        setEmployees((current) => current.filter((item) => item.id !== employee.id));
        setBookings(await api.bookings());
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
    void api
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
  }, [api, selected, selectedJob]);
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

  return (
    <main className="admin-teams">
      <section className="teams-panel teams-map-panel">
        <div className="teams-panel-heading">
          <div>
            <span className="teams-eyebrow">CARTE DES ÉQUIPES</span>
            <span className="teams-muted">
              {
                employees.filter(
                  (employee) => employee.latitude != null && employee.longitude != null,
                ).length
              }{' '}
              / {employees.length} employé(s) localisé(s) · déménagements du{' '}
              {shortDate(selectedDay)}
            </span>
          </div>
          <div className="teams-chips">
            <button
              className={mapLayers.employees ? 'team-chip active' : 'team-chip'}
              onClick={() => setMapLayers((value) => ({ ...value, employees: !value.employees }))}
            >
              {mapLayers.employees ? '✓ ' : ''}Logements des employés
            </button>
            <button
              className={mapLayers.bookings ? 'team-chip active' : 'team-chip'}
              onClick={() => setMapLayers((value) => ({ ...value, bookings: !value.bookings }))}
            >
              {mapLayers.bookings ? '✓ ' : ''}Déménagements du jour
            </button>
          </div>
        </div>
        {placingId && (
          <div className="teams-map-place">
            <strong>
              Touchez la carte à l’endroit du logement de {employeeById.get(placingId)?.name}
            </strong>
            <button className="team-button" onClick={() => setPlacingId('')}>
              Annuler
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
              <button aria-label="Fermer" onClick={() => setSelectedEmployee('')}>
                ×
              </button>
              <strong>
                {selectedJob
                  ? `${selected.name.split(' ')[0]} → A · ${selectedJob.reference} · ${selectedJob.timeSlot || 'Journée'}`
                  : selected.name.split(' ')[0]}
              </strong>
              {!selectedJob ? (
                <span>Aucune mission ce jour.</span>
              ) : selected.latitude == null || selected.longitude == null ? (
                <span>Logement non pointé sur la carte.</span>
              ) : (
                <>
                  {selectedRoute?.bookingId === selectedJob.id ? (
                    <div className="teams-route-summary">
                      <strong>{Math.round(selectedRoute.durationMinutes)} min</strong>
                      <span>{selectedRoute.distanceKm.toFixed(1).replace('.', ',')} km</span>
                      <small>sans trafic</small>
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
                    Temps avec trafic en direct (Google Maps)
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
            Départ (A)
          </span>
          <span>
            <i style={{ background: '#FF6B6B' }} />
            Arrivée (B)
          </span>
        </div>
      </section>

      <div className="teams-columns">
        <section className="teams-panel teams-planning">
          <div className="teams-panel-heading teams-planning-heading">
            <div>
              <span className="teams-eyebrow">PLANNING DES ÉQUIPES</span>
              <strong>{shortDate(selectedDay)}</strong>
            </div>
            <div className="teams-date-controls">
              <button
                aria-label="Jour précédent"
                onClick={() => chooseDay(moveDay(selectedDay, -1))}
              >
                ‹
              </button>
              <button onClick={() => chooseDay(iso(new Date()))}>Aujourd'hui</button>
              <button aria-label="Jour suivant" onClick={() => chooseDay(moveDay(selectedDay, 1))}>
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
                {item.resting.length > 0 && <em>Repos : {item.resting.join(', ')}</em>}
              </div>
            ))}
          </div>
          {!!dayBookings.length && (
            <button className="team-button primary" onClick={() => void autoCompose()}>
              Composer les équipes automatiquement
            </button>
          )}
          {loading ? (
            <p className="teams-empty">Chargement du planning…</p>
          ) : bookingsError ? (
            <p className="teams-error">{bookingsError}</p>
          ) : !dayBookings.length ? (
            <p className="teams-empty">Aucun déménagement ce jour-là.</p>
          ) : null}

          {dayBookings.map((booking) => {
            const crew = teamOf(booking);
            const needs = needsOf(booking);
            const members = teamIds(booking)
              .map((id) => employeeById.get(id))
              .filter((member): member is Driver => Boolean(member));
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
                {!!booking.crewRefusedBy?.filter((id) => !teamIds(booking).includes(id)).length && (
                  <p className="teams-refusals">
                    Refus précédents :{' '}
                    {booking.crewRefusedBy
                      .filter((id) => !teamIds(booking).includes(id))
                      .map((id) => employeeById.get(id))
                      .filter((member): member is Driver => Boolean(member))
                      .map(
                        (member) =>
                          `${member.name} (${roleName(member.role ?? 'chauffeur').toLowerCase()}, ${member.refusals?.length ?? 0} refus${isSuspect(member) ? ', suspect' : ''})`,
                      )
                      .join(' · ')}
                    . Remplacez les personnes ayant refusé.
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
                      <strong>AFFECTATION</strong>
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
                                        title="Retirer"
                                        onClick={() =>
                                          void setMemberRole(booking, role.id, id, false)
                                        }
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
                                      const availability = availableOn(
                                        employee,
                                        selectedDay,
                                        booking,
                                      );
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
                                              {availabilityText} · {acceptedCount} acceptée(s)
                                              {refusalTotal ? ` · ${refusalTotal} refus` : ''}
                                              {employee.tags?.length
                                                ? ` · ${employee.tags.join(', ')}`
                                                : ''}
                                            </span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  {!list.some(
                                    (employee) => !teamIds(booking).includes(employee.id),
                                  ) &&
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
                          <strong>ENVOI DE LA MISSION</strong>
                          <b>
                            {wasSent} / {members.length} envoyé{wasSent > 1 ? 's' : ''}
                          </b>
                        </button>
                        {Boolean(openSections[`${jobKey}:send`]) && (
                          <div className="teams-accordion-content">
                            <div className="teams-send-controls">
                              <label>
                                Envoyer à :
                                <select
                                  value={to}
                                  onChange={(event) =>
                                    setRecipient((value) => ({
                                      ...value,
                                      [jobKey]: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="all">Toute l'équipe ({members.length})</option>
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
                                  Message pour {editMember.name} ·{' '}
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
                                    Rétablir le message par défaut
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
                                Pas de numéro pour cette personne : ajoutez-le dans la liste
                                Employés.
                              </span>
                            )}
                            <button
                              className="team-button success"
                              disabled={
                                !members.some(
                                  (member) => member.phone.replace(/\D/g, '').length >= 9,
                                )
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
                          <strong>SUIVI DES RÉPONSES</strong>
                          <b>
                            {accepted} / {members.length} acceptée{accepted > 1 ? 's' : ''}
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
                                      Envoyé le {shortTimestamp(booking.crewBriefs[member.id])}
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
                                        A accepté
                                      </button>
                                    )}
                                    {reply === 'ok' && (
                                      <button
                                        className="team-button"
                                        onClick={() => void changeReply(booking, member, '')}
                                      >
                                        Annuler
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
                                      A refusé
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
                  <small className="teams-saving">Enregistrement…</small>
                )}
              </article>
            );
          })}
        </section>

        <section className="teams-panel teams-employees">
          <div>
            <span className="teams-eyebrow">EMPLOYÉS</span>
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
                placeholder="Nom et prénom"
                value={newEmployee.name}
                onChange={(event) =>
                  setNewEmployee((value) => ({ ...value, name: event.target.value }))
                }
              />
              <input
                placeholder="Téléphone (77 123 45 67)"
                inputMode="tel"
                value={newEmployee.phone}
                onChange={(event) =>
                  setNewEmployee((value) => ({ ...value, phone: event.target.value }))
                }
              />
              <input
                placeholder="Adresse du logement"
                value={newEmployee.address}
                onChange={(event) =>
                  setNewEmployee((value) => ({ ...value, address: event.target.value }))
                }
              />
            </div>
            {newEmployee.role === 'chauffeur' && catalogue && (
              <div className="teams-new-driver-vehicles">
                <span>Véhicules autorisés</span>
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
              Ajouter l'employé
            </button>
          </div>
          <div className="teams-chips teams-filter-chips">
            <button
              className={!sortByAccepted ? 'team-chip active' : 'team-chip'}
              onClick={() => setSortByAccepted(false)}
            >
              Trier par rôle
            </button>
            <button
              className={sortByAccepted ? 'team-chip active' : 'team-chip'}
              onClick={() => setSortByAccepted(true)}
            >
              Trier par missions acceptées
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
              Chargement des employés…
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
                    className="team-delete"
                    title="Supprimer l’employé"
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
                        placeholder="Téléphone"
                        defaultValue={employee.phone}
                        onBlur={(event) =>
                          event.target.value !== employee.phone &&
                          void applyMemberPatch(employee, { phone: event.target.value })
                        }
                      />
                      <a href={`tel:${employee.phone.replace(/\D/g, '')}`}>Appeler</a>
                      <span>
                        {weekLoad(employee.id, selectedDay)} déménagement
                        {weekLoad(employee.id, selectedDay) > 1 ? 's' : ''} cette semaine
                      </span>
                    </div>
                    {role === 'chauffeur' && (
                      <div className="teams-vehicle-tags">
                        <span>Conduit :</span>
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
                        placeholder="Adresse du logement (quartier, rue, repère)"
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
                          Voir
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
                      onClick={() =>
                        setOpenNotes((value) => ({ ...value, [employee.id]: !notesOpen }))
                      }
                    >
                      {notesOpen ? '⌄' : '›'} Notes{' '}
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
                          placeholder="Ex. allergie, contact d'urgence, quartier, préfère les matins, permis C…"
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
                      onClick={() =>
                        setOpenHours((value) => ({ ...value, [employee.id]: !hoursOpen }))
                      }
                    >
                      {hoursOpen ? '⌄' : '›'} Disponibilités{' '}
                      <span>{availabilitySummary(availability)}</span>
                    </button>
                    {hoursOpen && (
                      <div className="teams-hours">
                        {availability.map((item, index) => (
                          <div className="teams-hours-day" key={days[index]}>
                            <strong>{days[index]}</strong>
                            <button
                              className={
                                item.available
                                  ? 'teams-hours-toggle available'
                                  : 'teams-hours-toggle'
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
                                <span>à</span>
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
                          Appliquer l'horaire du lundi à tous les jours travaillés
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
                              if (
                                window.confirm(
                                  `Lever le signalement de ${employee.name} ? L’historique des refus reste comptabilisé.`,
                                )
                              )
                                void applyMemberPatch(employee, {
                                  clearedRefusals: employee.refusals?.length ?? 0,
                                });
                            }}
                          >
                            Lever le signalement
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {savingEmployee === employee.id && (
                  <small className="teams-saving">Enregistrement…</small>
                )}
              </article>
            );
          })}
        </section>
      </div>
      {(pageError || bookingsError) && (
        <p role="alert" className="teams-error-banner">
          {pageError || bookingsError}
        </p>
      )}
      {toast && (
        <button className="teams-toast" onClick={() => setToast('')}>
          {toast} · Fermer
        </button>
      )}
    </main>
  );
}
