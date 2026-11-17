import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Booking, Price, Settings } from '../src/modules/shared/domain/model';
import {
  quoteConfigWithManualTaxiFee,
  quoteConfigurationFromBooking,
  quoteSettingsForEditing,
} from '../src/modules/admin/quotes/application/services/admin-quote-form-policy';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config';

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

test('saisir un montant taxi personnalisé active les frais et met à jour le calcul', () => {
  const updated = quoteConfigWithManualTaxiFee(
    { ...defaultAdminQuoteConfig(), taxiFeeApplied: false },
    '10000',
  );

  assert.equal(updated.taxiFeeApplied, true);
  assert.equal(updated.taxiFeeAmountOverride, 10_000);
});

test('un devis enregistré recharge son montant taxi par aller-retour', () => {
  const price: Price = {
    lines: [{ label: 'Manœuvres', quantity: 5, unitPrice: 12_500, total: 62_500 }],
    total: 62_500,
    discount: 0,
    tier: 0,
    trips: 3,
    currency: 'XOF',
  };
  const booking = {
    estimate: { ...price, trips: 1 },
    pricingSettings: { labourPrice: 6_500 } as Settings,
    quotes: [
      {
        id: 'quote-1',
        reference: 'DV-1',
        kind: 'provisional',
        createdAt: '2026-11-17T00:00:00.000Z',
        price,
        notes: '',
        pricingInput: {
          taxiFeeAmount: 30_000,
        },
      },
    ],
  } as Booking;

  const restored = quoteConfigurationFromBooking(booking).config;

  assert.equal(restored.taxiFeeApplied, true);
  assert.equal(restored.taxiFeeAmountOverride, 10_000);
});

test('un ancien frais locaux unique reste compté une fois à la réouverture', () => {
  const price: Price = {
    lines: [{ label: 'Manœuvres', quantity: 5, unitPrice: 7_500, total: 37_500 }],
    total: 37_500,
    discount: 0,
    tier: 0,
    trips: 3,
    currency: 'XOF',
  };
  const booking = {
    estimate: { ...price, trips: 1 },
    pricingSettings: { labourPrice: 6_500 } as Settings,
    quotes: [
      {
        id: 'quote-legacy-approach',
        reference: 'DV-3',
        kind: 'provisional',
        createdAt: '2026-11-17T00:00:00.000Z',
        price,
        notes: '',
        pricingInput: {
          taxiFeeAmount: 5_000,
          extraLines: [
            { label: 'Frais taxi · approche entreprise', quantity: 1, unitPrice: 5_000 },
          ],
        },
      },
    ],
  } as Booking;

  const restored = quoteConfigurationFromBooking(booking).config;

  assert.equal(restored.taxiCompanyApproachAmountOverride, 5_000);
});
