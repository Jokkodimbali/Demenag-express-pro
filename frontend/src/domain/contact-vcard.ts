import type { Booking, Settings } from './model';

const escapeVcard = (value: string) => value.replace(/\\/gu, '\\\\').replace(/\n/gu, '\\n').replace(/,/gu, '\\,').replace(/;/gu, '\\;');
const dateLabel = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

export function contactVcard(contact: {
  name: string;
  phone: string;
  bookings: Booking[];
}, settings: Pick<Settings, 'contactFirstTemplate' | 'contactLastTemplate'>) {
  const bookings = [...contact.bookings].filter((booking) => booking.status !== 'cancelled').sort((left, right) => (right.date || '').localeCompare(left.date || ''));
  const latest = bookings[0];
  const [given = '', ...familyParts] = contact.name.trim().split(/\s+/u);
  const family = familyParts.join(' ');
  const routeParts = (latest?.fromAddress ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const tokens: Record<string, string> = {
    ref: latest?.reference ?? '',
    prenom: given,
    nom: family,
    client: contact.name.trim(),
    date: latest?.date ? dateLabel(latest.date).slice(0, 5) : '',
    vehicule: latest?.vehicle?.shortName ?? '',
    quartier: routeParts[1] ?? routeParts[0] ?? '',
  };
  const fill = (template: string) => template.replace(/\{(\w+)\}/gu, (_, key: string) => tokens[key] ?? '').replace(/\s*·\s*(·\s*)+/gu, ' · ').replace(/^[\s·-]+|[\s·-]+$/gu, '').replace(/\s{2,}/gu, ' ');
  const first = fill(settings.contactFirstTemplate ?? '{ref} {prenom}');
  const last = fill(settings.contactLastTemplate ?? '{nom} · {date}');
  const digits = contact.phone.replace(/\D/gu, '').slice(-9);
  const phone = digits.length === 9 ? `+221${digits}` : contact.phone.trim();
  const note = ['Client Demenag Express', ...bookings.slice(0, 6).map((booking) => [booking.reference, booking.date ? `${dateLabel(booking.date)}${booking.timeSlot ? ` ${booking.timeSlot}` : ''}` : '', `${booking.fromAddress || '—'} → ${booking.toAddress || '—'}`, booking.status === 'completed' ? 'final' : 'provisoire'].filter(Boolean).join(' · '))].join('\n');
  return {
    name: `${first} ${last}`.trim(),
    valid: digits.length === 9,
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
