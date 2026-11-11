import type {
  Booking,
  Driver,
  DriverAvailabilityDay,
  Point,
} from '../../../../shared/domain/model';
import { normalizePhoneNumber } from '../../../../shared/domain/phone-number';

export const roles = [
  { id: 'chauffeur', label: 'Chauffeur', plural: 'Chauffeurs', color: '#FFC93C' },
  { id: 'menuisier', label: 'Menuisier', plural: 'Menuisiers', color: '#2ECC71' },
  { id: 'manoeuvre', label: 'Manœuvre', plural: 'Manœuvres', color: '#4DA3FF' },
] as const;
export type TeamRole = (typeof roles)[number]['id'];
export const roleName = (id: TeamRole) => roles.find((role) => role.id === id)?.label ?? 'Employé';
export const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const tags = [
  'Fiable',
  'Ponctuel',
  'Expérimenté',
  'Objets lourds',
  'Montage rapide',
  'Bon contact client',
  'Débutant',
  'À former',
];
export const blankAvailability = (): DriverAvailabilityDay[] =>
  days.map((_, index) => ({ available: index < 6, startTime: '08:00', endTime: '18:00' }));
export const availabilitySummary = (availability: DriverAvailabilityDay[]) => {
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
export const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const moveDay = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return iso(date);
};
export const weekStart = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return iso(date);
};
export const referenceVehicleName = (name: string) => {
  const normalized = name.toLocaleLowerCase('fr');
  if (normalized.includes('sprinter')) return 'Mercedes Sprinter';
  if (normalized.includes('trafic')) return 'Renault Trafic';
  if (normalized.includes('master')) return 'Renault Master';
  return name;
};
export const shortDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
export const shortTimestamp = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
export const slotKey = (value: string) =>
  /apr/i.test(value) ? 'aprem' : /matin/i.test(value) ? 'matin' : 'journee';
export const slotTimes = (slot: string): [string, string] =>
  slot === 'matin'
    ? ['08:00', '12:00']
    : slot === 'aprem'
      ? ['13:00', '17:00']
      : ['08:00', '17:00'];
export type JobSpan = { s: number; e: number; real: boolean };
export type AvailabilityResult = { ok: boolean; why: string; note?: string };
export const timeMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
export const formatMinutes = (value: number) =>
  `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export const jobSpan = (booking: Booking): JobSpan => {
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
export const dayDistance = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000,
  );
export const spanOverlaps = (left: JobSpan, right: JobSpan, dayOffset = 0) => {
  const start = right.s + dayOffset * 1440;
  const end = right.e + dayOffset * 1440;
  return left.s < end && start < left.e;
};
export const overlaps = (left: string, right: string) =>
  left === 'journee' || right === 'journee' || left === right;
export const activeBookings = (bookings: Booking[]) =>
  bookings.filter((booking) => booking.date && booking.status !== 'cancelled');
export const teamOf = (booking: Booking) => {
  const quote = booking.quotes?.at(-1);
  const rental = quote?.billingMode === 'driver-rental' && !quote.menuIncluded;
  return {
    chauffeur: booking.crew?.chauffeur ?? (booking.driverId ? [booking.driverId] : []),
    menuisier: rental ? [] : (booking.crew?.menuisier ?? []),
    manoeuvre: rental ? [] : (booking.crew?.manoeuvre ?? []),
    chef: booking.crew?.chef ?? '',
  };
};
export const teamIds = (booking: Booking) => {
  const crew = teamOf(booking);
  return [...crew.chauffeur, ...crew.menuisier, ...crew.manoeuvre];
};
export const normalizeCrewLead = (crew: ReturnType<typeof teamOf>) => {
  const members = [...crew.chauffeur, ...crew.menuisier, ...crew.manoeuvre];
  if (crew.chef && members.includes(crew.chef)) return crew;
  const chef = crew.chauffeur[0] || crew.manoeuvre[0] || crew.menuisier[0];
  return chef ? { ...crew, chef } : crew;
};
function mergeRecordChanges<T extends string>(
  current: Record<string, T>,
  base: Record<string, T>,
  requested: Record<string, T>,
) {
  const merged = { ...current };
  for (const key of new Set([...Object.keys(base), ...Object.keys(requested)])) {
    if (base[key] === requested[key]) continue;
    if (requested[key] === undefined) delete merged[key];
    else merged[key] = requested[key];
  }
  return merged;
}
function mergeListChanges(current: string[], base: string[], requested: string[]) {
  const removed = new Set(base.filter((id) => !requested.includes(id)));
  const added = requested.filter((id) => !base.includes(id));
  return [
    ...current.filter((id) => !removed.has(id)),
    ...added.filter((id) => !current.includes(id)),
  ];
}
/** Apply fields changed since `base` onto the latest server value after a queued save. */
export function mergeTeamChanges(current: Booking, base: Booking, patch: Partial<Booking>) {
  const currentCrew = teamOf(current);
  const baseCrew = teamOf(base);
  const requestedCrew = patch.crew ?? baseCrew;
  const crew = {
    chauffeur: mergeListChanges(currentCrew.chauffeur, baseCrew.chauffeur, requestedCrew.chauffeur),
    menuisier: mergeListChanges(currentCrew.menuisier, baseCrew.menuisier, requestedCrew.menuisier),
    manoeuvre: mergeListChanges(currentCrew.manoeuvre, baseCrew.manoeuvre, requestedCrew.manoeuvre),
    chef: requestedCrew.chef === baseCrew.chef ? currentCrew.chef : requestedCrew.chef,
  };
  const crewBriefs = mergeRecordChanges(
    current.crewBriefs ?? {},
    base.crewBriefs ?? {},
    patch.crewBriefs ?? base.crewBriefs ?? {},
  );
  const crewReplies = mergeRecordChanges(
    current.crewReplies ?? {},
    base.crewReplies ?? {},
    patch.crewReplies ?? base.crewReplies ?? {},
  );
  const crewMessages = mergeRecordChanges(
    current.crewMessages ?? {},
    base.crewMessages ?? {},
    patch.crewMessages ?? base.crewMessages ?? {},
  );
  const baseRefusals = base.crewRefusedBy ?? [];
  const crewRefusedBy = mergeListChanges(
    current.crewRefusedBy ?? [],
    baseRefusals,
    patch.crewRefusedBy ?? baseRefusals,
  );
  return { crew, crewBriefs, crewReplies, crewMessages, crewRefusedBy };
}
export const needsOf = (booking: Booking) => {
  const quote = booking.quotes?.at(-1);
  const rental = quote?.billingMode === 'driver-rental' && !quote.menuIncluded;
  const options = quote?.options ?? booking.options;
  return {
    chauffeur: 1,
    menuisier: Number(
      (options?.bed ?? 0) + (options?.wardrobe ?? 0) + (options?.desk ?? 0) > 0 &&
        quote?.billingMode !== 'standard' &&
        !rental,
    ),
    manoeuvre: rental ? 0 : Math.max(0, quote?.providedCrew ?? options.labour ?? 2),
  };
};

export function employeeAvailability(
  employee: Driver,
  day: string,
): DriverAvailabilityDay | undefined {
  if (employee.availability?.length !== 7) return blankAvailability()[dayIndex(day)];
  return employee.availability[dayIndex(day)];
}

export function dayIndex(day: string) {
  return (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
}

export const availabilityOf = (employee: Driver) =>
  employee.availability?.length === 7 ? employee.availability : blankAvailability();

export function busyBooking(employeeId: string, current: Booking, source: readonly Booking[]) {
  if (!current.date) return undefined;
  const currentSpan = jobSpan(current);
  return source.find((booking) => {
    if (booking.id === current.id || !booking.date || !teamIds(booking).includes(employeeId))
      return false;
    const offset = dayDistance(current.date!, booking.date);
    return Math.abs(offset) <= 1 && spanOverlaps(currentSpan, jobSpan(booking), offset);
  });
}

export function sameDayJobs(employeeId: string, current: Booking, source: readonly Booking[]) {
  return source.filter(
    (booking) =>
      booking.id !== current.id &&
      booking.date === current.date &&
      teamIds(booking).includes(employeeId),
  );
}

export function weekLoad(employeeId: string, day: string, source: readonly Booking[]) {
  const start = weekStart(day);
  return source.filter(
    (booking) =>
      booking.date! >= start &&
      booking.date! <= moveDay(start, 6) &&
      teamIds(booking).includes(employeeId),
  ).length;
}

export const availableOn = employeeAvailableForBooking;
export const refusalCount = employeeRefusalCount;
export const isSuspect = employeeIsSuspect;

export function employeeAvailableForBooking(
  employee: Driver,
  day: string,
  booking: Booking,
): AvailabilityResult {
  if (!employee.active) return { ok: false, why: 'indisponible' };
  const index = dayIndex(day);
  const availability = employeeAvailability(employee, day);
  if (!availability?.available)
    return {
      ok: false,
      why: `repos le ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][index]}`,
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
}

export function employeeRefusalCount(employee: Driver) {
  return Math.max(0, (employee.refusals?.length ?? 0) - (employee.clearedRefusals ?? 0));
}

export function employeeIsSuspect(employee: Driver) {
  return employeeRefusalCount(employee) >= 3;
}

export function orderBookingsForAutoComposition(bookings: readonly Booking[]) {
  const slotOrder = (slot: string) => (slotKey(slot) === 'journee' ? 0 : 1);
  return [...bookings]
    .filter((booking) => booking.status !== 'completed')
    .sort(
      (left, right) =>
        slotOrder(left.timeSlot) - slotOrder(right.timeSlot) ||
        needsOf(right).manoeuvre - needsOf(left).manoeuvre,
    );
}

export function autoAssignTeamForBooking(input: {
  booking: Booking;
  employees: readonly Driver[];
  date: string;
  plannedBookings: readonly Booking[];
}) {
  const { booking, employees, date, plannedBookings } = input;
  const crew = teamOf(booking);
  let added = 0;
  let missing = 0;
  const need = needsOf(booking);
  for (const role of roles) {
    let remaining = need[role.id] - crew[role.id].length;
    while (remaining > 0) {
      const currentTeam = teamIds({ ...booking, crew });
      const candidates = employees
        .filter((employee) => {
          if (
            (employee.role ?? 'chauffeur') !== role.id ||
            !employee.active ||
            currentTeam.includes(employee.id)
          )
            return false;
          if ((booking.crewRefusedBy ?? []).includes(employee.id) || employeeIsSuspect(employee))
            return false;
          if (
            busyBooking(employee.id, booking, plannedBookings) ||
            !employeeAvailableForBooking(employee, date, booking).ok
          )
            return false;
          return !(
            role.id === 'chauffeur' &&
            employee.authorizedVehicleIds?.length &&
            !employee.authorizedVehicleIds.includes(booking.vehicle.id)
          );
        })
        .sort((left, right) => {
          const coworkCount = (employee: Driver) =>
            plannedBookings.filter((item) => {
              const team = teamIds(item);
              return team.includes(employee.id) && team.some((id) => currentTeam.includes(id));
            }).length;
          const weeklyLoad = (employeeId: string) => {
            const start = weekStart(date);
            return plannedBookings.filter(
              (item) =>
                item.date! >= start &&
                item.date! <= moveDay(start, 6) &&
                teamIds(item).includes(employeeId),
            ).length;
          };
          return (
            coworkCount(right) - coworkCount(left) ||
            weeklyLoad(left.id) - weeklyLoad(right.id) ||
            left.name.localeCompare(right.name)
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
  return { crew, added, missing };
}

export function teamWeekDaySummaries(bookings: readonly Booking[], selectedDay: string) {
  const start = weekStart(selectedDay);
  return days.map((day, index) => {
    const date = moveDay(start, index);
    const dayBookings = bookings.filter((booking) => booking.date === date);
    const complete =
      dayBookings.length > 0 &&
      dayBookings.every((booking) => {
        const need = needsOf(booking);
        const crew = teamOf(booking);
        return roles.every((role) => crew[role.id].length >= need[role.id]);
      });
    const sent =
      dayBookings.length > 0 &&
      dayBookings.every((booking) =>
        teamIds(booking).every((id) => Boolean(booking.crewBriefs?.[id])),
      );
    return { day, date, count: dayBookings.length, complete, sent, selected: date === selectedDay };
  });
}

export function employeeAvailabilityCounts(employees: readonly Driver[], date: string) {
  return roles.map((role) => {
    const matchingEmployees = employees.filter(
      (employee) => (employee.role ?? 'chauffeur') === role.id,
    );
    const availableEmployees = matchingEmployees.filter(
      (employee) => employee.active && availabilityOf(employee)[dayIndex(date)]?.available,
    );
    return {
      ...role,
      available: availableEmployees.length,
      resting: matchingEmployees
        .filter(
          (employee) => !employee.active || !availabilityOf(employee)[dayIndex(date)]?.available,
        )
        .map((employee) => employee.name.split(' ')[0]),
    };
  });
}

export function firstUpcomingBookingDay(bookings: readonly Booking[], today: string) {
  return (
    bookings
      .map((booking) => booking.date)
      .filter((date): date is string => Boolean(date && date >= today))
      .sort()[0] ?? today
  );
}

export function bookingsForTeamDay(bookings: readonly Booking[], selectedDay: string) {
  const order = { journee: 0, matin: 1, aprem: 2 };
  return bookings
    .filter((booking) => booking.date === selectedDay)
    .sort((left, right) => order[slotKey(left.timeSlot)] - order[slotKey(right.timeSlot)]);
}

export function updateTeamMemberRole(
  booking: Booking,
  role: TeamRole,
  memberId: string,
  add: boolean,
) {
  const crew = teamOf(booking);
  crew[role] = add ? [...crew[role], memberId] : crew[role].filter((id) => id !== memberId);
  if (!add && crew.chef === memberId) crew.chef = '';
  if (add && !crew.chef) crew.chef = memberId;
  return crew;
}

export function crewReplyChanges(booking: Booking, memberId: string, reply: 'ok' | 'no' | '') {
  const replies = { ...(booking.crewReplies ?? {}) };
  const crew = teamOf(booking);
  let refusedBy = [...(booking.crewRefusedBy ?? [])];
  if (reply === 'no') {
    crew.chauffeur = crew.chauffeur.filter((id) => id !== memberId);
    crew.menuisier = crew.menuisier.filter((id) => id !== memberId);
    crew.manoeuvre = crew.manoeuvre.filter((id) => id !== memberId);
    if (crew.chef === memberId) crew.chef = '';
    refusedBy = [...refusedBy, memberId];
  }
  if (reply) replies[memberId] = reply;
  else delete replies[memberId];
  return { crew, crewReplies: replies, crewRefusedBy: refusedBy };
}

export function driverRefusalPatch(employee: Driver, booking: Booking, at: string) {
  return {
    refusals: [...(employee.refusals ?? []), { ref: booking.reference, at }],
  };
}

export function teamBriefMessage(
  booking: Booking,
  employee: Driver,
  members: Driver[],
  customMessage: string | undefined,
  savedMessage: string | undefined,
  businessPhone = '',
  countryCode = '221',
) {
  return (
    customMessage ??
    savedMessage ??
    defaultMissionMessage(booking, employee, members, businessPhone, countryCode)
  );
}

export function teamBriefRecipients(input: {
  booking: Booking;
  members: Driver[];
  customMessages: Record<string, string>;
  businessPhone: string;
  countryCode: string;
}) {
  return input.members.flatMap((member) => {
    const phone = normalizePhoneNumber(member.phone);
    if (!phone) return [];
    const key = `${input.booking.id}|${member.id}`;
    return [
      {
        booking: input.booking,
        member,
        phone,
        message: teamBriefMessage(
          input.booking,
          member,
          input.members,
          input.customMessages[key],
          input.booking.crewMessages?.[member.id],
          input.businessPhone,
          input.countryCode,
        ),
      },
    ];
  });
}

export function visibleTeamMembers(
  employees: readonly Driver[],
  bookings: readonly Booking[],
  filterRole: TeamRole | 'all',
  sortByAccepted: boolean,
) {
  const acceptedCount = (employee: Driver) =>
    bookings.filter(
      (booking) => booking.status !== 'cancelled' && booking.crewReplies?.[employee.id] === 'ok',
    ).length;
  return employees
    .filter((employee) => filterRole === 'all' || (employee.role ?? 'chauffeur') === filterRole)
    .sort((left, right) => {
      if (sortByAccepted)
        return acceptedCount(right) - acceptedCount(left) || left.name.localeCompare(right.name);
      return (
        roles.findIndex((role) => role.id === (left.role ?? 'chauffeur')) -
          roles.findIndex((role) => role.id === (right.role ?? 'chauffeur')) ||
        left.name.localeCompare(right.name)
      );
    });
}

export function newEmployeeValidationError(name: string, phone: string): string | undefined {
  if (!name.trim()) return 'Indiquez le nom.';
  if (!normalizePhoneNumber(phone.trim()))
    return 'Saisissez un numéro valide avec son indicatif international.';
  return undefined;
}

export function teamCopyBrief(booking: Booking, members: readonly Driver[]) {
  const memberRole = (member: Driver) => roleName(member.role ?? 'chauffeur').toLowerCase();
  const departureMap = googleMapLink(booking.from, booking.fromAddress);
  const arrivalMap = googleMapLink(booking.to, booking.toAddress);
  return [
    `Demenag Express · Déménagement ${booking.reference}`,
    `${booking.date ? shortDate(booking.date) : 'Date à définir'} · ${booking.timeSlot || 'Journée'}`,
    `Véhicule : ${referenceVehicleName(booking.vehicle.name)}`,
    `Lieu de retrait : ${booking.fromAddress || 'à compléter'}`,
    `Lien Google Maps : ${departureMap || 'adresse de retrait à compléter'}`,
    `Arrivée : ${booking.toAddress || 'à compléter'}`,
    ...(arrivalMap ? [`Lien Google Maps : ${arrivalMap}`] : []),
    `Client : ${booking.customerName || '-'} ${booking.phone || ''}`.trim(),
    `Équipe : ${members.map((member) => `${member.name} (${memberRole(member)})`).join(', ')}`,
  ].join('\n');
}
export function trafficTiles(enabled: boolean) {
  return `https://mt{s}.google.com/vt/lyrs=${enabled ? 'm,traffic' : 'm'}&hl=fr&gl=SN&x={x}&y={y}&z={z}&t=${Math.floor(Date.now() / 120000)}`;
}
export function googleMapLink(point: Point | undefined, address: string) {
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
export function defaultMissionMessage(
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
  const sentAt = booking.crewBriefs?.[employee.id];
  const addressUpdatePending = Boolean(
    booking.crewAddressChange && sentAt && sentAt < booking.crewAddressChange.at,
  );
  const alreadyAccepted = addressUpdatePending && booking.crewReplies?.[employee.id] === 'ok';
  const lines = [
    ...(alreadyAccepted ? [`MISE À JOUR · Mission ${booking.reference} déjà acceptée`, ''] : []),
    `Bonjour ${firstName},`,
    `Déménagement ${booking.reference} · ${date} · ${booking.timeSlot || 'Journée'}`,
    ...(addressUpdatePending && booking.crewAddressChange
      ? [
          `MISE À JOUR : ${
            booking.crewAddressChange.from && booking.crewAddressChange.to
              ? 'les adresses de retrait et de dépôt ont changé'
              : booking.crewAddressChange.from
                ? 'l’adresse de retrait a changé'
                : 'l’adresse de dépôt a changé'
          }. Vérifie les nouvelles adresses ci-dessous.`,
        ]
      : []),
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
    ...(alreadyAccepted
      ? ['Aucune réponse nécessaire : ta mission reste confirmée.']
      : [
          `ACCEPTES-TU LA MISSION ${booking.reference} ?`,
          'Réponds par 1 ou 2 :',
          '1 - J’accepte la mission',
          '2 - Je refuse la mission',
        ]),
    ...(!alreadyAccepted && waBusiness
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
