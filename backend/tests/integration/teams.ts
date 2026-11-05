import assert from 'node:assert/strict';
import type { IntegrationContext } from './context.js';
import { integrationHeader } from './context.js';

export async function verifyTeamManagement(
  context: IntegrationContext,
  driverId: string,
  initialPassword: string,
) {
  const { admin, driver, first } = context.clients;
  assert.equal((await admin.get('/api/admin/drivers').set(integrationHeader)).status, 200);
  assert.equal((await first.get('/api/admin/drivers')).status, 403);
  assert.equal((await first.get('/api/admin/drivers').set(integrationHeader)).status, 403);
  assert.equal((await driver.get('/api/admin/drivers').set(integrationHeader)).status, 403);
  assert.equal(
    (await first.post('/api/admin/drivers').set(integrationHeader).send({})).status,
    403,
  );
  assert.equal(
    (
      await driver
        .put('/api/admin/drivers/' + driverId)
        .set(integrationHeader)
        .send({})
    ).status,
    403,
  );
  assert.equal(
    (
      await first
        .delete('/api/admin/drivers/' + driverId)
        .set(integrationHeader)
        .send({})
    ).status,
    403,
  );
  const initial = await admin.get('/api/admin/drivers');
  assert.equal(initial.status, 200);
  const employee = initial.body.find((item: { id: string }) => item.id === driverId);
  assert.ok(employee);
  const adminAvailability = Array.from({ length: 7 }, (_, index) => ({
    available: index !== 6,
    startTime: '08:00',
    endTime: '18:00',
  }));
  adminAvailability[1] = { available: false, startTime: '09:00', endTime: '17:00' };
  const updated = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({
      name: employee.name,
      phone: context.phone(10),
      photo: '/assets/team-test-photo.jpg',
      active: employee.active,
      vehicleId: employee.vehicleId,
      role: 'chauffeur',
      authorizedVehicleIds: ['sprinter'],
      availability: adminAvailability,
      address: 'Dakar test',
      latitude: 14.7167,
      longitude: -17.4677,
      geocodedAddress: 'Dakar test, Sénégal',
      tags: ['Test équipe'],
      notes: 'Configuration de test isolée',
      refusals: [{ ref: 'DEM-TEST', at: new Date().toISOString() }],
      clearedRefusals: 1,
    });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.deepEqual(updated.body.authorizedVehicleIds, ['sprinter']);
  assert.deepEqual(updated.body.availability, adminAvailability);
  const persistedByAdmin = await context.db.chauffeur.findUniqueOrThrow({
    where: { id: driverId },
  });
  assert.equal(persistedByAdmin.nom, updated.body.name);
  assert.equal(persistedByAdmin.telephone, updated.body.phone);
  assert.equal(persistedByAdmin.utilisateurId, employee.userId);
  assert.equal(persistedByAdmin.photo, '/assets/team-test-photo.jpg');
  assert.equal(persistedByAdmin.fonction, 'chauffeur');
  assert.equal(persistedByAdmin.adresse, 'Dakar test');
  assert.equal(persistedByAdmin.latitude, 14.7167);
  assert.equal(persistedByAdmin.longitude, -17.4677);
  assert.equal(persistedByAdmin.adresseGeocodee, 'Dakar test, Sénégal');
  assert.deepEqual(persistedByAdmin.disponibilites, adminAvailability);
  assert.deepEqual(persistedByAdmin.vehiculesAutorises, ['sprinter']);
  assert.deepEqual(persistedByAdmin.competences, ['Test équipe']);
  assert.deepEqual(persistedByAdmin.refusMissions, updated.body.refusals);
  assert.equal(persistedByAdmin.refusEffaces, 1);

  const persistedAccount = await context.db.utilisateur.findUniqueOrThrow({
    where: { id: employee.userId },
  });
  assert.equal(persistedAccount.nom, updated.body.name);
  assert.equal(persistedAccount.telephone, updated.body.phone);
  assert.equal(persistedAccount.role, 'chauffeur');
  assert.notEqual(persistedAccount.empreinteMotDePasse, '');
  assert.equal(persistedAccount.photo, updated.body.photo);
  assert.equal(persistedAccount.actif, true);

  const invalidHours = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({
      ...updated.body,
      availability: adminAvailability.map((day) => ({
        ...day,
        startTime: '18:00',
        endTime: '08:00',
      })),
    });
  assert.equal(invalidHours.status, 400);
  assert.deepEqual(
    (await context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).disponibilites,
    adminAvailability,
  );
  const invalidCoordinates = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...updated.body, latitude: 95 });
  assert.equal(invalidCoordinates.status, 400);
  const invalidVehicle = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...updated.body, vehicleId: 'vehicle-not-found' });
  assert.equal(invalidVehicle.status, 400);
  assert.equal(
    (await context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).vehiculeId,
    updated.body.vehicleId,
  );
  assert.equal(
    (
      await admin
        .put('/api/admin/drivers/00000000-0000-4000-8000-000000000000')
        .set(integrationHeader)
        .send(updated.body)
    ).status,
    404,
  );

  const duplicatePhone = await admin.post('/api/admin/drivers').set(integrationHeader).send({
    name: 'Employé dupliqué',
    phone: updated.body.phone,
    photo: null,
    vehicleId: null,
  });
  assert.equal(duplicatePhone.status, 409);
  const invalidVehiclePhone = context.phone(11);
  const invalidVehicleCreation = await admin
    .post('/api/admin/drivers')
    .set(integrationHeader)
    .send({
      name: 'Véhicule absent',
      phone: invalidVehiclePhone,
      photo: null,
      vehicleId: 'vehicle-not-found',
    });
  assert.equal(invalidVehicleCreation.status, 400);
  assert.equal(
    await context.db.utilisateur.count({ where: { telephone: '+221' + invalidVehiclePhone } }),
    0,
  );
  assert.equal(
    await context.db.chauffeur.count({ where: { telephone: '+221' + invalidVehiclePhone } }),
    0,
  );

  let roleUpdate = updated.body;
  for (const role of ['menuisier', 'manoeuvre', 'chauffeur'] as const) {
    const response = await admin
      .put('/api/admin/drivers/' + driverId)
      .set(integrationHeader)
      .send({ ...roleUpdate, role });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.role, role);
    assert.equal(
      (await context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).fonction,
      role,
    );
    roleUpdate = response.body;
  }

  const extraPhone = context.phone(12);
  const extra = await admin
    .post('/api/admin/drivers')
    .set(integrationHeader)
    .send({
      name: 'Chauffeur de test secondaire',
      phone: extraPhone,
      photo: null,
      active: true,
      vehicleId: 'sprinter',
      role: 'chauffeur',
      authorizedVehicleIds: ['sprinter'],
    });
  assert.equal(extra.status, 201, JSON.stringify(extra.body));
  context.testUserIds.push(extra.body.userId as string);
  context.testPhones.push('+221' + extraPhone);
  const [mainAfterCreate, secondaryAfterCreate] = await Promise.all([
    context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } }),
    context.db.chauffeur.findUniqueOrThrow({ where: { id: extra.body.id } }),
  ]);
  assert.equal(mainAfterCreate.vehiculeId, null);
  assert.equal(secondaryAfterCreate.vehiculeId, 'sprinter');
  const duplicateUpdate = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...updated.body, phone: extra.body.phone });
  assert.equal(duplicateUpdate.status, 409);
  assert.equal(
    (await context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).telephone,
    updated.body.phone,
  );
  const mainReassigned = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...updated.body, vehicleId: 'sprinter', active: true });
  assert.equal(mainReassigned.status, 200, JSON.stringify(mainReassigned.body));
  const [mainAfterReassignment, secondaryAfterReassignment] = await Promise.all([
    context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } }),
    context.db.chauffeur.findUniqueOrThrow({ where: { id: extra.body.id } }),
  ]);
  assert.equal(mainAfterReassignment.vehiculeId, 'sprinter');
  assert.equal(secondaryAfterReassignment.vehiculeId, null);

  const [mainConcurrent, secondaryConcurrent] = await Promise.all([
    admin
      .put('/api/admin/drivers/' + driverId)
      .set(integrationHeader)
      .send({ ...mainReassigned.body, vehicleId: 'trafic' }),
    admin
      .put('/api/admin/drivers/' + extra.body.id)
      .set(integrationHeader)
      .send({ ...extra.body, vehicleId: 'trafic' }),
  ]);
  assert.equal(mainConcurrent.status, 200, JSON.stringify(mainConcurrent.body));
  assert.equal(secondaryConcurrent.status, 200, JSON.stringify(secondaryConcurrent.body));
  const [mainAfterConcurrent, secondaryAfterConcurrent] = await Promise.all([
    context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } }),
    context.db.chauffeur.findUniqueOrThrow({ where: { id: extra.body.id } }),
  ]);
  assert.equal(
    [mainAfterConcurrent.vehiculeId, secondaryAfterConcurrent.vehiculeId].filter(
      (vehicleId) => vehicleId === 'trafic',
    ).length,
    1,
    'Deux mises à jour simultanées ne doivent jamais attribuer le même véhicule à deux employés.',
  );
  const mainRestoredVehicle = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...mainConcurrent.body, vehicleId: 'sprinter' });
  assert.equal(mainRestoredVehicle.status, 200, JSON.stringify(mainRestoredVehicle.body));
  const secondaryReleased = await admin
    .put('/api/admin/drivers/' + extra.body.id)
    .set(integrationHeader)
    .send({ ...secondaryConcurrent.body, vehicleId: null });
  assert.equal(secondaryReleased.status, 200, JSON.stringify(secondaryReleased.body));
  assert.equal(
    (await context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } })).vehiculeId,
    'sprinter',
  );
  assert.equal(
    (await context.db.chauffeur.findUniqueOrThrow({ where: { id: extra.body.id } })).vehiculeId,
    null,
  );
  const removedSecondary = await admin
    .delete('/api/admin/drivers/' + extra.body.id)
    .set(integrationHeader)
    .send({});
  assert.equal(removedSecondary.status, 200);
  assert.equal(removedSecondary.body.employee.active, false);
  assert.equal(
    (await context.db.utilisateur.findUniqueOrThrow({ where: { id: extra.body.userId } })).actif,
    false,
  );

  const employeeAvailability = Array.from({ length: 7 }, (_, index) => ({
    available: index < 5,
    startTime: '07:30',
    endTime: '17:30',
  }));
  const savedByEmployee = await driver
    .put('/api/driver/availability')
    .set(integrationHeader)
    .send(employeeAvailability);
  assert.equal(savedByEmployee.status, 200, JSON.stringify(savedByEmployee.body));
  assert.deepEqual(savedByEmployee.body.availability, employeeAvailability);
  const persistedByEmployee = await context.db.chauffeur.findUniqueOrThrow({
    where: { id: driverId },
  });
  assert.deepEqual(persistedByEmployee.disponibilites, employeeAvailability);
  assert.equal(
    (await first.put('/api/driver/availability').set(integrationHeader).send(employeeAvailability))
      .status,
    403,
  );

  const reset = await admin
    .post('/api/admin/drivers/' + driverId + '/password-reset')
    .set(integrationHeader)
    .send({});
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  assert.equal(typeof reset.body.password, 'string');
  assert.notEqual(reset.body.password, initialPassword);
  assert.notEqual(
    (await context.db.utilisateur.findUniqueOrThrow({ where: { id: employee.userId } }))
      .empreinteMotDePasse,
    reset.body.password,
  );
  assert.equal((await driver.get('/api/driver/profile').set(integrationHeader)).status, 401);
  assert.equal(
    (
      await driver
        .post('/api/auth/login')
        .set(integrationHeader)
        .send({ phone: updated.body.phone, password: initialPassword })
    ).status,
    401,
  );
  const renewed = await driver
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: updated.body.phone, password: reset.body.password });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.body));
  context.driverPassword = reset.body.password as string;

  const deactivated = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...updated.body, active: false });
  assert.equal(deactivated.status, 200, JSON.stringify(deactivated.body));
  const [inactiveDriver, inactiveAccount, sessions] = await Promise.all([
    context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } }),
    context.db.utilisateur.findUniqueOrThrow({ where: { id: employee.userId } }),
    context.db.sessionConnexion.count({ where: { utilisateurId: employee.userId } }),
  ]);
  assert.equal(inactiveDriver.actif, false);
  assert.equal(inactiveAccount.actif, false);
  assert.equal(sessions, 0);
  assert.equal((await driver.get('/api/driver/profile').set(integrationHeader)).status, 401);
  assert.equal(
    (
      await driver
        .post('/api/auth/login')
        .set(integrationHeader)
        .send({ phone: updated.body.phone, password: reset.body.password })
    ).status,
    401,
  );

  const reactivated = await admin
    .put('/api/admin/drivers/' + driverId)
    .set(integrationHeader)
    .send({ ...deactivated.body, active: true });
  assert.equal(reactivated.status, 200, JSON.stringify(reactivated.body));
  const [activeDriver, activeAccount] = await Promise.all([
    context.db.chauffeur.findUniqueOrThrow({ where: { id: driverId } }),
    context.db.utilisateur.findUniqueOrThrow({ where: { id: employee.userId } }),
  ]);
  assert.equal(activeDriver.actif, true);
  assert.equal(activeAccount.actif, true);
  assert.equal(
    (
      await driver
        .post('/api/auth/login')
        .set(integrationHeader)
        .send({ phone: reactivated.body.phone, password: reset.body.password })
    ).status,
    200,
  );
}
