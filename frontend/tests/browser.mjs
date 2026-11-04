import { chromium, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPrisma } from '../../backend/src/adapters/out/prisma/client.ts';
const env = dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url)));
const db = createPrisma(process.env.TEST_DATABASE_URL || env.DATABASE_URL);
const baseUrl = process.env.BROWSER_BASE_URL || 'http://localhost:5173';
const apiUrl = process.env.BROWSER_API_URL || process.env.VITE_API_URL || `${baseUrl}/api`;
const output = fileURLToPath(new URL('../../.verification/', import.meta.url));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const horizontalOverflow = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', async (response) => {
  if (/\/api\/auth\/(?:register|me)(?:\?|$)/.test(response.url())) {
    const body = await response.json().catch(() => null);
    console.log(`Auth ${response.url().split('/').at(-1)}: HTTP ${response.status()}`, {
      userReturned: Boolean(body?.id),
    });
  }
});
const phone = '78' + String(Math.floor(Math.random() * 8000000) + 1000000);
const name = 'Test navigateur ' + randomUUID().slice(0, 8);
const password = 'Browser-test-2026!';
let userId;
const tickets = [];
page.on('response', async (response) => {
  if (response.url().endsWith('/api/maps/route') && response.ok()) {
    const data = await response.json().catch(() => null);
    if (data?.id) tickets.push(data.id);
  }
});
try {
  await page.goto(baseUrl + '/');
  await expect(page.getByRole('heading', { name: 'RÉSERVER', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: output + 'desktop-home.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: output + `mobile-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByRole('button', { name: 'Continuer ma réservation' }).click();
  await page.getByRole('button', { name: /TRAJET · CARTE/ }).click();
  await page.getByLabel('Nom du client').fill(name);
  await page.getByLabel('Téléphone').fill(phone);
  await page
    .getByLabel('Date prévue')
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page.getByLabel('Début').fill('09:30');
  const map = page.locator('.leaflet-container');
  await map.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0);
  const mapBounds = await map.boundingBox();
  if (!mapBounds) throw new Error('Carte invisible');
  const center = { x: mapBounds.width / 2, y: mapBounds.height / 2 };
  await map.click({ position: center });
  await page.waitForTimeout(500);
  const routeResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/maps/route') && response.ok(),
  );
  await map.click({ position: { x: center.x + 80, y: center.y - 60 } });
  await routeResponse;
  await expect(
    page.getByRole('spinbutton', { name: 'Distance du trajet en kilomètres' }),
  ).toHaveValue(/\d/);
  await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeEnabled({
    timeout: 25000,
  });
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Nom complet').fill(name);
  await page.getByLabel(/téléphone/i).fill(phone);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(password);
  await page.getByLabel(/confirmez le mot de passe/i).fill(password);
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeEnabled({
    timeout: 15000,
  });
  const authenticatedUser = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/auth/me`, { credentials: 'include' });
    if (!response.ok) throw new Error(`Session client absente : ${response.status}`);
    return response.json();
  }, apiUrl);
  if (!authenticatedUser?.id) {
    const cookieNames = (await context.cookies(baseUrl)).map(({ name, path, sameSite }) => ({
      name,
      path,
      sameSite,
    }));
    throw new Error(
      `Session absente après l’inscription. Cookies présents : ${JSON.stringify(cookieNames)}`,
    );
  }
  userId = authenticatedUser.id;
  if (!(await db.utilisateur.findUnique({ where: { id: userId } })))
    throw new Error('Le compte connecté doit être présent dans la base de test.');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByRole('region', { name: 'Demande envoyée' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('link', { name: 'Voir mon espace client' }).click();
  await page.reload();
  await expect(page.locator('.reference-client-card')).toHaveCount(1, { timeout: 15000 });
  const booking = await db.reservation.findFirstOrThrow({ where: { utilisateurId: userId } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le devis provisoire (PDF)' }).click();
  const download = await downloadPromise;
  await download.saveAs(output + 'devis-provisoire.pdf');
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminContext.newPage();
  admin.on('pageerror', (e) => errors.push(e.message));
  await admin.goto(baseUrl + '/connexion');
  await admin.getByLabel('Téléphone ou email administrateur').fill(env.ADMIN_PHONE);
  await admin
    .getByLabel(/mot de passe/i)
    .first()
    .fill(env.ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(admin.getByRole('table', { name: /réservations/i })).toBeVisible({
    timeout: 15000,
  });
  await admin
    .locator('.admin-reservations-row[role="link"]')
    .filter({ hasText: booking.reference })
    .click();
  await expect(admin.locator('#admin-quote-form')).toBeVisible({ timeout: 15000 });
  const saveQuote = admin.getByRole('button', { name: /enregistrer les modifications/i });
  await expect(saveQuote).toBeEnabled({ timeout: 15000 });
  const quoteKind = admin.getByRole('group', { name: /type de devis/i });
  const finalButton = quoteKind.getByRole('button', { name: /final/i });
  await finalButton.click();
  await expect(finalButton).toHaveAttribute('aria-pressed', 'true');
  await saveQuote.click();
  await expect(admin).toHaveURL(/\/admin\?/u, { timeout: 20000 });
  const storedQuotes = await db.devis.findMany({
    where: { reservationId: booking.id },
    include: { lignes: true },
  });
  console.log(
    'Quotes persisted:',
    storedQuotes.map(({ nature, montantTotal, lignes }) => ({
      nature,
      montantTotal,
      lineCount: lignes.length,
    })),
  );
  const finalQuotes = storedQuotes.filter((quote) => quote.nature === 'definitif');
  if (finalQuotes.length !== 1 || finalQuotes[0].montantTotal == null)
    throw new Error('Le devis final et ses lignes doivent être enregistrés en base.');
  const journal = await admin.evaluate(
    async ({ url, month }) => {
      const response = await fetch(`${url}/admin/accounting?month=${month}`, {
        credentials: 'include',
      });
      return { status: response.status, entries: await response.json() };
    },
    { url: apiUrl, month: finalQuotes[0].creeLe.toISOString().slice(0, 7) },
  );
  const journalRevenue = Array.isArray(journal.entries)
    ? journal.entries.filter(
        (entry) => entry.reference === finalQuotes[0].reference && entry.type === 'revenu',
      )
    : [];
  if (
    journal.status !== 200 ||
    journalRevenue.length !== 1 ||
    journalRevenue[0].amount !== finalQuotes[0].montantTotal
  )
    throw new Error('Le journal comptable doit contenir le revenu final avec le montant du devis.');
  console.log('Journal comptable vérifié:', journalRevenue[0].amount, 'FCFA');
  const adminPages = [
    ['reservations', '/admin', '.admin-reservations-desktop'],
    ['calendar', '/admin/planning', '.reference-calendar-page'],
    ['teams', '/admin/flotte', '.admin-teams'],
    ['planning-follow-up', '/admin/suivi-planning', '.reference-plan-page'],
    ['clients', '/admin/clients', '.reference-clients-page'],
    ['accounting', '/admin/comptabilite', '.reference-accounting-overview'],
    ['vehicle-reports', '/admin/vehicules/rapports', '.reference-controls-page'],
    ['tolls', '/admin/peages', '.toll-reference-page'],
    ['settings', '/admin/parametres', '.reference-settings-page'],
    ['data', '/admin/donnees', '.admin-data-page'],
  ];
  for (const [slug, path, pageSelector] of adminPages) {
    await admin.goto(baseUrl + path, { waitUntil: 'domcontentloaded' });
    await admin.locator(pageSelector).waitFor({ state: 'visible', timeout: 20000 });
    if (path === '/admin/flotte')
      await expect(admin.getByText('Chargement des employés…')).toHaveCount(0, {
        timeout: 20000,
      });
    await admin.waitForTimeout(path === '/admin/comptabilite' ? 6000 : 700);
    if (path === '/admin')
      await admin.screenshot({ path: output + 'desktop-admin.png', fullPage: true });
    else await admin.screenshot({ path: output + `admin-${slug}-desktop.png`, fullPage: true });
    await admin.setViewportSize({ width: 390, height: 844 });
    const pageWidth = await admin.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
        })
        .slice(0, 6)
        .map((element) => ({
          className: typeof element.className === 'string' ? element.className : '',
          right: Math.round(element.getBoundingClientRect().right),
        })),
    }));
    if (pageWidth.document > pageWidth.viewport) horizontalOverflow.push({ [slug]: pageWidth });
    if (path === '/admin')
      await admin.screenshot({ path: output + 'mobile-admin.png', fullPage: true });
    else await admin.screenshot({ path: output + `admin-${slug}-mobile.png`, fullPage: true });
    console.log(
      `Admin route audit ${path}:`,
      (await admin.locator(pageSelector).innerText()).slice(0, 180).replaceAll('\n', ' · '),
    );
    await admin.setViewportSize({ width: 1280, height: 1000 });
  }
  await page.reload();
  await expect(page.getByText('Final', { exact: true })).toBeVisible({ timeout: 15000 });
  const finalDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le devis final (PDF)' }).click();
  await (await finalDownload).saveAs(output + 'devis-final.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + 'mobile-account.png', fullPage: true });
  const accountWidth = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (accountWidth.document > accountWidth.viewport)
    horizontalOverflow.push({ account: accountWidth });
  await page.locator('.account-menu summary').click();
  await page.getByRole('button', { name: /déconnexion/i }).click();
  await page.getByRole('link', { name: /mon compte/i }).click();
  await page.getByLabel(/téléphone/i).fill(phone);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.locator('.reference-client-card')).toHaveCount(1);
  await admin.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await expect(admin.locator('.reference-settings-page')).toBeVisible();
  const settingsWidth = await admin.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (settingsWidth.document > settingsWidth.viewport)
    horizontalOverflow.push({ settings: settingsWidth });
  await admin.screenshot({ path: output + 'mobile-settings.png', fullPage: true });
  await admin.locator('.account-menu summary').click();
  await admin.getByRole('button', { name: /déconnexion/i }).click();
  expect(errors).toEqual([]);
  if (horizontalOverflow.length)
    throw new Error(`Débordement horizontal mobile détecté: ${JSON.stringify(horizontalOverflow)}`);
  console.log(
    'Navigateur OK : responsive 1440/390/320, inscription, brouillon conservé, trajet réel OSRM, réservation persistée, connexion administrateur, confirmation, devis final, PDF et suivi client.',
  );
} catch (error) {
  console.error('Messages visibles :', await page.locator('[role="alert"]').allTextContents());
  await page.screenshot({ path: output + 'browser-failure.png', fullPage: true });
  throw error;
} finally {
  const user = userId
    ? await db.utilisateur.findUnique({ where: { id: userId } })
    : await db.utilisateur.findUnique({ where: { telephone: '+221' + phone } });
  if (user) {
    await db.reservation.deleteMany({ where: { utilisateurId: user.id } });
    await db.utilisateur.delete({ where: { id: user.id } });
  }
  await db.itineraire.deleteMany({ where: { id: { in: tickets } } });
  await browser.close();
  await db.$disconnect();
}
