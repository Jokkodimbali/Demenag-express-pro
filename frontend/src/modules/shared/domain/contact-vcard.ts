import type { Booking, Settings } from './model';
import { normalizePhoneNumber } from './phone-number';

const escapeVcard = (value: string) =>
  value.replace(/\\/gu, '\\\\').replace(/\n/gu, '\\n').replace(/,/gu, '\\,').replace(/;/gu, '\\;');
const dateLabel = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

export function contactVcard(
  contact: {
    name: string;
    phone: string;
    bookings: Booking[];
    appointment?: {
      reference: string;
      date: string;
      month: string;
      timeSlot: string;
      fromAddress: string;
      toAddress: string;
      vehicleShortName: string;
    };
  },
  settings: Pick<Settings, 'contactFirstTemplate' | 'contactLastTemplate'>,
) {
  const bookings = [...contact.bookings]
    .filter((booking) => booking.status !== 'cancelled')
    .sort((left, right) => (right.date || '').localeCompare(left.date || ''));
  const appointment = contact.appointment;
  const latest = appointment ?? bookings[0];
  const [given = '', ...familyParts] = contact.name.trim().split(/\s+/u);
  const family = familyParts.join(' ');
  const routeParts = (latest?.fromAddress ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const tokens: Record<string, string> = {
    ref: latest?.reference ?? '',
    prenom: given,
    nom: family,
    client: contact.name.trim(),
    date: latest?.date
      ? dateLabel(latest.date).slice(0, 5)
      : 'month' in (latest ?? {}) && latest.month
        ? new Date(`${latest.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : '',
    vehicule: appointment?.vehicleShortName ?? bookings[0]?.vehicle?.shortName ?? '',
    quartier: routeParts[1] ?? routeParts[0] ?? '',
  };
  const fill = (template: string) =>
    template
      .replace(/\{(\w+)\}/gu, (_, key: string) => tokens[key] ?? '')
      .replace(/\s*·\s*(·\s*)+/gu, ' · ')
      .replace(/^[\s·-]+|[\s·-]+$/gu, '')
      .replace(/\s{2,}/gu, ' ');
  const first = fill(settings.contactFirstTemplate ?? '{ref} {prenom}');
  const last = fill(settings.contactLastTemplate ?? '{nom} · {date}');
  const phone = normalizePhoneNumber(contact.phone) ?? contact.phone.trim();
  const note = [
    'Client Demenag Express',
    ...(appointment
      ? [
          [
            appointment.reference,
            appointment.date
              ? `${dateLabel(appointment.date)}${appointment.timeSlot ? ` ${appointment.timeSlot}` : ''}`
              : appointment.month
                ? new Date(`${appointment.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })
                : '',
            `${appointment.fromAddress || '—'} → ${appointment.toAddress || '—'}`,
            'provisoire',
          ]
            .filter(Boolean)
            .join(' · '),
          ...bookings
            .slice(0, 5)
            .map((booking) =>
              [
                booking.reference,
                booking.date
                  ? `${dateLabel(booking.date)}${booking.timeSlot ? ` ${booking.timeSlot}` : ''}`
                  : '',
                `${booking.fromAddress || '—'} → ${booking.toAddress || '—'}`,
                booking.status === 'completed' ? 'final' : 'provisoire',
              ]
                .filter(Boolean)
                .join(' · '),
            ),
        ]
      : bookings
          .slice(0, 6)
          .map((booking) =>
            [
              booking.reference,
              booking.date
                ? `${dateLabel(booking.date)}${booking.timeSlot ? ` ${booking.timeSlot}` : ''}`
                : '',
              `${booking.fromAddress || '—'} → ${booking.toAddress || '—'}`,
              booking.status === 'completed' ? 'final' : 'provisoire',
            ]
              .filter(Boolean)
              .join(' · '),
          )),
  ].join('\n');
  return {
    first,
    last,
    name: `${first} ${last}`.trim(),
    valid: normalizePhoneNumber(contact.phone) !== null,
    vcard: [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${escapeVcard(last)};${escapeVcard(first)};;;`,
      `FN:${escapeVcard(`${first} ${last}`.trim())}`,
      'ORG:Demenag Express (client)',
      `TEL;TYPE=CELL:${phone}`,
      'CATEGORIES:Demenag Express',
      `NOTE:${escapeVcard(note)}`,
      'END:VCARD',
    ].join('\r\n'),
  };
}
