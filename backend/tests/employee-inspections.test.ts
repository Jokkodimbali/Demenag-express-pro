import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeInspectionSchema } from '../src/adapters/in/http/schemas.js';
import { VehicleReportService } from '../src/application/services/vehicle-reports.js';
import type { DriverRepository, VehicleReportRepository } from '../src/application/ports/index.js';
import type { Driver, User } from '../src/domain/model.js';
const image = 'data:image/jpeg;base64,/9j/AA==';
test('Le contrôle employé conserve les cinq photos et le carburant, et autorise plusieurs envois par jour', async () => {
  const driver: Driver = {
    id: 'driver',
    userId: 'user',
    name: 'Moussa',
    phone: '+221770000001',
    photo: null,
    active: true,
    vehicleId: null,
    role: 'chauffeur',
    authorizedVehicleIds: ['truck'],
  };
  const actor: User = {
    id: 'user',
    name: driver.name,
    phone: driver.phone,
    role: 'driver',
    active: true,
  };
  const drivers: DriverRepository = {
    list: async () => [driver],
    find: async () => driver,
    findByUserId: async () => driver,
    create: async (d) => d,
    update: async (d) => d,
  };
  const saved: unknown[] = [];
  const reports: VehicleReportRepository = {
    createInspection: async (_driver, vehicle, date, input) => {
      saved.push(input);
      return { id: String(saved.length), vehicle, date, ...input };
    },
    createBreakdown: async () => ({}),
    listInspections: async () => [],
    listBreakdowns: async () => [],
    listDriverInspections: async () => [],
    listDriverBreakdowns: async () => [],
    findInspection: async () => ({ photos: Array(6).fill(image) }),
  };
  const service = new VehicleReportService(reports, drivers);
  const items = Object.fromEntries(
    ['engineOil', 'brakeFluid', 'coolant', 'washerFluid', 'fuel'].map((key) => [
      key,
      { image, ok: key !== 'fuel' },
    ]),
  );
  const input = employeeInspectionSchema.parse({ vehicleId: 'truck', items });
  assert.equal(input.levels.fuel, 'low');
  assert.equal(input.photos.length, 5);
  await service.submitInspection(actor, input);
  await service.submitInspection(actor, input);
  assert.equal(saved.length, 2);
  await assert.rejects(
    service.submitInspection(actor, { ...input, vehicleId: 'other' }),
    /non autorisé/,
  );
  assert.equal(
    employeeInspectionSchema.safeParse({
      vehicleId: 'truck',
      items: { ...items, fuel: { ok: true } },
    }).success,
    false,
  );
  driver.role = 'manoeuvre';
  await assert.rejects(service.submitInspection(actor, input), /réservée aux chauffeurs/);
});
