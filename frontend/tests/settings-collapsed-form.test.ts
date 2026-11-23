import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueFromForm } from '../src/modules/admin/settings/application/mappers/catalogue-from-form';
import type { Catalogue } from '../src/modules/shared/domain/model';

test('un groupe de paramètres fermé ne remet pas à zéro les valeurs conservées en base', async () => {
  const catalogue = {
    vehicles: [{ id: 'sprinter', prices: [31_000, 41_000, 51_000] }],
    settings: {
      distanceBounds: [15, 25, 35],
      labourPrice: 8_000,
      labourFloorPrice: 700,
      labourLiftPrice: 600,
      assemblyPrice: 5_000,
      whatsappPhone: '+221770000000',
      whatsappCountryCode: '221',
      grossMarginAboveThresholdColor: '#11aa55',
      grossMarginBelowThresholdColor: '#dd3344',
      paymentWave: true,
      paymentCash: false,
      movingLaborPlanning: {
        maxHandlingHours: 4,
        maxDayHours: 9,
        defaultStartHour: 8,
        maxMoversPerVehicle: 6,
        cubicMetersPerHourPerMover: 2.7,
        pauseMinutes: 30,
        blanketLengthCm: 204,
        blanketWidthCm: 184,
        blanketStock: 20,
      },
    },
  } as Catalogue;
  const form = new FormData();
  form.set('businessAddress', 'Nouvelle adresse');
  const updated = await catalogueFromForm(form, catalogue);

  assert.deepEqual(updated.vehicles[0].prices, catalogue.vehicles[0].prices);
  assert.equal(updated.settings.labourPrice, 8_000);
  assert.equal(updated.settings.assemblyPrice, 5_000);
  assert.equal(updated.settings.whatsappPhone, '+221770000000');
  assert.equal(updated.settings.paymentWave, true);
  assert.equal(updated.settings.paymentCash, false);
  assert.equal(updated.settings.grossMarginAboveThresholdColor, '#11aa55');
  assert.equal(updated.settings.grossMarginBelowThresholdColor, '#dd3344');
  assert.deepEqual(
    updated.settings.taxiDistanceTariffs?.map((tariff) => tariff.amountFcfa),
    [1500, 2500, 3500, 5000, 7000, 30000],
  );
  assert.equal(updated.settings.movingLaborPlanning?.maxHandlingHours, 4);
  assert.equal(updated.settings.businessAddress, 'Nouvelle adresse');
});

test('les couleurs de marge modifiées dans le formulaire sont enregistrées', async () => {
  const catalogue = {
    vehicles: [],
    settings: {
      distanceBounds: [15, 25, 35],
      labourPrice: 8_000,
      assemblyPrice: 5_000,
      whatsappPhone: '+221770000000',
      whatsappCountryCode: '221',
    },
  } as Catalogue;
  const form = new FormData();
  form.set('grossMarginAboveThresholdColor', '#04bb77');
  form.set('grossMarginBelowThresholdColor', '#ee2244');

  const updated = await catalogueFromForm(form, catalogue);

  assert.equal(updated.settings.grossMarginAboveThresholdColor, '#04bb77');
  assert.equal(updated.settings.grossMarginBelowThresholdColor, '#ee2244');
});

test('les distances limites et montants taxi modifiés sont lus depuis le formulaire', async () => {
  const catalogue = {
    vehicles: [],
    settings: {
      distanceBounds: [15, 25, 35],
      labourPrice: 8_000,
      assemblyPrice: 5_000,
      whatsappPhone: '+221770000000',
      whatsappCountryCode: '221',
    },
  } as Catalogue;
  const form = new FormData();
  form.set('taxiDistanceTariffs.count', '2');
  for (const [index, values] of [
    { id: 'local', label: 'Course locale', maxDistanceKm: '5', amountFcfa: '1800' },
    { id: 'long', label: 'Course longue', maxDistanceKm: '', amountFcfa: '30000' },
  ].entries()) {
    form.set(`taxiDistanceTariffs.${index}.id`, values.id);
    form.set(`taxiDistanceTariffs.${index}.label`, values.label);
    form.set(`taxiDistanceTariffs.${index}.maxDistanceKm`, values.maxDistanceKm);
    form.set(`taxiDistanceTariffs.${index}.amountFcfa`, values.amountFcfa);
    form.set(`taxiDistanceTariffs.${index}.sortOrder`, String(index));
  }

  const updated = await catalogueFromForm(form, catalogue);

  assert.deepEqual(
    updated.settings.taxiDistanceTariffs?.map(({ minDistanceKm, maxDistanceKm, amountFcfa }) => ({
      minDistanceKm,
      maxDistanceKm,
      amountFcfa,
    })),
    [
      { minDistanceKm: 0, maxDistanceKm: 5, amountFcfa: 1800 },
      { minDistanceKm: 5, maxDistanceKm: null, amountFcfa: 30000 },
    ],
  );
});
