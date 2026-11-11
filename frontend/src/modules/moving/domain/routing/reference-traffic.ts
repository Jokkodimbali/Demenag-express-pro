const holidays: Record<string, string> = {
  '2026-01-01': 'Jour de l’an',
  '2026-03-20': 'Korité',
  '2026-04-04': 'Fête de l’Indépendance',
  '2026-04-06': 'Lundi de Pâques',
  '2026-05-01': 'Fête du Travail',
  '2026-05-14': 'Ascension',
  '2026-05-25': 'Lundi de Pentecôte',
  '2026-05-27': 'Tabaski',
  '2026-06-25': 'Tamkharit',
  '2026-08-02': 'Grand Magal de Touba',
  '2026-08-15': 'Assomption',
  '2026-08-25': 'Maouloud',
  '2026-11-01': 'Toussaint',
  '2026-12-25': 'Noël',
  '2027-01-01': 'Jour de l’an',
  '2027-03-09': 'Korité',
  '2027-03-29': 'Lundi de Pâques',
  '2027-04-04': 'Fête de l’Indépendance',
  '2027-05-01': 'Fête du Travail',
  '2027-05-06': 'Ascension',
  '2027-05-16': 'Tabaski',
  '2027-05-17': 'Lundi de Pentecôte',
  '2027-06-15': 'Tamkharit',
  '2027-07-22': 'Grand Magal de Touba',
  '2027-08-14': 'Maouloud',
  '2027-08-15': 'Assomption',
  '2027-11-01': 'Toussaint',
  '2027-12-25': 'Noël',
};
const majorHolidays = ['Korité', 'Tabaski', 'Grand Magal de Touba', 'Maouloud', 'Tamkharit'];
const ramadanPeriods = [
  ['2026-02-18', '2026-03-19'],
  ['2027-02-08', '2027-03-08'],
];
const zones = [
  'colobane',
  'sandaga',
  'plateau',
  'petersen',
  'patte d',
  'pikine',
  'thiaroye',
  'keur massar',
  'rufisque',
  'yeumbeul',
  'guediawaye',
  'parcelles',
  'camberene',
  'front de terre',
  'castor',
  'grand yoff',
  'liberte',
  'vdn',
  'hlm',
  'medina',
  'tilene',
  'bel air',
  'grand dakar',
  'dieuppeul',
  'mbao',
  'diamniadio',
];
const hourFactors = [
  0.85, 0.85, 0.85, 0.85, 0.85, 0.9, 1.1, 1.45, 1.7, 1.5, 1.25, 1.2, 1.3, 1.35, 1.25, 1.3, 1.45,
  1.75, 1.85, 1.7, 1.35, 1.15, 0.95, 0.9,
];
const monthFactors = [1, 1, 1, 1, 1, 1, 0.95, 1.06, 1.1, 1.08, 1.03, 1.1];
const removeAccents = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');

export function referenceTravelMinutes({
  distanceKm,
  startTime,
  date,
  month,
  from,
  to,
  hasToll,
  ignoreTraffic,
  manualMinutes,
  vehicleId,
}: {
  distanceKm: number;
  startTime: string;
  date?: string;
  month?: string;
  from?: string;
  to?: string;
  hasToll?: boolean;
  ignoreTraffic?: boolean;
  manualMinutes?: number;
  vehicleId: string;
}) {
  const km = Math.max(0, distanceKm);
  if (!km) return 0;
  if (manualMinutes && manualMinutes > 0) return manualMinutes;
  const free = (km / (25 + 40 * (1 - Math.exp(-km / 40)))) * 60;
  if (ignoreTraffic) return free * 1.15 * (vehicleId === 'trafic' ? 1 : 1.05);

  const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})/u);
  const hourMatch = startTime.match(/(\d{1,2})\s*h/u);
  const start = timeMatch
    ? Number(timeMatch[1]) * 60 + Number(timeMatch[2])
    : (hourMatch ? Number(hourMatch[1]) : 8) * 60;
  const departureHour = Math.floor((start + 90) / 60) % 24;
  const parsedDate = date ? new Date(`${date}T12:00:00`) : null;
  const weekday = parsedDate ? parsedDate.getDay() : -1;
  const monthIndex = parsedDate
    ? parsedDate.getMonth()
    : month
      ? Number(month.slice(5, 7)) - 1
      : -1;
  let hourFactor = hourFactors[departureHour];
  if (weekday === 0) hourFactor = 1 + (hourFactor - 1) * 0.35;
  else if (weekday === 6) hourFactor = 1 + (hourFactor - 1) * 0.7;
  let factor = hourFactor;
  if (weekday === 1) factor *= 1.05;
  else if (weekday === 5) factor *= departureHour >= 12 && departureHour <= 15 ? 1.18 : 1.06;
  if (monthIndex >= 0 && monthIndex < 12) factor *= monthFactors[monthIndex];
  if (date) {
    const holiday = holidays[date];
    if (holiday) factor *= 0.65;
    else if (parsedDate) {
      for (let days = 1; days <= 3; days += 1) {
        const next = new Date(parsedDate);
        next.setDate(next.getDate() + days);
        const nextHoliday = holidays[next.toISOString().slice(0, 10)];
        if (nextHoliday && majorHolidays.includes(nextHoliday)) {
          factor *= days === 1 ? 1.4 : days === 2 ? 1.3 : 1.15;
          break;
        }
      }
    }
    if (ramadanPeriods.some(([fromDay, toDay]) => date >= fromDay && date <= toDay)) {
      if (departureHour >= 17 && departureHour < 19) factor *= 1.25;
      else if (departureHour >= 19 && departureHour <= 21) factor *= 0.85;
    }
  }
  const normalizedAddresses = removeAccents(`${from ?? ''} ${to ?? ''}`);
  const affectedZones = zones.filter((zone) => normalizedAddresses.includes(zone));
  if (affectedZones.length) {
    factor *=
      1 +
      Math.min(0.25, affectedZones.length * 0.08) *
        Math.max(0.3, Math.min(1, (hourFactor - 0.85) / 0.9));
  }
  if (hasToll) factor *= 0.9;
  factor = Math.max(0.6, Math.min(2.6, factor));
  return free * factor * (vehicleId === 'trafic' ? 1 : 1.05);
}
