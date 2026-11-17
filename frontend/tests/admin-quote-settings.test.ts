import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Settings } from '../src/modules/shared/domain/model';
import { quoteSettingsForEditing } from '../src/modules/admin/quotes/application/services/admin-quote-form-policy';

test('un devis existant reprend les réglages taxi actuels en gardant son ancien tarif de manœuvre', () => {
  const bookingSettings = {
    labourPrice: 6_500,
    taxiFeeEnabled: false,
    taxiFeePerKm: 0,
  } as Settings;
  const currentSettings = {
    labourPrice: 8_000,
    taxiFeeEnabled: true,
    taxiFeePerKm: 300,
  } as Settings;

  const effectiveSettings = quoteSettingsForEditing(bookingSettings, currentSettings);

  assert.equal(effectiveSettings?.taxiFeeEnabled, true);
  assert.equal(effectiveSettings?.taxiFeePerKm, 300);
  assert.equal(effectiveSettings?.labourPrice, 6_500);
});

test('sans instantané de réservation, le formulaire utilise les réglages courants', () => {
  const currentSettings = {
    taxiFeeEnabled: true,
    taxiFeePerKm: 300,
  } as Settings;

  assert.equal(quoteSettingsForEditing(undefined, currentSettings), currentSettings);
});
