import assert from 'node:assert/strict';
import test from 'node:test';
import type { AccountingEntry, Booking, Quote } from '../src/modules/shared/domain/model';
import {
  quoteAccountingConfirmation,
  quoteAccountingJournalRows,
} from '../src/modules/admin/quotes/application/services/quote-accounting-confirmation';

test('le devis final affiche son revenu et ses charges avec leurs références réelles', () => {
  const booking = { id: 'booking-1' } as Booking;
  const quote = { id: 'quote-1', reference: 'DV-2026-0001' } as Quote;
  const entries = [
    {
      id: quote.id,
      bookingId: booking.id,
      reference: quote.reference,
      type: 'revenu',
      category: 'Déménagement',
      label: 'Devis final DV-2026-0001',
      amount: 56000,
    },
    {
      id: 'auto-labour-quote-1',
      bookingId: booking.id,
      reference: quote.id,
      type: 'charge',
      category: 'Manœuvres',
      label: 'Manœuvres 3 · DEM-123',
      amount: 15000,
    },
    {
      id: 'other-booking',
      bookingId: 'booking-2',
      reference: quote.reference,
      type: 'revenu',
      amount: 99999,
    },
  ] as AccountingEntry[];

  const rows = quoteAccountingJournalRows(booking, quote, entries);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, 'Revenu · déménagement');
  assert.ok(rows[0].amount.startsWith('+ '));
  assert.match(rows[0].amount, /56\s?000/);
  assert.ok(rows[1].amount.startsWith('− '));
  assert.match(rows[1].amount, /15\s?000/);
  assert.match(quoteAccountingConfirmation(booking, quote, entries), /revenu 56\s?000/);
});

test('le signe reste unique si une charge arrive avec un montant déjà négatif', () => {
  const booking = { id: 'booking-1' } as Booking;
  const quote = { id: 'quote-1', reference: 'DV-2026-0001' } as Quote;
  const entries = [
    {
      id: 'charge-1',
      bookingId: booking.id,
      reference: quote.id,
      type: 'charge',
      category: 'Manœuvres',
      label: 'Manœuvres',
      amount: -15000,
    },
  ] as AccountingEntry[];
  const [row] = quoteAccountingJournalRows(booking, quote, entries);
  assert.ok(row.amount.startsWith('− '));
  assert.equal(row.amount.includes('-15'), false);
});
