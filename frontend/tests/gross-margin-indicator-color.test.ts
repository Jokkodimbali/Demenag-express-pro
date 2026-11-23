import assert from 'node:assert/strict';
import test from 'node:test';
import { grossMarginIndicatorColor } from '../src/modules/admin/quotes/application/services/gross-margin-indicator-color';

test('la marge au-dessus de 50 000 FCFA prend la couleur verte configurée', () => {
  assert.equal(grossMarginIndicatorColor(50_001, '#00aa55', '#dd3344'), '#00aa55');
});

test('la marge en dessous de 50 000 FCFA prend la couleur rouge configurée', () => {
  assert.equal(grossMarginIndicatorColor(49_999, '#00aa55', '#dd3344'), '#dd3344');
});

test('une marge exactement à 50 000 FCFA conserve la couleur neutre du thème', () => {
  assert.equal(grossMarginIndicatorColor(50_000, '#00aa55', '#dd3344'), undefined);
});

test('une marge absente ou une couleur invalide conserve la couleur du thème', () => {
  assert.equal(grossMarginIndicatorColor(null, '#00aa55', '#dd3344'), undefined);
  assert.equal(grossMarginIndicatorColor(60_000, 'green', '#dd3344'), undefined);
});
