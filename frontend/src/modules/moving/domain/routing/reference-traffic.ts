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

export type ReferenceTrafficFactor = { label: string; factor: number };
export type ReferenceTrafficDetails = {
  minutes: number;
  freeMinutes: number;
  coefficient: number | null;
  departureTime: string;
  factors: ReferenceTrafficFactor[];
  manual: boolean;
  ignored: boolean;
};

type ReferenceTrafficInput = {
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
};

export function referenceTrafficDetails({
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
}: ReferenceTrafficInput): ReferenceTrafficDetails {
  const km = Math.max(0, distanceKm);
  if (!km)
    return {
      minutes: 0,
      freeMinutes: 0,
      coefficient: null,
      departureTime: '',
      factors: [],
      manual: false,
      ignored: Boolean(ignoreTraffic),
    };
  const free = referenceFreeTravelMinutes(km);
  const vehicleFactor = vehicleId === 'trafic' ? 1 : 1.05;
  const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})/u);
  const hourMatch = startTime.match(/(\d{1,2})\s*h/u);
  const start = timeMatch
    ? Number(timeMatch[1]) * 60 + Number(timeMatch[2])
    : (hourMatch ? Number(hourMatch[1]) : 8) * 60;
  const departure = start + 90;
  const departureHour = Math.floor(departure / 60) % 24;
  const roundedDeparture = Math.round((departure % 1440) / 5) * 5;
  const departureTime = `${String(Math.floor(roundedDeparture / 60) % 24).padStart(2, '0')}:${String(roundedDeparture % 60).padStart(2, '0')}`;
  if (manualMinutes && manualMinutes > 0)
    return {
      minutes: manualMinutes,
      freeMinutes: free,
      coefficient: null,
      departureTime,
      factors: [],
      manual: true,
      ignored: Boolean(ignoreTraffic),
    };
  if (ignoreTraffic)
    return {
      minutes: free * 1.15 * vehicleFactor,
      freeMinutes: free,
      coefficient: 1.15,
      departureTime,
      factors: [],
      manual: false,
      ignored: true,
    };

  const factors: ReferenceTrafficFactor[] = [];
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
  const hourLabel =
    hourFactor >= 1.6
      ? 'heure de pointe'
      : hourFactor >= 1.3
        ? 'trafic dense'
        : hourFactor < 1
          ? 'heure creuse'
          : '';
  factors.push({
    label: `Départ estimé ${departureTime}${hourLabel ? ` · ${hourLabel}` : ''}`,
    factor: hourFactor,
  });
  const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  if (weekday >= 0) {
    const dayFactor =
      weekday === 1
        ? 1.05
        : weekday === 5
          ? departureHour >= 12 && departureHour <= 15
            ? 1.18
            : 1.06
          : 1;
    if (dayFactor !== 1) factor *= dayFactor;
    factors.push({
      label: `${weekdays[weekday]}${weekday === 5 && departureHour >= 12 && departureHour <= 15 ? ' · prière du vendredi' : weekday === 0 ? ' · circulation réduite' : weekday === 6 ? ' · samedi' : ''}`,
      factor: dayFactor,
    });
  }
  if (monthIndex >= 0 && monthIndex < 12) {
    const monthFactor = monthFactors[monthIndex];
    factor *= monthFactor;
    const monthLabels = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const monthContext = [
      '',
      '',
      '',
      '',
      '',
      '',
      'vacances scolaires',
      'hivernage',
      'hivernage',
      'rentrée scolaire',
      '',
      'fêtes de fin d’année',
    ][monthIndex];
    if (monthFactor !== 1)
      factors.push({ label: `${monthLabels[monthIndex]} · ${monthContext}`, factor: monthFactor });
  }
  if (date && parsedDate) {
    const holiday = holidays[date];
    let holidayFactor = 1;
    let holidayLabel = '';
    if (holiday) {
      holidayFactor = 0.65;
      holidayLabel = `${holiday} · jour férié`;
    } else {
      for (let days = 1; days <= 3; days += 1) {
        const next = new Date(parsedDate);
        next.setDate(next.getDate() + days);
        const nextHoliday = holidays[next.toISOString().slice(0, 10)];
        if (nextHoliday && majorHolidays.includes(nextHoliday)) {
          holidayFactor = days === 1 ? 1.4 : days === 2 ? 1.3 : 1.15;
          holidayLabel = `${days === 1 ? 'Veille de ' : `J-${days} avant `}${nextHoliday} · marchés et départs`;
          break;
        }
      }
    }
    if (holidayFactor !== 1) {
      factor *= holidayFactor;
      factors.push({ label: holidayLabel, factor: holidayFactor });
    }
    if (ramadanPeriods.some(([fromDay, toDay]) => date >= fromDay && date <= toDay)) {
      const ramadanFactor =
        departureHour >= 17 && departureHour < 19
          ? 1.25
          : departureHour >= 19 && departureHour <= 21
            ? 0.85
            : 1;
      if (ramadanFactor !== 1) {
        factor *= ramadanFactor;
        factors.push({
          label: `Ramadan · ${ramadanFactor > 1 ? 'avant la rupture du jeûne' : 'après la rupture du jeûne'}`,
          factor: ramadanFactor,
        });
      }
    }
  }
  const normalizedAddresses = removeAccents(`${from ?? ''} ${to ?? ''}`);
  const affectedZones = zones.filter((zone) => normalizedAddresses.includes(zone));
  if (affectedZones.length) {
    const zoneFactor =
      1 +
      Math.min(0.25, affectedZones.length * 0.08) *
        Math.max(0.3, Math.min(1, (hourFactor - 0.85) / 0.9));
    factor *= zoneFactor;
    factors.push({
      label: `Points noirs : ${affectedZones.slice(0, 4).join(', ')}`,
      factor: zoneFactor,
    });
  }
  if (hasToll) {
    factor *= 0.9;
    factors.push({ label: 'Autoroute à péage · plus fluide', factor: 0.9 });
  }
  factor = Math.max(0.6, Math.min(2.6, factor));
  return {
    minutes: free * factor * vehicleFactor,
    freeMinutes: free,
    coefficient: factor,
    departureTime,
    factors,
    manual: false,
    ignored: false,
  };
}

export function referenceTravelMinutes(input: ReferenceTrafficInput) {
  return referenceTrafficDetails(input).minutes;
}

export function referenceFreeTravelMinutes(distanceKm: number): number {
  const km = Math.max(0, distanceKm);
  return km ? (km / (25 + 40 * (1 - Math.exp(-km / 40)))) * 60 : 0;
}
