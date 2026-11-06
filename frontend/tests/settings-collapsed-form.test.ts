import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueFromForm } from '../src/application/validation/forms';
import type { Catalogue } from '../src/domain/model';

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
  assert.equal(updated.settings.movingLaborPlanning?.maxHandlingHours, 4);
  assert.equal(updated.settings.businessAddress, 'Nouvelle adresse');
});
