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
import { ScryptPasswords } from '../../backend/src/adapters/out/security/crypto.ts';
import { liveBookingPrice } from '../src/application/services/live-booking-price.ts';
import { money } from '../src/domain/format.ts';

if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Ce test de la page Clients doit viser uniquement la branche Neon isolée.');
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
const bookingIds = [];
const customerPhones = new Set();
let testUserIds = [];
let primaryPhone = '';

function normalizePhone(phone) {
  const digits = phone.replace(/\D/gu, '');
  return digits.startsWith('221') && digits.length === 12 ? digits.slice(3) : digits;
}

function dayOffset(offset) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offset);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(day);
}

async function createClientBooking(routeId, name, phone, index) {
  customerPhones.add(normalizePhone(phone));
  const input = createBookingInput(data, routeId);
  input.date = dayOffset(4);
  input.customerName = name;
  input.customerPhone = phone;
  input.fromAddress = `Adresse test ${String(index).padStart(2, '0')}, Dakar`;
  input.toAddress = 'Almadies Dakar';
  input.requestId = crypto.randomUUID();
  const response = await data.clients.first
    .post('/api/bookings')
    .set(integrationHeader)
    .send(input);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  bookingIds.push(response.body.id);
  return response.body;
}

try {
  const users = await registerScenarioUsers(data);
  testUserIds = users.userIds;
  const primaryUserId = users.userIds[0];
  primaryPhone = `+221${data.phone(0)}`;
  customerPhones.add(normalizePhone(primaryPhone));
  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status, JSON.stringify(adminLogin.body)).toBe(200);
  expect((await data.clients.first.get('/api/admin/clients')).status).toBe(403);

  const route = await data.clients.first
    .post('/api/maps/route')
    .set(integrationHeader)
    .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
  expect(route.status, JSON.stringify(route.body)).toBe(200);
  routeIds.push(route.body.id);

  const primaryName = `${data.prefix} Famille Diop — nom complet à afficher sans coupure`;
  const primaryBookings = [];
  primaryBookings.push(await createClientBooking(route.body.id, primaryName, primaryPhone, 0));
  primaryBookings.push(await createClientBooking(route.body.id, primaryName, primaryPhone, 1));
  const cancelledBooking = await createClientBooking(route.body.id, primaryName, primaryPhone, 2);
  const cancelledData = await data.db.reservation.findUniqueOrThrow({
    where: { id: cancelledBooking.id },
  });
  await data.db.reservation.update({
    where: { id: cancelledBooking.id },
    data: {
      statut: 'annulee',
      donnees: { ...cancelledData.donnees, status: 'cancelled' },
    },
  });
  const finalizedData = await data.db.reservation.findUniqueOrThrow({
    where: { id: primaryBookings[1].id },
  });
  await data.db.reservation.update({
    where: { id: primaryBookings[1].id },
    data: {
      statut: 'terminee',
      donnees: { ...finalizedData.donnees, status: 'completed' },
    },
  });

  for (let index = 0; index < 10; index++)
    await createClientBooking(
      route.body.id,
      `${data.prefix} Client test ${String(index + 1).padStart(2, '0')}`,
      `+221${data.phone(20 + index)}`,
      index + 3,
    );

  const resetRequest = await data.clients.first
    .post('/api/auth/password-reset-request')
    .set(integrationHeader)
    .send({ phone: primaryPhone });
  expect(resetRequest.status).toBe(204);
  expect(
    (await data.db.utilisateur.findUniqueOrThrow({ where: { id: primaryUserId } }))
      .demandeReinitialisationMotDePasse,
  ).not.toBeNull();

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
  await adminPage.goto(`${baseUrl}/admin/clients`);
  const clientsPage = adminPage.locator('.reference-clients-page');
  await expect(clientsPage).toBeVisible({ timeout: 20000 });
  const search = clientsPage.locator('.reference-clients-heading input');
  await search.fill(data.prefix);
  const clientRows = () => clientsPage.locator('tbody tr');
  await expect(clientRows()).toHaveCount(10);
  const pagination = clientsPage.locator('.pagination');
  await expect(pagination).toContainText('11');
  await pagination.locator('button').nth(1).click();
  await expect(clientRows()).toHaveCount(1);
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('2');
  await pagination.locator('button').nth(0).click();
  await expect(clientRows()).toHaveCount(10);
  await expect(pagination.locator('[aria-current="page"]')).toHaveText('1');

  await search.fill(primaryPhone.slice(-5));
  await expect(clientRows()).toHaveCount(1);
  const primaryRow = () => clientRows().first();
  await expect(primaryRow()).toHaveCount(1);
  await expect(primaryRow().locator('input.name')).toHaveValue(primaryName);
  await expect(primaryRow().locator('input.name')).toHaveAttribute(
    'size',
    String(primaryName.length),
  );
  await expect(primaryRow().locator('td').nth(3)).toHaveText('2');
  const catalogueResponse = await data.clients.first.get('/api/catalogue');
  expect(catalogueResponse.status).toBe(200);
  const activePrimaryBookings = await data.clients.first.get('/api/bookings');
  expect(activePrimaryBookings.status).toBe(200);
  const primaryRows = activePrimaryBookings.body.filter(
    (booking) =>
      normalizePhone(booking.phone) === normalizePhone(primaryPhone) &&
      booking.status !== 'cancelled',
  );
  expect(primaryRows).toHaveLength(2);
  const expectedTotal = primaryRows.reduce(
    (sum, booking) => sum + liveBookingPrice(booking, catalogueResponse.body).total,
    0,
  );
  const expectedFinal = primaryRows
    .filter((booking) => booking.status === 'completed')
    .reduce((sum, booking) => sum + liveBookingPrice(booking, catalogueResponse.body).total, 0);
  await expect(primaryRow().locator('.reference-client-amount strong')).toHaveText(
    money(expectedTotal),
  );
  await expect(primaryRow().locator('.reference-client-amount span')).toContainText(
    money(expectedFinal),
  );

  const updatedName = `${data.prefix} Famille Diop — nom complet modifié et conservé`;
  const updatedAddress = 'Adresse test mise à jour, résidence complète, Dakar';
  await primaryRow().locator('input.name').fill(updatedName);
  await primaryRow().locator('input.name').press('Tab');
  await expect
    .poll(async () => {
      const saved = await data.db.reservation.findMany({
        where: { utilisateurId: { in: testUserIds } },
        select: { donnees: true },
      });
      return saved.filter((row) => row.donnees.customerName === updatedName).length;
    })
    .toBe(3);
  await expect(primaryRow().locator('input.name')).toHaveValue(updatedName);
  await primaryRow().locator('input.address').fill(updatedAddress);
  await primaryRow().locator('input.address').press('Tab');
  await expect
    .poll(async () =>
      data.db.profilClient.findUnique({
        where: { telephoneNormalise: normalizePhone(primaryPhone) },
      }),
    )
    .toMatchObject({ nom: updatedName, telephone: primaryPhone, adresse: updatedAddress });

  await search.fill('adresse test mise à jour');
  await expect(clientRows()).toHaveCount(1);
  await search.fill(primaryPhone.slice(-5));
  await expect(primaryRow().locator('.reference-client-reset')).toBeVisible();
  await primaryRow().locator('.reference-client-reset').click();
  const resetDialog = adminPage.getByRole('dialog');
  await expect(resetDialog).toBeVisible();
  const newPassword = 'Client-Reset-2026!';
  const passwordInput = resetDialog.locator('#reference-client-new-password');
  await passwordInput.fill('short');
  expect(await passwordInput.evaluate((element) => element.validity.valid)).toBe(false);
  await passwordInput.fill(newPassword);
  await resetDialog.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(resetDialog).toHaveCount(0);
  const persistedUser = await data.db.utilisateur.findUniqueOrThrow({
    where: { id: primaryUserId },
  });
  expect(persistedUser.demandeReinitialisationMotDePasse).toBeNull();
  const passwordHasher = new ScryptPasswords();
  expect(await passwordHasher.verify(newPassword, persistedUser.empreinteMotDePasse)).toBe(true);
  expect(await passwordHasher.verify(integrationPassword, persistedUser.empreinteMotDePasse)).toBe(
    false,
  );

  await search.fill(primaryPhone.slice(-5));
  await expect(primaryRow()).toHaveCount(1);
  await primaryRow().locator('.reference-client-quote').click();
  await expect(adminPage).toHaveURL(/\/admin\/creer-un-devis$/u);
  await expect(adminPage.getByRole('textbox', { name: 'Nom du client' })).toHaveValue(updatedName);
  await expect(adminPage.getByRole('textbox', { name: 'Téléphone' })).toHaveValue(primaryPhone);
  await adminPage.goBack();
  await expect(clientsPage).toBeVisible();

  const hiddenName = `${data.prefix} Client test 10`;
  await search.fill(data.phone(29).slice(-5));
  const hiddenRow = () => clientRows().first();
  await expect(hiddenRow()).toHaveCount(1);
  await expect(hiddenRow().locator('input.name')).toHaveValue(hiddenName);
  const reservationsBeforeHide = await data.db.reservation.count({
    where: { utilisateurId: { in: testUserIds } },
  });
  await hiddenRow()
    .getByRole('button', { name: `Supprimer ${hiddenName}` })
    .click();
  const confirmation = adminPage.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(hiddenName);
  await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(
    await data.db.clientMasque.count({
      where: { telephoneNormalise: normalizePhone(`+221${data.phone(29)}`) },
    }),
  ).toBe(0);
  await hiddenRow()
    .getByRole('button', { name: `Supprimer ${hiddenName}` })
    .click();
  await adminPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Supprimer', exact: true })
    .click();
  await expect(hiddenRow()).toHaveCount(0);
  expect(await data.db.reservation.count({ where: { utilisateurId: { in: testUserIds } } })).toBe(
    reservationsBeforeHide,
  );
  expect(
    await data.db.clientMasque.findUnique({
      where: { telephoneNormalise: normalizePhone(`+221${data.phone(29)}`) },
    }),
  ).not.toBeNull();
  await adminPage.reload();
  await expect(clientsPage).toBeVisible();
  await search.fill(data.prefix);
  await expect(clientRows()).toHaveCount(10);

  await search.fill('aucune correspondance calendrier client');
  await expect(clientsPage.locator('.reference-clients-empty')).toBeVisible();
  await expect(clientRows()).toHaveCount(0);
  await search.clear();
  await adminPage.screenshot({ path: output + 'admin-clients-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await adminPage.setViewportSize({ width, height: 844 });
    await expect(clientsPage).toBeVisible();
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const tableViewport = clientsPage.locator('.reference-client-table-scroll');
    const scrollMetrics = await tableViewport.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
    await tableViewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(tableViewport.locator('thead th').last()).toBeInViewport();
    await tableViewport.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await adminPage.screenshot({
      path: output + `admin-clients-mobile-${width}.png`,
      fullPage: true,
    });
  }

  const clientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await clientContext.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), origin: 'http://localhost:5173' } }),
  );
  const clientPage = await clientContext.newPage();
  clientPage.on('pageerror', (error) => pageErrors.push(error.message));
  await clientPage.goto(`${baseUrl}/connexion`);
  await clientPage.getByLabel('Téléphone ou email administrateur').fill(data.phone(0));
  await clientPage
    .getByLabel(/mot de passe/i)
    .first()
    .fill(newPassword);
  await clientPage.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(clientPage.locator('.reference-client')).toBeVisible({ timeout: 20000 });
  await clientPage.goto(`${baseUrl}/admin/clients`);
  await expect(clientPage).toHaveURL(/\/mon-espace$/u);
  await expect(clientPage.locator('.reference-client')).toBeVisible();
  await clientContext.close();

  expect(pageErrors).toEqual([]);
  console.log(
    'Page Clients admin : recherche nom/téléphone/adresse, pagination, totaux, modification persistée, reset mot de passe, nouveau devis, confirmation/masquage, contrôle de rôle et responsive 390/320 px vérifiés.',
  );
} finally {
  await browser.close();
  const normalizedPhones = [...customerPhones];
  try {
    if (normalizedPhones.length) {
      await data.db.clientMasque.deleteMany({
        where: { telephoneNormalise: { in: normalizedPhones } },
      });
      await data.db.profilClient.deleteMany({
        where: { telephoneNormalise: { in: normalizedPhones } },
      });
    }
    await deleteScenarioData(data, routeIds);
    const leftoverProfiles = normalizedPhones.length
      ? await data.db.profilClient.count({
          where: { telephoneNormalise: { in: normalizedPhones } },
        })
      : 0;
    const leftoverHidden = normalizedPhones.length
      ? await data.db.clientMasque.count({
          where: { telephoneNormalise: { in: normalizedPhones } },
        })
      : 0;
    if (leftoverProfiles || leftoverHidden) {
      console.error(
        `Nettoyage des profils clients incomplet : ${leftoverProfiles} profil(s), ${leftoverHidden} masquage(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        'Nettoyage clients confirmé : profils, masquages, réservations, comptes et itinéraire de test supprimés.',
      );
    }
  } finally {
    await data.db.$disconnect();
  }
}
