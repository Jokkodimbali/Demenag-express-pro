import assert from 'node:assert/strict';
import test from 'node:test';
import { vehicleCapacity } from '../src/modules/shared/domain/vehicles/vehicle-capacity';

test('le volume utile reprend la formule de passages de roue du fichier de référence', () => {
  const length = 4.3;
  const height = 1.94;
  const width = 1.78;
  const wheelWidth = 1.35;
  const arch = (width - wheelWidth) * 0.3 * Math.min(0.95 * 2, length);
  const expected = `${(Math.round(Math.max(0, length * height * width - arch) * 0.95 * 10) / 10).toFixed(1).replace('.', ',')} m³`;

  assert.equal(vehicleCapacity('4.30', '1.94', '1.78', '1.35'), expected);
});
