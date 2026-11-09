import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSchema } from '../src/adapters/in/http/schemas.js';

const input = {
  vehicleId: 'sprinter',
  routeId: '123e4567-e89b-42d3-a456-426614174000',
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  customerName: 'Client test',
  customerPhone: '+221 77 123 45 67',
  fromAddress: 'Dakar',
  toAddress: 'Thiès',
  date: '2026-11-10',
  timeSlot: '08:00',
  requestId: '123e4567-e89b-42d3-a456-426614174001',
};

test('la réservation accepte les numéros sénégalais et internationaux valides', () => {
  assert.equal(bookingSchema.safeParse(input).success, true);
  assert.equal(
    bookingSchema.safeParse({ ...input, customerPhone: '00221-77-123-45-67' }).success,
    true,
  );
  assert.equal(
    bookingSchema.safeParse({ ...input, customerPhone: '+33 6 12 34 56 78' }).success,
    true,
  );
  assert.equal(
    bookingSchema.safeParse({ ...input, customerPhone: '+1 (202) 555-0123' }).success,
    true,
  );
});

test('la réservation refuse lettres, numéro incomplet et numéro trop long', () => {
  assert.equal(
    bookingSchema.safeParse({ ...input, customerPhone: '+33 6 AB 34 56 78' }).success,
    false,
  );
  assert.equal(bookingSchema.safeParse({ ...input, customerPhone: '+1 23' }).success, false);
  assert.equal(
    bookingSchema.safeParse({ ...input, customerPhone: '+1234567890123456' }).success,
    false,
  );
});
