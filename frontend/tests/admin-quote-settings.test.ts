import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Booking, Price, Settings, Vehicle } from '../src/modules/shared/domain/model';
import { blankDraft } from '../src/modules/booking/application/booking-draft';
import {
  quoteConfigWithManualTaxiFee,
  quoteConfigurationFromBooking,
  quoteSettingsForEditing,
} from '../src/modules/admin/quotes/application/services/admin-quote-form-policy';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config';
import { buildAdminQuoteSubmission } from '../src/modules/admin/quotes/application/services/admin-quote-submission';

test('la soumission conserve le tarif simple pour les champs actuels et historiques', () => {
  const draft = blankDraft();
  const submission = buildAdminQuoteSubmission({
    draft,
    config: { ...defaultAdminQuoteConfig(), taxiFeeAmountOverride: 13_650 },
    catalogue: null,
    fallbackVehicle: {} as Vehicle,
    kind: 'provisional',
    tier: 0,
    version: 1,
    notes: '',
    extraLines: [],
    tollLines: [],
  });

  assert.equal(submission.taxiPerLegAmountOverride, 13_650);
  assert.equal(submission.taxiRoundTripAmountOverride, 13_650);
});

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

test('un devis enregistré convertit le total taxi historique en tarif par trajet simple', () => {
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
  assert.equal(restored.taxiFeeAmountOverride, 7_500);
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

test('un devis réouvert reprend séparément les deux montants taxi modifiés', () => {
  const price: Price = {
    lines: [
      { label: 'Manœuvres', quantity: 1, unitPrice: 8_880, total: 8_880 },
      { label: 'Manœuvres', quantity: 4, unitPrice: 8_881, total: 35_524 },
    ],
    total: 44_404,
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
        id: 'quote-taxi-overrides',
        reference: 'DV-4',
        kind: 'provisional',
        createdAt: '2026-11-17T00:00:00.000Z',
        price,
        notes: '',
        pricingInput: {
          taxiFeeAmount: 11_904,
          taxiRoundTripAmountOverride: 3_413,
          taxiCompanyApproachAmountOverride: 1_665,
          extraLines: [{ label: 'Inventaire', quantity: 1, unitPrice: 0 }],
        },
      },
    ],
  } as Booking;

  const restored = quoteConfigurationFromBooking(booking).config;

  assert.equal(restored.taxiFeeApplied, true);
  assert.equal(restored.taxiFeeAmountOverride, 3_413);
  assert.equal(restored.taxiCompanyApproachAmountOverride, 1_665);

  const newPerLeg = quoteConfigurationFromBooking({
    ...booking,
    quotes: [
      {
        ...booking.quotes[0],
        pricingInput: {
          ...booking.quotes[0].pricingInput,
          taxiPerLegAmountOverride: 3_413,
        },
      },
    ],
  } as Booking).config;
  assert.equal(newPerLeg.taxiFeeAmountOverride, 3_413);
});

test('un devis avec montants taxi calculés reprend les réglages actuels à la réouverture', () => {
  const price: Price = {
    lines: [{ label: 'Manœuvres', quantity: 5, unitPrice: 8_880, total: 44_400 }],
    total: 44_400,
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
        id: 'quote-auto-taxi',
        reference: 'DV-5',
        kind: 'provisional',
        createdAt: '2026-11-17T00:00:00.000Z',
        price,
        notes: '',
        pricingInput: {
          taxiFeeAmount: 11_900,
          taxiRoundTripAmountOverride: null,
          taxiCompanyApproachAmountOverride: null,
          extraLines: [{ label: 'Inventaire', quantity: 1, unitPrice: 0 }],
        },
      },
    ],
  } as Booking;

  const restored = quoteConfigurationFromBooking(booking).config;

  assert.equal(restored.taxiFeeApplied, true);
  assert.equal(restored.taxiFeeAmountOverride, null);
  assert.equal(restored.taxiCompanyApproachAmountOverride, null);
});
