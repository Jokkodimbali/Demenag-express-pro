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
  throw new Error('Les tests Client/Employé doivent viser la branche Neon isolée.');
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL doit viser la branche Neon isolée.');

const baseUrl = process.env.BROWSER_BASE_URL || 'http://localhost:5177';
const output = fileURLToPath(new URL('../../.verification/', import.meta.url));
const photoPath = fileURLToPath(new URL('../public/assets/sprinter-profil.png', import.meta.url));
mkdirSync(output, { recursive: true });
const data = createIntegrationContext(process.env.TEST_DATABASE_URL);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const errors = [];
const routeIds = [];
let testBookingId = '';
let testUserIds = [];
let scenarioPrefix = '';

function futureDay(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(date);
}

async function login(page, phone, password, target) {
  await page.goto(`${baseUrl}/connexion`);
  await expect(page.locator('#auth-registration-role')).toHaveCount(0);
  await page.getByLabel('Téléphone ou email administrateur').fill(phone);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${target.replaceAll('/', '\\/')}$`), {
    timeout: 20000,
  });
}

async function assertNoHorizontalOverflow(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}

try {
  const users = await registerScenarioUsers(data);
  testUserIds = users.userIds;
  scenarioPrefix = data.prefix;
  console.log('Préparation des comptes client/employé terminée.');
  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status).toBe(200);

  const routeResponse = await data.clients.first
    .post('/api/maps/route')
    .set(integrationHeader)
    .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
  expect(routeResponse.status, JSON.stringify(routeResponse.body)).toBe(200);
  routeIds.push(routeResponse.body.id);

  const input = createBookingInput(data, routeResponse.body.id);
  input.date = futureDay(3);
  input.customerName = `${data.prefix} Client`;
  input.customerPhone = data.phone(0);
  input.fromAddress = 'Ouakam Dakar';
  input.toAddress = 'Almadies Dakar';
  input.requestId = crypto.randomUUID();
  const created = await data.clients.first.post('/api/bookings').set(integrationHeader).send(input);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  testBookingId = created.body.id;
  const storedBooking = await data.db.reservation.findUniqueOrThrow({
    where: { id: testBookingId },
  });
  await data.db.reservation.update({
    where: { id: testBookingId },
    data: {
      chauffeurId: users.driverId,
      version: storedBooking.version + 1,
      donnees: {
        ...storedBooking.donnees,
        driverId: users.driverId,
        version: storedBooking.version + 1,
      },
    },
  });
  console.log('Réservation créée et affectée au compte chauffeur de test.');

  const clientContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await clientContext.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), origin: baseUrl } }),
  );
  const clientPage = await clientContext.newPage();
  clientPage.on('pageerror', (error) => errors.push(`client: ${error.message}`));
  await login(clientPage, data.phone(0), integrationPassword, '/mon-espace');
  console.log('Connexion client et redirection validées.');
  const clientSpace = clientPage.locator('.reference-client');
  await expect(clientSpace).toBeVisible();
  await clientPage.goto(`${baseUrl}/chauffeur`);
  await expect(clientPage).toHaveURL(/\/mon-espace$/u);
  await expect(clientSpace).toBeVisible();
  await expect(clientSpace.getByRole('heading', { name: /mes déménagements/i })).toBeVisible();
  await expect(clientSpace.locator('.reference-client-profile')).toContainText(`${data.prefix} 0`);
  const clientCard = clientSpace
    .locator('.reference-client-card')
    .filter({ hasText: created.body.reference });
  await expect(clientCard).toBeVisible();
  await expect(clientCard.locator('.reference-client-map')).toBeVisible();
  await expect(clientCard.locator('.booking-route-map .booking-route-pin-host')).toHaveCount(2, {
    timeout: 20000,
  });
  await expect
    .poll(() => clientCard.locator('.booking-route-map .leaflet-overlay-pane path').count())
    .toBeGreaterThan(0);
  await expect(clientCard.getByRole('link', { name: /ouvrir dans google maps/i })).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir/u,
  );
  await expect(clientCard.getByRole('link', { name: /rappel/i })).toHaveCount(0);
  const clientReminder = await data.clients.first
    .post(`/api/bookings/${testBookingId}/reminders`)
    .set(integrationHeader);
  expect(clientReminder.status).toBe(403);
  const adminReminder = await data.clients.admin
    .post(`/api/bookings/${testBookingId}/reminders`)
    .set(integrationHeader);
  expect(adminReminder.status, JSON.stringify(adminReminder.body)).toBe(200);
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      return row.donnees.reminders?.length ?? 0;
    })
    .toBe(1);

  const downloadProvisional = clientPage.waitForEvent('download');
  await clientCard.getByRole('button', { name: /télécharger le devis provisoire/i }).click();
  const provisional = await downloadProvisional;
  expect(provisional.suggestedFilename()).toMatch(/provisoire.*\.pdf$/iu);
  await provisional.saveAs(`${output}espace-client-provisoire.pdf`);
  console.log('PDF provisoire client généré.');
  await clientPage.screenshot({ path: `${output}client-desktop.png`, fullPage: true });

  await clientCard.getByRole('link', { name: /modifier ma demande/i }).click();
  await expect(clientPage).toHaveURL(/\/reservation\?modifier=/u);
  await expect(clientPage.locator('#admin-quote-form')).toBeVisible();
  await clientPage.goto(`${baseUrl}/mon-espace`);
  await expect(clientPage.locator('.reference-client-card')).toHaveCount(1);
  await assertNoHorizontalOverflow(clientPage, 390);
  await clientPage.screenshot({ path: `${output}client-mobile-390.png`, fullPage: true });
  await assertNoHorizontalOverflow(clientPage, 320);
  await clientPage.screenshot({ path: `${output}client-mobile-320.png`, fullPage: true });

  const clientForbidden = await data.clients.first.get('/api/bookings').set(integrationHeader);
  expect(clientForbidden.status).toBe(200);
  const otherClientRead = await data.clients.second
    .get(`/api/bookings/${testBookingId}`)
    .set(integrationHeader);
  expect(otherClientRead.status).toBe(404);
  const adminForbidden = await data.clients.first.get('/api/admin/drivers').set(integrationHeader);
  expect(adminForbidden.status).toBe(403);

  const driverContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await driverContext.grantPermissions(['camera'], { origin: baseUrl });
  await driverContext.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), origin: baseUrl } }),
  );
  const driverPage = await driverContext.newPage();
  driverPage.on('pageerror', (error) => errors.push(`employé: ${error.message}`));
  await login(driverPage, data.phone(3), users.initialDriverPassword, '/chauffeur');
  console.log('Connexion employé et redirection validées.');
  await driverPage.goto(`${baseUrl}/mon-espace`);
  await expect(driverPage).toHaveURL(/\/chauffeur$/u);
  const employeeSpace = driverPage.locator('.reference-employee');
  await expect(employeeSpace).toBeVisible();
  await expect(employeeSpace).toContainText('CHAUFFEUR');
  await expect(employeeSpace.getByRole('heading', { name: /mes disponibilités/i })).toBeVisible();
  const mission = employeeSpace
    .locator('.employee-mission')
    .filter({ hasText: created.body.reference });
  await expect(mission).toBeVisible();
  await expect(mission).toContainText('Ouakam Dakar');
  await expect(mission).toContainText('Almadies Dakar');
  const tuesdayAvailability = employeeSpace.locator('.employee-day').filter({ hasText: 'Mar' });
  const availabilitySaved = driverPage.waitForResponse(
    (response) =>
      response.url().endsWith('/api/driver/availability') && response.request().method() === 'PUT',
  );
  await tuesdayAvailability.getByRole('button', { name: 'Disponible' }).click();
  await expect(tuesdayAvailability.getByRole('button', { name: 'Repos' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const availabilityResponse = await availabilitySaved;
  expect(availabilityResponse.status()).toBe(200);
  expect((await availabilityResponse.json()).availability[1].available).toBe(false);
  await expect
    .poll(async () => {
      const row = await data.db.chauffeur.findUniqueOrThrow({ where: { id: users.driverId } });
      return Array.isArray(row.disponibilites) ? row.disponibilites[1]?.available : undefined;
    })
    .toBe(false);
  console.log('Disponibilités persistées en base.');
  await tuesdayAvailability.getByRole('button', { name: 'Repos' }).click();

  const proofInputs = mission.locator('input[type="file"]');
  await proofInputs.nth(0).setInputFiles([photoPath, photoPath]);
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      return (row.donnees.employeeProofs ?? []).length;
    })
    .toBe(2);
  await proofInputs.nth(1).setInputFiles(photoPath);
  await expect
    .poll(async () => {
      const row = await data.db.reservation.findUniqueOrThrow({ where: { id: testBookingId } });
      return (row.donnees.employeeProofs ?? []).length;
    })
    .toBe(3);
  await expect(employeeSpace.locator('.employee-table-scroll tbody tr')).toHaveCount(3);
  await employeeSpace.locator('.employee-thumbnail').first().click();
  await expect(driverPage.getByRole('dialog')).toBeVisible();
  await driverPage
    .getByRole('button', { name: /fermer/i })
    .last()
    .click();

  const inspection = employeeSpace.locator('.employee-panel').filter({
    has: driverPage.getByRole('heading', { name: /contrôle technique du véhicule/i }),
  });
  await expect(inspection).toBeVisible();
  const checks = inspection.locator('.employee-check');
  await expect(checks).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await checks.nth(index).locator('input[type="file"]').first().setInputFiles(photoPath);
    await checks.nth(index).getByRole('button', { name: 'Bon', exact: true }).click();
  }
  await inspection.getByRole('button', { name: /enregistrer le contrôle/i }).click();
  await expect(inspection.getByRole('table')).toBeVisible({ timeout: 20000 });
  console.log('Contrôle technique employé enregistré.');
  await expect
    .poll(async () => {
      const response = await data.clients.driver
        .get('/api/driver/vehicle-inspections')
        .set(integrationHeader);
      return response.body.inspections?.length ?? 0;
    })
    .toBeGreaterThan(0);

  const forbiddenEmployeePage = await driverPage.evaluate(
    async () => (await fetch('/api/admin/drivers')).status,
  );
  expect(forbiddenEmployeePage).toBe(403);
  const forbiddenEmployeePhoto = await driverPage.evaluate(async () => {
    const response = await fetch('/api/driver/profile/photo', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'X-Requested-With': 'DemenagExpress',
      },
      body: JSON.stringify({ photo: 'not-an-image' }),
    });
    return response.status;
  });
  expect(forbiddenEmployeePhoto).toBe(400);

  await driverPage.goto(`${baseUrl}/chauffeur/profil`);
  await driverPage.evaluate(() => window.scrollTo(0, 0));
  const profile = driverPage.locator('.driver-profile-page');
  await expect(profile).toBeVisible();
  const driverHeaderBottom = await driverPage
    .locator('.reference-header')
    .evaluate((header) => header.getBoundingClientRect().bottom);
  const driverHeadingTop = await profile
    .locator('.section-heading')
    .evaluate((heading) => heading.getBoundingClientRect().top);
  expect(driverHeadingTop).toBeGreaterThanOrEqual(driverHeaderBottom);
  await expect(profile.getByRole('link', { name: /retour aux missions/i })).toHaveAttribute(
    'href',
    '/chauffeur',
  );
  await expect(profile.locator('#driver-profile-name')).toHaveAttribute('readonly', '');
  await expect(profile.locator('#driver-profile-phone')).toHaveAttribute('readonly', '');
  await expect(profile.getByRole('button', { name: 'Activer la caméra' })).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Importer une photo' })).toBeVisible();
  await profile.getByRole('button', { name: 'Activer la caméra' }).click();
  const cameraDialog = driverPage.getByRole('dialog', { name: /prendre une photo/i });
  await expect(cameraDialog).toBeVisible();
  await expect
    .poll(() => cameraDialog.locator('video').evaluate((video) => video.videoWidth))
    .toBeGreaterThan(0);
  await cameraDialog.getByRole('button', { name: /capturer la photo/i }).click();
  await expect(profile.locator('.report-photo-previews img')).toHaveCount(1);
  await profile.getByRole('button', { name: 'Retirer la photo 1' }).click();
  await profile.locator('.report-photo-picker input[type="file"]').first().setInputFiles(photoPath);
  await profile.getByRole('button', { name: /enregistrer la photo/i }).click();
  await expect(
    profile.getByRole('status').filter({ hasText: /photo de profil mise à jour/i }),
  ).toBeVisible({
    timeout: 20000,
  });
  const savedDriver = await data.db.chauffeur.findUniqueOrThrow({ where: { id: users.driverId } });
  expect(savedDriver.photo).toMatch(/^data:image\/(?:png|webp);base64,/u);
  await expect(profile.getByRole('heading', { name: /modifier mon mot de passe/i })).toBeVisible();
  const currentPassword = profile.locator('#password-current');
  const nextPassword = profile.locator('#password-next');
  const nextEmployeePassword = 'New-Employee-Test-2026!';
  await currentPassword.fill(users.initialDriverPassword);
  await nextPassword.fill(nextEmployeePassword);
  await profile.getByRole('button', { name: /enregistrer le nouveau mot de passe/i }).click();
  await expect(
    profile.getByRole('status').filter({ hasText: /mot de passe modifié/i }),
  ).toBeVisible();
  await profile
    .getByRole('button', { name: /afficher le mot de passe/i })
    .first()
    .click();
  await expect(currentPassword).toHaveAttribute('type', 'text');
  await expect(nextPassword).toHaveAttribute('type', 'text');
  console.log('Profil employé, photo et changement de mot de passe validés.');
  await driverPage.setViewportSize({ width: 1440, height: 1400 });
  await driverPage.evaluate(() => window.scrollTo(0, 0));
  await driverPage.screenshot({ path: `${output}employee-profile-desktop.png` });

  await driverPage.locator('.account-menu summary').click();
  await expect(driverPage.locator('.account-dropdown')).toContainText(/employé/i);
  await expect(
    driverPage.locator('.account-dropdown').getByRole('link', { name: /mon profil/i }),
  ).toBeVisible();
  await driverPage
    .locator('.account-dropdown')
    .getByRole('button', { name: /déconnexion/i })
    .click();
  await expect(driverPage).toHaveURL(`${baseUrl}/connexion`);
  await login(driverPage, data.phone(3), nextEmployeePassword, '/chauffeur');

  const latestBooking = await data.clients.admin.get(`/api/bookings/${testBookingId}`);
  expect(latestBooking.status).toBe(200);
  const finalQuote = await data.clients.admin
    .post(`/api/bookings/${testBookingId}/quotes`)
    .set(integrationHeader)
    .send({
      kind: 'final',
      trips: 1,
      customPrice: null,
      discount: 0,
      notes: 'Devis final scénario espace client.',
      extraLines: [],
      tolls: [],
      version: latestBooking.body.version,
    });
  expect(finalQuote.status, JSON.stringify(finalQuote.body)).toBe(201);
  console.log('Devis final de la réservation créé.');
  await clientPage.setViewportSize({ width: 1440, height: 1000 });
  await clientPage.goto(`${baseUrl}/mon-espace`);
  const completedClientCard = clientPage
    .locator('.reference-client-card')
    .filter({ hasText: created.body.reference });
  await expect(completedClientCard.locator('.reference-client-final')).toBeVisible();
  await expect(completedClientCard).toContainText(/devis final/i);
  await expect(completedClientCard.locator('.reference-client-final-heading')).toContainText(
    /FCFA/u,
  );
  const downloadFinal = clientPage.waitForEvent('download');
  await completedClientCard.getByRole('button', { name: /télécharger le devis final/i }).click();
  const finalPdf = await downloadFinal;
  expect(finalPdf.suggestedFilename()).toMatch(/final.*\.pdf$/iu);
  await finalPdf.saveAs(`${output}espace-client-final.pdf`);
  const savedQuotes = await data.db.devis.findMany({
    where: { reservationId: testBookingId },
    select: { id: true },
  });
  if (savedQuotes.length)
    await data.db.ecritureComptable.deleteMany({
      where: { sourceDevisId: { in: savedQuotes.map(({ id }) => id) } },
    });
  await expect(completedClientCard.getByRole('link', { name: /modifier ma demande/i })).toHaveCount(
    0,
  );

  for (const width of [390, 320]) {
    await assertNoHorizontalOverflow(driverPage, width);
    await driverPage.screenshot({ path: `${output}employee-mobile-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  console.log(
    'Espaces client/employé : connexion et redirection par rôle, profil/menu, réservation et accès privé, carte/adresses, lien Maps, édition de demande, devis provisoire/final et deux PDF, absence du rappel réservé à l’administration, missions affectées, disponibilités, preuves retrait/dépôt, zoom photo, contrôle des 5 éléments, historique, photo profil, caméra/import, profil employé en lecture seule, changement/visibilité du mot de passe, accès API refusés et responsive 1440/390/320 vérifiés.',
  );
  await clientContext.close();
  await driverContext.close();
} finally {
  await browser.close();
  await data.db.$disconnect().catch(() => undefined);
  let cleanupError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cleanup = createIntegrationContext(process.env.TEST_DATABASE_URL);
    cleanup.prefix = scenarioPrefix;
    cleanup.testUserIds = testUserIds;
    try {
      if (testBookingId) {
        const quotes = await cleanup.db.devis.findMany({
          where: { reservationId: testBookingId },
          select: { id: true },
        });
        if (quotes.length)
          await cleanup.db.ecritureComptable.deleteMany({
            where: { sourceDevisId: { in: quotes.map(({ id }) => id) } },
          });
      }
      await deleteScenarioData(cleanup, routeIds);
      cleanupError = undefined;
      await cleanup.db.$disconnect();
      break;
    } catch (error) {
      cleanupError = error;
      await cleanup.db.$disconnect().catch(() => undefined);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  if (cleanupError) {
    console.error('Nettoyage du scénario client/employé incomplet :', cleanupError);
    process.exitCode = 1;
  }
}
