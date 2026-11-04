import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createIntegrationContext,
  integrationHeader,
  integrationPassword,
} from '../../backend/tests/integration/context.ts';
import { createBookingInput } from '../../backend/tests/integration/configuration.ts';
import { deleteScenarioData } from '../../backend/tests/integration/cleanup.ts';
import { registerScenarioUsers } from '../../backend/tests/integration/accounts.ts';

if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Le test Contrôles doit viser uniquement la branche Neon isolée.');
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL doit viser la branche Neon isolée.');

const baseUrl = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:5174';
const output = fileURLToPath(new URL('../../.verification/', import.meta.url));
mkdirSync(output, { recursive: true });
const data = createIntegrationContext(process.env.TEST_DATABASE_URL);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await adminContext.route('**/api/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), origin: 'http://localhost:5173' } }),
);
const adminPage = await adminContext.newPage();
const pageErrors = [];
adminPage.on('pageerror', (error) => pageErrors.push(error.message));
const routeIds = [];
const inspectionIds = [];
let testBookingId = '';
let proofIds = [];
const testPhoto = '/assets/sprinter-profil.png';

const inspectionPayload = (index) => ({
  vehicleId: 'sprinter',
  items: {
    engineOil: { image: testPhoto, ok: index !== 0 },
    brakeFluid: { image: testPhoto, ok: true },
    coolant: { image: testPhoto, ok: true },
    washerFluid: { image: testPhoto, ok: true },
    fuel: { image: testPhoto, ok: true },
  },
});

function dayInDakar(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

async function createInspection(index) {
  const response = await data.clients.driver
    .post('/api/driver/vehicle-inspections/employee')
    .set(integrationHeader)
    .send(inspectionPayload(index));
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  inspectionIds.push(response.body.id);
  return response.body;
}

try {
  const users = await registerScenarioUsers(data);
  const driver = await data.db.chauffeur.findUniqueOrThrow({ where: { id: users.driverId } });
  expect(driver.vehiculeId).toBe('sprinter');

  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status, JSON.stringify(adminLogin.body)).toBe(200);
  expect((await data.clients.admin.get('/api/admin/vehicle-reports')).status).toBe(200);
  expect((await data.clients.first.get('/api/admin/vehicle-reports')).status).toBe(403);
  expect(
    (await data.clients.first.patch('/api/admin/vehicle-inspections/not-a-uuid/item')).status,
  ).toBe(403);

  for (let index = 0; index < 12; index++) await createInspection(index);
  const driverReports = await data.clients.driver.get('/api/driver/vehicle-inspections');
  expect(driverReports.status).toBe(200);
  expect(
    driverReports.body.inspections.filter((report) => inspectionIds.includes(report.id)),
  ).toHaveLength(12);
  const incomplete = await data.clients.driver
    .post('/api/driver/vehicle-inspections/employee')
    .set(integrationHeader)
    .send({ vehicleId: 'sprinter', items: {} });
  expect(incomplete.status).toBe(400);
  const inspectionsInDatabase = await data.db.controleVehicule.findMany({
    where: { id: { in: inspectionIds } },
  });
  expect(inspectionsInDatabase).toHaveLength(12);
  expect(inspectionsInDatabase.filter((item) => item.etatVehicule === 'good')).toHaveLength(11);
  expect(inspectionsInDatabase.filter((item) => item.etatVehicule === 'attention')).toHaveLength(1);
  const adminVehicleReports = await data.clients.admin.get('/api/admin/vehicle-reports');
  expect(adminVehicleReports.status, JSON.stringify(adminVehicleReports.body)).toBe(200);
  expect(
    adminVehicleReports.body.inspections.filter((report) => inspectionIds.includes(report.id)),
  ).toHaveLength(12);

  const route = await data.clients.first
    .post('/api/maps/route')
    .set(integrationHeader)
    .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
  expect(route.status, JSON.stringify(route.body)).toBe(200);
  routeIds.push(route.body.id);
  const bookingInput = createBookingInput(data, route.body.id);
  bookingInput.date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(
    new Date(Date.now() + 4 * 86400000),
  );
  bookingInput.requestId = crypto.randomUUID();
  const booking = await data.clients.first
    .post('/api/bookings')
    .set(integrationHeader)
    .send(bookingInput);
  expect(booking.status, JSON.stringify(booking.body)).toBe(201);
  testBookingId = booking.body.id;
  proofIds = Array.from(
    { length: 12 },
    (_, index) => `control-proof-${index}-${crypto.randomUUID()}`,
  );
  const employeeProofs = proofIds.map((id, index) => ({
    id,
    employeeId: driver.id,
    kind: index % 2 === 0 ? 'retrait' : 'depot',
    image: testPhoto,
    createdAt: new Date(Date.now() - index * 60_000).toISOString(),
    note: `Note contrôle ${data.prefix} ${String(index).padStart(2, '0')}`,
  }));
  await data.db.reservation.update({
    where: { id: testBookingId },
    data: { donnees: { ...booking.body, employeeProofs } },
  });
  const persistedBooking = await data.db.reservation.findUniqueOrThrow({
    where: { id: testBookingId },
  });
  expect(persistedBooking.donnees.employeeProofs).toHaveLength(12);

  await adminPage.goto(`${baseUrl}/connexion`);
  await adminPage.getByLabel('Téléphone ou email administrateur').fill(data.phone(2));
  await adminPage
    .getByLabel(/mot de passe/i)
    .first()
    .fill(integrationPassword);
  await adminPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(adminPage.getByRole('table', { name: /réservations/i })).toBeVisible({
    timeout: 20000,
  });
  await adminPage.goto(`${baseUrl}/admin/vehicules/rapports`);
  const controlsPage = adminPage.locator('.reference-controls-page');
  await expect(controlsPage).toBeVisible({ timeout: 20000 });
  const controls = controlsPage.locator('.reference-controls-card').first();
  const controlRows = () => controls.locator('.reference-controls-table tbody tr');
  const controlSearch = controls.getByRole('searchbox', { name: /rechercher un contrôle/i });
  const controlsPagination = controls.locator('.pagination');

  await expect(controls.locator('.reference-controls-table')).toBeVisible({ timeout: 20000 });
  await controlSearch.fill(data.prefix);
  await expect(controls.locator('.reference-controls-table')).toBeVisible({ timeout: 20000 });
  await expect(controlRows()).toHaveCount(10);
  await expect(controlsPagination).toContainText('12');
  await controlsPagination.locator('button').nth(1).click();
  await expect(controlRows()).toHaveCount(2);
  await expect(controlsPagination.locator('[aria-current="page"]')).toHaveText('2');
  await controlsPagination.locator('button').nth(0).click();
  await expect(controlRows()).toHaveCount(10);

  await controlSearch.fill(data.prefix);
  await expect(controlRows()).toHaveCount(10);
  const controlPerson = controls.getByRole('combobox', { name: /filtrer par personne/i });
  await controlPerson.selectOption(users.driverId);
  await expect(controlRows()).toHaveCount(10);
  const controlVehicle = controls.getByRole('combobox', { name: /filtrer par véhicule/i });
  await controlVehicle.selectOption('sprinter');
  await expect(controlRows()).toHaveCount(10);
  const controlDate = controls.getByLabel(/filtrer par date/i);
  await controlDate.fill(dayInDakar(new Date().toISOString()));
  await expect(controlRows()).toHaveCount(10);
  const controlStatus = controls.getByRole('combobox', { name: /filtrer les contrôles/i });
  await controlStatus.selectOption('attention');
  await expect(controlRows()).toHaveCount(1);
  await expect(controlRows().first().locator('.reference-control-status.bad')).toHaveCount(1);
  await controlStatus.selectOption('good');
  await expect(controlRows()).toHaveCount(10);
  await expect(controlsPagination).toContainText('11 résultat(s)');
  await controlSearch.fill('aucun contrôle de test correspondant');
  await expect(controls.locator('.reference-controls-empty')).toBeVisible();
  await expect(controlRows()).toHaveCount(0);
  await controlSearch.fill(data.prefix);
  await controlStatus.selectOption('all');
  await expect(controlRows()).toHaveCount(10);

  const goodFilter = controls.getByRole('combobox', { name: /filtrer les contrôles/i });
  await goodFilter.selectOption('attention');
  const lowStatus = controlRows().first().locator('.reference-control-status').first();
  await lowStatus.click();
  await expect
    .poll(async () => {
      const report = await data.db.controleVehicule.findUnique({
        where: { id: inspectionIds[0] },
      });
      return report?.niveaux.engineOil;
    })
    .toBe('good');
  await expect(controlRows()).toHaveCount(0);
  const updatedCondition = await data.db.controleVehicule.findUniqueOrThrow({
    where: { id: inspectionIds[0] },
  });
  expect(updatedCondition.etatVehicule).toBe('good');

  await goodFilter.selectOption('all');
  const controlsBeforeDelete = await data.db.controleVehicule.count({
    where: { id: { in: inspectionIds } },
  });
  await controlRows().first().getByRole('button', { name: 'Supprimer', exact: true }).click();
  let confirmation = adminPage.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(await data.db.controleVehicule.count({ where: { id: { in: inspectionIds } } })).toBe(
    controlsBeforeDelete,
  );
  await controlRows().first().getByRole('button', { name: 'Supprimer', exact: true }).click();
  confirmation = adminPage.getByRole('dialog');
  await confirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect
    .poll(() => data.db.controleVehicule.count({ where: { id: { in: inspectionIds } } }))
    .toBe(controlsBeforeDelete - 1);

  const proofCard = controlsPage.locator('.reference-proofs-card');
  const proofRows = () => proofCard.locator('.reference-proofs-table tbody tr');
  const proofSearch = proofCard.getByRole('searchbox', { name: /rechercher une preuve/i });
  const proofPagination = proofCard.locator('.pagination');
  const proofFilters = {
    mission: proofCard.getByRole('combobox', { name: /toutes les missions/i }),
    type: proofCard.getByRole('combobox', { name: /filtrer le type/i }),
    date: proofCard.getByLabel(/filtrer par date/i),
    vehicle: proofCard.getByRole('combobox', { name: /filtrer par véhicule/i }),
    person: proofCard.getByRole('combobox', { name: /filtrer par personne/i }),
  };
  await proofFilters.mission.selectOption(testBookingId);
  await expect(proofRows()).toHaveCount(10);
  await expect(proofPagination).toContainText('12');
  await proofPagination.locator('button').nth(1).click();
  await expect(proofRows()).toHaveCount(2);
  await proofPagination.locator('button').nth(0).click();
  await expect(proofRows()).toHaveCount(10);

  await proofSearch.fill(`Note contrôle ${data.prefix} 00`);
  await expect(proofRows()).toHaveCount(1);
  await proofSearch.clear();
  await proofFilters.mission.selectOption(testBookingId);
  await expect(proofRows()).toHaveCount(10);
  await proofFilters.type.selectOption('depot');
  await expect(proofRows()).toHaveCount(6);
  await proofFilters.type.selectOption('retrait');
  await expect(proofRows()).toHaveCount(6);
  await proofFilters.date.fill(dayInDakar(new Date().toISOString()));
  await expect(proofRows()).toHaveCount(6);
  await proofFilters.vehicle.selectOption('sprinter');
  await expect(proofRows()).toHaveCount(6);
  await proofFilters.person.selectOption(users.driverId);
  await expect(proofRows()).toHaveCount(6);
  await proofSearch.fill('aucune preuve de test correspondante');
  await expect(proofCard.locator('.reference-controls-empty')).toBeVisible();
  await expect(proofRows()).toHaveCount(0);
  await proofSearch.clear();
  await proofFilters.mission.selectOption('all');
  await proofFilters.type.selectOption('all');
  await proofFilters.date.fill('');
  await proofFilters.vehicle.selectOption('all');
  await proofFilters.person.selectOption('all');
  await expect(proofRows()).toHaveCount(10);

  const proofRow = () => proofRows().first();
  await proofRow().locator('.reference-proof-kind').click();
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      const proofs = row.donnees.employeeProofs;
      return proofs.find((proof) => proof.id === proofIds[0])?.kind;
    })
    .toBe('depot');
  const updatedNote = `Note modifiée ${data.prefix}`;
  await proofRow().getByRole('textbox', { name: /note/i }).fill(updatedNote);
  await proofRow().getByRole('textbox', { name: /note/i }).press('Tab');
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      return row.donnees.employeeProofs.find((proof) => proof.id === proofIds[0])?.note;
    })
    .toBe(updatedNote);

  const firstProof = proofRow();
  await firstProof.locator('.reference-proof-thumbnail').click();
  const photoDialog = adminPage.getByRole('dialog');
  await expect(photoDialog).toBeVisible();
  await expect(photoDialog.getByRole('img', { name: /photo agrandie/i })).toBeVisible();
  await photoDialog.getByRole('button', { name: /fermer/i }).click();
  await expect(photoDialog).toHaveCount(0);

  const originalProof = await data.db.reservation.findUniqueOrThrow({
    where: { id: testBookingId },
  });
  const imageInput = proofRow().locator('input[type="file"]');
  await imageInput.setInputFiles({
    name: 'preuve.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      const proofs = row.donnees.employeeProofs;
      return proofs.find((proof) => proof.id === proofIds[0])?.image;
    })
    .not.toBe(
      originalProof.donnees.employeeProofs.find((proof) => proof.id === proofIds[0])?.image,
    );

  await proofRow().getByRole('button', { name: 'Supprimer', exact: true }).click();
  confirmation = adminPage.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(
    (await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } })).donnees
      .employeeProofs,
  ).toHaveLength(12);
  await proofRow().getByRole('button', { name: 'Supprimer', exact: true }).click();
  confirmation = adminPage.getByRole('dialog');
  await confirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(proofRows()).toHaveCount(10);
  await expect(proofPagination).toContainText('11');
  await expect
    .poll(async () => {
      const booking = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      return booking.donnees.employeeProofs.length;
    })
    .toBe(11);
  await adminPage.reload();
  await expect(controlsPage).toBeVisible();
  await expect(controlsPage.locator('.reference-controls-table')).toBeVisible({ timeout: 20000 });
  await expect(controlsPage.locator('.reference-proofs-table')).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() =>
      controlsPage
        .locator('.reference-proofs-table tbody img')
        .first()
        .evaluate((image) => (image instanceof HTMLImageElement ? image.naturalWidth : 0)),
    )
    .toBeGreaterThan(0);

  await adminPage.screenshot({ path: output + 'admin-controls-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await adminPage.setViewportSize({ width, height: 844 });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const tableWraps = controlsPage.locator('.reference-controls-table-wrap');
    for (let index = 0; index < (await tableWraps.count()); index++) {
      const table = tableWraps.nth(index);
      const metrics = await table.evaluate((element) => ({
        width: element.clientWidth,
        content: element.scrollWidth,
      }));
      expect(metrics.content).toBeGreaterThanOrEqual(metrics.width);
    }
    await adminPage.screenshot({
      path: output + `admin-controls-mobile-${width}.png`,
      fullPage: true,
    });
  }

  await expect.poll(async () => pageErrors).toEqual([]);
  console.log(
    'Contrôles admin : rôles, création et lecture des contrôles, filtres, pagination, bascule et recalcul d’état, suppressions confirmées, photos de mission (aperçu/type/note/remplacement/suppression), persistance DB et responsive vérifiés.',
  );
} finally {
  await browser.close();
  try {
    await deleteScenarioData(data, routeIds);
    const [remainingInspections, remainingBooking] = await Promise.all([
      inspectionIds.length
        ? data.db.controleVehicule.count({ where: { id: { in: inspectionIds } } })
        : 0,
      testBookingId ? data.db.reservation.count({ where: { id: testBookingId } }) : 0,
    ]);
    if (remainingInspections || remainingBooking) {
      console.error(
        `Nettoyage Contrôles incomplet : ${remainingInspections} contrôle(s), ${remainingBooking} réservation(s) restante(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        'Nettoyage Contrôles confirmé : contrôles, preuves, réservations, comptes et itinéraire de test supprimés.',
      );
    }
  } finally {
    await data.db.$disconnect();
  }
}
