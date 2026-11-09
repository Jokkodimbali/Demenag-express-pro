import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingDateError, bookingTimeError } from '../src/domain/booking-validation';
import { normalizePhoneNumber, sanitizePhoneInput } from '../src/domain/phone-number';

const settings = {
  maxAdvanceDays: 30,
  minNoticeHours: 24,
  enabledSlots: [
    { label: 'Matin (8h – 12h)', startHour: 8 },
    { label: 'Après-midi (13h – 17h)', startHour: 13 },
  ],
};
const now = new Date('2026-11-09T10:00:00.000Z');

test('le téléphone accepte les numéros sénégalais locaux et les formats internationaux', () => {
  assert.equal(normalizePhoneNumber('77 123 45 67'), '+221771234567');
  assert.equal(normalizePhoneNumber('+221 77 123 45 67'), '+221771234567');
  assert.equal(normalizePhoneNumber('00221-77-123-45-67'), '+221771234567');
  assert.equal(normalizePhoneNumber('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhoneNumber('+1 (202) 555-0123'), '+12025550123');
  assert.equal(normalizePhoneNumber('0044 20 7946 0958'), '+442079460958');
  assert.equal(sanitizePhoneInput('+33 ABC 6 12 34 56 78'), '+33 6 12 34 56 78');
});

test('le téléphone refuse les lettres, les numéros locaux étrangers et les longueurs impossibles', () => {
  assert.equal(normalizePhoneNumber('77 abc 45 67'), null);
  assert.equal(normalizePhoneNumber('06 12 34 56 78'), null);
  assert.equal(normalizePhoneNumber('+225 07 12 34 56 78'), '+2250712345678');
  assert.equal(normalizePhoneNumber('+1234567890123456'), null);
});

test('la date refuse une valeur vide, impossible, passée ou au-delà de la limite configurée', () => {
  assert.match(bookingDateError('', settings, now) ?? '', /Choisissez une date/u);
  assert.match(bookingDateError('2026-02-30', settings, now) ?? '', /n’existe pas/u);
  assert.match(bookingDateError('2026-11-08', settings, now) ?? '', /passée/u);
  assert.match(bookingDateError('2026-12-20', settings, now) ?? '', /30 prochains jours/u);
  assert.equal(bookingDateError('2026-11-10', settings, now), undefined);
});

test('le créneau doit être disponible et respecter le préavis minimal', () => {
  assert.match(bookingTimeError('2026-11-10', '', settings, now) ?? '', /Choisissez un créneau/u);
  assert.match(
    bookingTimeError('2026-11-10', '09:00', settings, now) ?? '',
    /n’est plus disponible/u,
  );
  assert.match(
    bookingTimeError('2026-11-10', '08:00', settings, now) ?? '',
    /24 heures de préavis/u,
  );
  assert.equal(bookingTimeError('2026-11-10', '13:00', settings, now), undefined);
  assert.match(
    bookingTimeError('2026-11-09', '08:00', { ...settings, minNoticeHours: 0 }, now) ?? '',
    /heure qui n’est pas déjà passée/u,
  );
});
