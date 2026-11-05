import { chromium, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createIntegrationContext,
  captureOriginalConfiguration,
  integrationHeader,
} from '../../backend/tests/integration/context.ts';
import { createBookingInput } from '../../backend/tests/integration/configuration.ts';
import {
  deleteScenarioData,
  restoreConfiguration,
} from '../../backend/tests/integration/cleanup.ts';
import { registerScenarioUsers } from '../../backend/tests/integration/accounts.ts';

if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Ce test doit viser la branche Neon planning-follow-up-test uniquement.');
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL doit viser la branche Neon de test.');

const env = dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url)));
const baseUrl = process.env.BROWSER_BASE_URL || 'http://localhost:5173';
const output = fileURLToPath(new URL('../../.verification/', import.meta.url));
mkdirSync(output, { recursive: true });
const data = createIntegrationContext(process.env.TEST_DATABASE_URL);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await browserContext.route('**/api/**', (route) => {
  const headers = { ...route.request().headers(), origin: 'http://localhost:5173' };
  return route.continue({ headers });
});
const page = await browserContext.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const routeIds = [];
let original;
let testUserIds = [];

try {
  original = await captureOriginalConfiguration(data.db);
  const users = await registerScenarioUsers(data);
  testUserIds = users.userIds;
  const route = await data.clients.first
    .post('/api/maps/route')
    .set(integrationHeader)
    .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
  expect(route.status).toBe(200);
  routeIds.push(route.body.id);
  const input = createBookingInput(data, route.body.id);
  input.date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  input.workPlan = Array.from({ length: 5 }, (_, index) => ({
    id: `planning-check-${index + 1}`,
    time: `${String(9 + index).padStart(2, '0')}:00`,
    title: `Étape planning ${index + 1}`,
    detail: `Vérification de l’étape ${index + 1} pour le scénario navigateur.`,
    minutes: 30,
  }));
  const bookingResult = await data.clients.admin
    .post('/api/bookings')
    .set(integrationHeader)
    .send(input);
  expect(bookingResult.status, JSON.stringify(bookingResult.body)).toBe(201);
  const booking = await data.db.reservation.findUniqueOrThrow({
    where: { id: bookingResult.body.id },
  });
  const savedData = booking.donnees;
  const workPlan = savedData.workPlan;
  expect(workPlan.length).toBeGreaterThanOrEqual(3);
  const stepIds = workPlan.map(({ id }) => id);
  const selectedDate = booking.date.toISOString().slice(0, 10);

  await page.goto(`${baseUrl}/connexion`);
  await page.getByLabel('Téléphone ou email administrateur').fill(env.ADMIN_PHONE);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(env.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('table', { name: /réservations/i })).toBeVisible({ timeout: 20000 });
  await page.goto(`${baseUrl}/admin/suivi-planning`);

  const followUp = page.locator('.reference-plan-page');
  await expect(followUp).toBeVisible({ timeout: 15000 });
  const dateFilter = followUp.getByLabel('Date du suivi');
  const bookingCard = () =>
    page.locator('.reference-plan-card').filter({ hasText: booking.reference });
  const rows = () => bookingCard().locator('.reference-plan-row');
  const savedReview = async (index) => {
    const current = await data.db.reservation.findUniqueOrThrow({ where: { id: booking.id } });
    return current.donnees.workPlan?.find(({ id }) => id === stepIds[index])?.review;
  };

  await followUp.getByRole('button', { name: 'Jour', exact: true }).click();
  await dateFilter.fill(selectedDate);
  await expect(bookingCard()).toHaveCount(1, { timeout: 15000 });
  await followUp.getByRole('button', { name: 'Période précédente' }).click();
  await expect(bookingCard()).toHaveCount(0);
  await followUp.getByRole('button', { name: 'Période suivante' }).click();
  await expect(bookingCard()).toHaveCount(1);
  await followUp.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(bookingCard()).toHaveCount(1);
  await followUp.getByRole('button', { name: 'Période précédente' }).click();
  await expect(bookingCard()).toHaveCount(0);
  await followUp.getByRole('button', { name: 'Période suivante' }).click();
  await expect(bookingCard()).toHaveCount(1);
  await followUp.getByRole('button', { name: 'Mois', exact: true }).click();
  await expect(bookingCard()).toHaveCount(1);
  await followUp.getByRole('button', { name: 'Période précédente' }).click();
  await expect(bookingCard()).toHaveCount(0);
  await followUp.getByRole('button', { name: 'Période suivante' }).click();
  await expect(bookingCard()).toHaveCount(1);
  await followUp.getByRole('button', { name: 'Jour', exact: true }).click();
  await followUp.getByRole('button', { name: 'Aujourd’hui' }).click();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  await expect(dateFilter).toHaveValue(today);
  await expect(bookingCard()).toHaveCount(0);
  await dateFilter.fill(selectedDate);
  await expect(bookingCard()).toHaveCount(1);

  await bookingCard().locator('.reference-plan-card-head').click();
  await expect(rows()).toHaveCount(stepIds.length);
  await bookingCard().locator('.reference-plan-card-head').click();
  await expect(rows()).toHaveCount(0);
  await bookingCard().locator('.reference-plan-card-head').click();
  await expect(rows()).toHaveCount(stepIds.length);
  await rows().nth(0).getByRole('button', { name: 'Respecté', exact: true }).click();
  await expect.poll(async () => (await savedReview(0))?.status).toBe('respected');
  await rows().nth(0).locator('input[type="time"]').fill('09:32');
  await expect.poll(async () => (await savedReview(0))?.actualTime).toBe('09:32');

  const secondStep = rows().nth(1);
  await secondStep.getByRole('button', { name: 'En retard', exact: true }).click();
  await expect.poll(async () => (await savedReview(1))?.status).toBe('late');
  await expect(secondStep.locator('.reference-plan-missing')).toBeVisible();
  await secondStep
    .locator('.reference-plan-proof textarea')
    .fill('Embouteillage constaté sur le trajet.');
  await expect
    .poll(async () => (await savedReview(1))?.reason)
    .toBe('Embouteillage constaté sur le trajet.');
  await secondStep.getByRole('button', { name: 'Circulation', exact: true }).click();
  await expect.poll(async () => (await savedReview(1))?.cause).toBe('Circulation');
  await secondStep.getByRole('button', { name: 'Majeure', exact: true }).click();
  await expect.poll(async () => (await savedReview(1))?.severity).toBe('maj');
  await secondStep
    .locator('.reference-plan-cause-fields textarea')
    .fill('Prévoir un départ avec marge de circulation.');
  await expect
    .poll(async () => (await savedReview(1))?.correctiveAction)
    .toBe('Prévoir un départ avec marge de circulation.');
  await expect(secondStep.locator('[role="alert"]')).toHaveCount(0);
  await secondStep.getByRole('button', { name: 'En retard', exact: true }).click();
  await expect.poll(async () => (await savedReview(1))?.status).toBe('pending');
  await expect
    .poll(async () => (await savedReview(1))?.reason)
    .toBe('Embouteillage constaté sur le trajet.');
  await secondStep.getByRole('button', { name: 'En retard', exact: true }).click();
  await expect.poll(async () => (await savedReview(1))?.status).toBe('late');

  const thirdStep = rows().nth(2);
  await thirdStep.getByRole('button', { name: 'Non respecté', exact: true }).click();
  await thirdStep.locator('.reference-plan-proof textarea').fill('Accès indisponible à l’arrivée.');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const drawing = canvas.getContext('2d');
    if (!drawing) throw new Error('Canvas de preuve indisponible.');
    drawing.fillStyle = '#e5b700';
    drawing.fillRect(0, 0, 4, 4);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await thirdStep.locator('.reference-plan-photo input[type="file"]').setInputFiles({
    name: 'preuve-planning.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(thirdStep.locator('.reference-plan-thumbnail img')).toBeVisible();
  await expect
    .poll(async () => (await savedReview(2))?.photo)
    .toMatch(/^data:image\/jpeg;base64,/u);
  await thirdStep.getByRole('button', { name: 'Client', exact: true }).click();
  await expect.poll(async () => (await savedReview(2))?.cause).toBe('Client');
  await thirdStep.getByRole('button', { name: 'Critique', exact: true }).click();
  await expect.poll(async () => (await savedReview(2))?.severity).toBe('cri');
  await thirdStep
    .locator('.reference-plan-cause-fields textarea')
    .fill('Confirmer les conditions d’accès avant le départ.');
  await expect
    .poll(async () => (await savedReview(2))?.correctiveAction)
    .toBe('Confirmer les conditions d’accès avant le départ.');
  await thirdStep.getByRole('button', { name: 'Non respecté', exact: true }).click();
  await expect.poll(async () => (await savedReview(2))?.status).toBe('pending');
  await expect
    .poll(async () => (await savedReview(2))?.reason)
    .toBe('Accès indisponible à l’arrivée.');
  await thirdStep.getByRole('button', { name: 'Non respecté', exact: true }).click();
  await expect.poll(async () => (await savedReview(2))?.status).toBe('not_respected');
  for (const index of stepIds.keys()) {
    if (index < 3) continue;
    await rows().nth(index).getByRole('button', { name: 'Respecté', exact: true }).click();
    await expect.poll(async () => (await savedReview(index))?.status).toBe('respected');
  }
  const persisted = await data.db.reservation.findUniqueOrThrow({ where: { id: booking.id } });
  expect(persisted.donnees.workPlan.map(({ review }) => review.status)).toEqual(
    stepIds.map((_, index) =>
      index === 0 || index > 2 ? 'respected' : index === 1 ? 'late' : 'not_respected',
    ),
  );

  await thirdStep.locator('.reference-plan-thumbnail img').click();
  const lightbox = followUp.getByRole('dialog', { name: 'Justificatif photographique' });
  await expect(lightbox).toBeVisible();
  await lightbox.getByRole('button', { name: '+' }).click();
  await expect(lightbox).toContainText('150 %');
  await lightbox.getByRole('button', { name: '−' }).click();
  await expect(lightbox).toContainText('100 %');
  await lightbox.getByRole('button', { name: 'Fermer' }).click();
  await expect(lightbox).toHaveCount(0);
  await thirdStep.locator('button[title="Retirer la photo"]').click();
  await expect.poll(async () => (await savedReview(2))?.photo).toBe('');
  await expect(thirdStep.locator('.reference-plan-photo input[type="file"]')).toBeAttached();
  await thirdStep.locator('.reference-plan-photo input[type="file"]').setInputFiles({
    name: 'preuve-planning.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect
    .poll(async () => (await savedReview(2))?.photo)
    .toMatch(/^data:image\/jpeg;base64,/u);

  const report = followUp.locator('.reference-plan-report');
  await report.locator('.reference-plan-report-head').click();
  await expect(report.locator('.reference-plan-report-body')).toBeVisible();
  await expect(
    report.locator('.reference-plan-nc').filter({ hasText: booking.reference }),
  ).toHaveCount(2);
  await report.getByRole('button', { name: 'Analyser avec l’IA' }).click();
  await expect(report.locator('.reference-plan-ai p')).toContainText(
    'Analyse automatique simplifiée',
    { timeout: 10000 },
  );
  await report.locator('.reference-plan-report-head').click();
  await expect(report.locator('.reference-plan-report-body')).toHaveCount(0);
  await report.locator('.reference-plan-report-head').click();
  await expect(report.locator('.reference-plan-report-body')).toBeVisible();
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await report.getByRole('button', { name: /Télécharger le rapport QHSE/i }).click();
  await (await downloadPromise).saveAs(output + 'rapport-qhse-planning.pdf');
  if (statSync(output + 'rapport-qhse-planning.pdf').size < 1000)
    throw new Error('Le rapport PDF est vide ou incomplet.');
  await page.screenshot({ path: output + 'admin-planning-follow-up-reviewed.png', fullPage: true });

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const sizes = await page.evaluate(() => ({
      viewport: innerWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(sizes.page, `Débordement horizontal à ${width}px`).toBeLessThanOrEqual(sizes.viewport);
    await page.screenshot({
      path: output + `admin-planning-follow-up-${width}.png`,
      fullPage: true,
    });
  }
  expect(pageErrors).toEqual([]);
  console.log(
    'Suivi planning navigateur : filtres, statuts, champs QHSE, photo, zoom, rapport et PDF, responsive 1440/390/320 validés.',
  );
} finally {
  try {
    if (testUserIds.length) data.testUserIds.push(...testUserIds);
    await deleteScenarioData(data, routeIds);
    if (original) await restoreConfiguration(data, original);
  } finally {
    await browser.close();
    await data.db.$disconnect();
  }
}
