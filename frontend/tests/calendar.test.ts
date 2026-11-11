import assert from 'node:assert/strict';
import test from 'node:test';
import { isUndatedBookingForMonth } from '../src/modules/admin/planning/domain/calendar';

test('les réservations sans date suivent le mois souhaité, pas le mois de création', () => {
  const booking = {
    date: null,
    month: '2027-02',
    createdAt: '2026-11-06T12:00:00.000Z',
    status: 'pending',
  } as const;

  assert.equal(isUndatedBookingForMonth(booking, '2027-02'), true);
  assert.equal(isUndatedBookingForMonth(booking, '2026-11'), false);
});

test('les anciennes réservations sans mois utilisent le mois de création', () => {
  const booking = {
    date: null,
    createdAt: '2026-11-06T12:00:00.000Z',
    status: 'pending',
  } as const;

  assert.equal(isUndatedBookingForMonth(booking, '2026-11'), true);
});

test('les réservations datées et annulées ne figurent pas dans les sans-date', () => {
  assert.equal(
    isUndatedBookingForMonth(
      {
        date: '2026-11-12',
        month: '2026-11',
        createdAt: '2026-11-06T12:00:00.000Z',
        status: 'pending',
      },
      '2026-11',
    ),
    false,
  );
  assert.equal(
    isUndatedBookingForMonth(
      {
        date: null,
        month: '2026-11',
        createdAt: '2026-11-06T12:00:00.000Z',
        status: 'cancelled',
      },
      '2026-11',
    ),
    false,
  );
});
