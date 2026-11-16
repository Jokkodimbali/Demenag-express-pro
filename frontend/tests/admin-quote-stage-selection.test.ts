import assert from 'node:assert/strict';
import test from 'node:test';
import type { Booking, Quote } from '../src/modules/shared/domain/model';
import {
  canSaveQuoteStageChange,
  quoteStageChanged,
} from '../src/modules/admin/quotes/application/services/admin-quote-edit-policy';
import { canCreateFinalQuote } from '../src/modules/admin/quotes/application/services/admin-quote-form-policy';

function booking(status: Booking['status'], kind: Quote['kind']): Booking {
  return {
    status,
    quotes: [{ id: 'quote-1', kind }],
  } as Booking;
}

test('un devis final peut revenir au provisoire sans sauvegarde automatique', () => {
  const current = booking('completed', 'final');
  assert.equal(quoteStageChanged(current, 'provisional'), true);
  assert.equal(canSaveQuoteStageChange(current, 'provisional'), true);
  assert.equal(canCreateFinalQuote(current, '2026-11-16', false), true);
});

test('un devis provisoire peut être sélectionné en final avant de cliquer sur enregistrer', () => {
  const current = booking('pending', 'provisional');
  assert.equal(quoteStageChanged(current, 'final'), true);
  assert.equal(canSaveQuoteStageChange(current, 'final'), true);
  assert.equal(canCreateFinalQuote(current, '2026-11-16', false), true);
});

test('un devis annulé ne peut pas être enregistré dans une autre étape', () => {
  const current = booking('cancelled', 'provisional');
  assert.equal(quoteStageChanged(current, 'final'), true);
  assert.equal(canSaveQuoteStageChange(current, 'final'), false);
});

test('une réservation sans devis peut activer le passage en final', () => {
  const current = { status: 'pending', quotes: [] } as unknown as Booking;
  assert.equal(quoteStageChanged(current, 'final'), true);
  assert.equal(canSaveQuoteStageChange(current, 'final'), true);
});
