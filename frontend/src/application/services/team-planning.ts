import type { Booking, Driver, DriverAvailabilityDay, Point } from '../../domain/model';

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
  /après-midi|aprem/i.test(value) ? 'aprem' : /matin/i.test(value) ? 'matin' : 'journee';
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
export const teamOf = (booking: Booking) => ({
  chauffeur: booking.crew?.chauffeur ?? (booking.driverId ? [booking.driverId] : []),
  menuisier: booking.crew?.menuisier ?? [],
  manoeuvre: booking.crew?.manoeuvre ?? [],
  chef: booking.crew?.chef ?? '',
});
export const teamIds = (booking: Booking) => {
  const crew = teamOf(booking);
  return [...crew.chauffeur, ...crew.menuisier, ...crew.manoeuvre];
};
export const needsOf = (booking: Booking) => ({
  chauffeur: 1,
  menuisier: Number(booking.options.bed + booking.options.wardrobe + booking.options.desk > 0),
  manoeuvre: Math.max(0, booking.options.labour ?? 2),
});
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
