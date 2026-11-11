export function trafficDuration(minutes: number) {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours} h${remaining ? ` ${String(remaining).padStart(2, '0')}` : ''}`
    : `${remaining} min`;
}

export function trafficDeparture(date: string | null, timeSlot: string, now = Date.now()) {
  const timeMatch = /^(\d{1,2}):(\d{2})$/u.exec(timeSlot);
  const departure =
    date && timeMatch
      ? new Date(`${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
      : undefined;
  return {
    departure,
    future: Boolean(departure && departure.getTime() > now + 60000),
  };
}

export function trafficDelayPresentation(
  hasMapsKey: boolean,
  delay: number,
  hasTrafficResult: boolean,
) {
  const color = !hasMapsKey
    ? '#6B737B'
    : !hasTrafficResult
      ? '#AEB4BB'
      : delay > 15
        ? '#FF5A5F'
        : delay > 5
          ? '#FFD23F'
          : '#3DDC84';
  return { delay, color };
}
