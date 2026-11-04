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
  throw new Error('Ce test calendrier doit viser uniquement la branche Neon isolée dédiée.');
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
const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await browserContext.route('**/api/**', (route) =>
  route.continue({ headers: { ...route.request().headers(), origin: 'http://localhost:5173' } }),
);
const page = await browserContext.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const routeIds = [];
const bookingIds = [];
let testUserIds = [];

function dayOffset(offset) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offset);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Dakar' }).format(day);
}

async function createBooking(routeId, label, slot, steps) {
  const input = createBookingInput(data, routeId);
  input.date = dayOffset(2);
  input.customerName = `${data.prefix} ${label}`;
  input.timeSlot = slot;
  input.workPlan = steps;
  const response = await data.clients.first
    .post('/api/bookings')
    .set(integrationHeader)
    .send(input);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const id = response.body.id;
  bookingIds.push(id);
  return data.db.reservation.findUniqueOrThrow({ where: { id } });
}

function displayedReference(booking) {
  return booking.reference.replace(/^DEM-/u, '');
}

try {
  const users = await registerScenarioUsers(data);
  testUserIds = users.userIds;
  await data.db.utilisateur.update({
    where: { id: users.userIds[2] },
    data: { role: 'administrateur' },
  });
  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status, JSON.stringify(adminLogin.body)).toBe(200);

  const route = await data.clients.first
    .post('/api/maps/route')
    .set(integrationHeader)
    .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
  expect(route.status, JSON.stringify(route.body)).toBe(200);
  routeIds.push(route.body.id);

  const first = await createBooking(route.body.id, 'Calendrier A', '09:00', [
    {
      id: 'calendar-a',
      time: '09:00',
      title: 'Chargement',
      detail: 'Test calendrier',
      minutes: 120,
    },
  ]);
  const overlap = await createBooking(route.body.id, 'Calendrier B', '09:30', [
    {
      id: 'calendar-b',
      time: '09:30',
      title: 'Transport',
      detail: 'Test chevauchement',
      minutes: 90,
    },
  ]);
  const overnight = await createBooking(route.body.id, 'Calendrier Nuit', '23:00', [
    {
      id: 'calendar-night',
      time: '23:00',
      title: 'Livraison tardive',
      detail: 'Test lendemain',
      minutes: 120,
    },
  ]);
  const cancelled = await createBooking(route.body.id, 'Calendrier Annulé', '11:00', []);
  const undated = await createBooking(route.body.id, 'Calendrier Sans date', '14:00', []);
  const tomorrow = dayOffset(2);
  for (const [booking, status, dbStatus] of [
    [first, 'pending', 'en_attente'],
    [overlap, 'completed', 'terminee'],
    [overnight, 'pending', 'en_attente'],
    [cancelled, 'cancelled', 'annulee'],
  ]) {
    const saved = booking.donnees;
    await data.db.reservation.update({
      where: { id: booking.id },
      data: {
        date: new Date(`${tomorrow}T00:00:00.000Z`),
        statut: dbStatus,
        donnees: { ...saved, date: tomorrow, status },
      },
    });
  }
  const undatedData = undated.donnees;
  await data.db.reservation.update({
    where: { id: undated.id },
    data: { date: null, donnees: { ...undatedData, date: null, noDate: true } },
  });

  await page.goto(`${baseUrl}/connexion`);
  await page.getByLabel('Téléphone ou email administrateur').fill(data.phone(2));
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(integrationPassword);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('table', { name: /réservations/i })).toBeVisible({ timeout: 20000 });
  await page.goto(`${baseUrl}/admin/planning`);
  const calendar = page.locator('.reference-calendar-page');
  await expect(calendar).toBeVisible({ timeout: 20000 });
  await expect(
    calendar.locator('.reference-month-booking').filter({ hasText: displayedReference(cancelled) }),
  ).toHaveCount(0);
  await expect(
    calendar.locator('.reference-month-booking').filter({ hasText: displayedReference(first) }),
  ).toHaveCount(1);
  await expect(
    calendar.locator('.reference-month-booking').filter({ hasText: displayedReference(overlap) }),
  ).toHaveCount(1);
  await expect(calendar.locator('.reference-calendar-undated')).toContainText(
    displayedReference(undated),
  );
  await page.screenshot({ path: output + 'calendar-month-desktop.png', fullPage: true });

  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Dakar',
  }).format(new Date(`${tomorrow}T12:00:00Z`));
  const selectedCell = calendar
    .locator(`.reference-month-day[aria-label="${dayLabel}"]`)
    .locator('.reference-month-date');
  await selectedCell.click();
  await expect(calendar.locator('.reference-calendar-selected')).toContainText(
    displayedReference(first),
  );
  await expect(calendar.locator('.reference-calendar-selected')).toContainText(
    displayedReference(overlap),
  );
  await expect(calendar.locator('.reference-calendar-selected')).not.toContainText(
    displayedReference(cancelled),
  );

  await calendar.getByRole('button', { name: 'Jour', exact: true }).click();
  const timedEvents = calendar.locator('.reference-time-event');
  await expect(timedEvents.filter({ hasText: displayedReference(first) })).toHaveCount(1);
  await expect(timedEvents.filter({ hasText: displayedReference(overlap) })).toHaveCount(1);
  await expect(timedEvents.filter({ hasText: displayedReference(cancelled) })).toHaveCount(0);
  const overlapWidths = await Promise.all(
    [displayedReference(first), displayedReference(overlap)].map((reference) =>
      timedEvents
        .filter({ hasText: reference })
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).width)),
    ),
  );
  expect(Math.max(...overlapWidths)).toBeLessThan(200);
  const zoomControls = calendar.locator('.reference-calendar-zoom label');
  const verticalZoom = zoomControls.nth(0);
  for (let index = 0; index < 5; index++) await verticalZoom.locator('button').nth(1).click();
  await expect(verticalZoom).toContainText('286 %');
  await verticalZoom.locator('button').nth(1).click();
  await expect(verticalZoom).toContainText('286 %');
  for (let index = 0; index < 5; index++) await verticalZoom.locator('button').nth(0).click();
  await expect(verticalZoom).toContainText('50 %');
  const horizontalZoom = zoomControls.nth(1);
  for (let index = 0; index < 5; index++) await horizontalZoom.locator('button').nth(1).click();
  await expect(horizontalZoom).toContainText('317 %');
  await page.screenshot({ path: output + 'calendar-day-desktop.png', fullPage: true });

  await calendar.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(calendar.locator('.reference-time-grid-day')).toHaveCount(7);
  await expect(
    calendar.locator('.reference-time-event').filter({ hasText: displayedReference(first) }),
  ).toHaveCount(1);
  await calendar.getByRole('button', { name: 'Jour', exact: true }).click();
  await calendar.getByRole('button', { name: 'Période suivante' }).click();
  await expect(
    calendar.locator('.reference-time-event').filter({ hasText: 'suite de la veille' }),
  ).toHaveCount(1);
  await calendar.getByRole('button', { name: "Aujourd'hui" }).click();
  await expect(calendar.locator('.reference-time-grid-day.selected')).toHaveCount(1);

  await calendar.getByRole('button', { name: 'Mois', exact: true }).click();
  await calendar.getByRole('button', { name: 'Période suivante' }).click();
  await expect(calendar.locator('.reference-calendar-heading strong')).toContainText('Décembre');
  await calendar.getByRole('button', { name: 'Période précédente' }).click();
  await expect(calendar.locator('.reference-calendar-heading strong')).toContainText('Novembre');

  await calendar
    .locator('.reference-calendar-undated button')
    .filter({ hasText: displayedReference(undated) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/creer-un-devis\\?modifier=${undated.id}`));
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 20000 });
  await page.goBack();
  await expect(calendar).toBeVisible();
  await calendar
    .locator('.reference-month-booking')
    .filter({ hasText: displayedReference(first) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/admin/creer-un-devis\\?modifier=${first.id}`));
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 20000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/admin/planning`);
  await expect(page.locator('.reference-calendar-page')).toBeVisible();
  await page.screenshot({ path: output + 'calendar-month-mobile-390.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: output + 'calendar-month-mobile-320.png', fullPage: true });
  expect(pageErrors).toEqual([]);
  console.log(
    'Calendrier navigateur : mois, jour, semaine, annulations, sélection, chevauchement, suite de nuit, navigation, zoom, devis, sans date et responsive 390/320 px vérifiés.',
  );
} finally {
  await browser.close();
  try {
    await deleteScenarioData(data, routeIds);
    const remaining = await data.db.reservation.count({
      where: { utilisateurId: { in: testUserIds } },
    });
    expect(remaining).toBe(0);
    console.log(
      'Nettoyage calendrier confirmé : comptes, réservations et itinéraires de test supprimés.',
    );
  } finally {
    await data.db.$disconnect();
  }
}
