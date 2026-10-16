import { chromium, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPrisma } from '../../backend/src/adapters/out/prisma/client.ts';
const env = dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url)));
const db = createPrisma(env.DATABASE_URL);
const baseUrl = process.env.BROWSER_BASE_URL || 'http://localhost:5173';
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
page.on('pageerror', (e) => errors.push(e.message));
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
  await expect(page.getByRole('heading', { name: 'VÉHICULE', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: output + 'desktop-home.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: output + `mobile-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  const map = page.locator('.leaflet-container');
  await map.scrollIntoViewIfNeeded();
  const mapBounds = await map.boundingBox();
  if (!mapBounds) throw new Error('Carte invisible');
  const center = { x: mapBounds.width / 2, y: mapBounds.height / 2 };
  await map.click({ position: center });
  await page.waitForTimeout(500);
  await map.click({ position: { x: center.x + 80, y: center.y - 60 } });
  await page.getByRole('button', { name: 'Calculer mon trajet' }).click();
  await expect(page.getByRole('button', { name: 'Me connecter et réserver' })).toBeEnabled({
    timeout: 25000,
  });
  await page
    .getByLabel('Date souhaitée')
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Me connecter et réserver' }).click();
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Nom complet').fill(name);
  await page.getByLabel('Téléphone', { exact: true }).fill(phone);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
  await page.getByLabel('Nom', { exact: true }).fill(name);
  await page.getByLabel('Téléphone', { exact: true }).fill(phone);
  await expect(page.getByRole('button', { name: 'Envoyer ma demande' })).toBeEnabled({
    timeout: 15000,
  });
  userId = (await db.utilisateur.findUniqueOrThrow({ where: { telephone: '+221' + phone } })).id;
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText('DEMANDE ENREGISTRÉE', { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('link', { name: 'Suivre ma réservation' }).click();
  await page.reload();
  await expect(page.locator('.booking-card')).toHaveCount(1, { timeout: 15000 });
  const booking = await db.reservation.findFirstOrThrow({ where: { utilisateurId: userId } });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const download = await downloadPromise;
  await download.saveAs(output + 'devis-provisoire.pdf');
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminContext.newPage();
  admin.on('pageerror', (e) => errors.push(e.message));
  await admin.goto(baseUrl + '/connexion');
  await admin.getByLabel('Téléphone', { exact: true }).fill(env.ADMIN_PHONE);
  await admin.getByLabel('Mot de passe', { exact: true }).fill(env.ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Me connecter', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'ADMINISTRATION' })).toBeVisible({
    timeout: 15000,
  });
  const card = admin.locator('.booking-card').filter({ hasText: booking.reference });
  await card.getByRole('button', { name: 'Confirmer la réservation' }).click();
  await card.getByRole('button', { name: 'Démarrer le déménagement' }).click();
  await card.getByRole('button', { name: 'Créer un devis' }).click();
  await card.getByLabel('Type de devis').selectOption('final');
  await card.getByLabel('Allers-retours', { exact: true }).fill('2');
  await card.getByRole('button', { name: 'Enregistrer le devis' }).click();
  await expect(card.getByText('Terminée', { exact: true })).toBeVisible({ timeout: 15000 });
  await admin.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await admin.screenshot({ path: output + 'desktop-admin.png', fullPage: true });
  await admin.setViewportSize({ width: 390, height: 844 });
  expect(await admin.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await admin.screenshot({ path: output + 'mobile-admin.png', fullPage: true });
  await page.reload();
  await expect(page.getByText('Terminée', { exact: true })).toBeVisible({ timeout: 15000 });
  const finalDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  await (await finalDownload).saveAs(output + 'devis-final.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + 'mobile-account.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Modifier mon mot de passe' }).click();
  await page.getByLabel('Mot de passe actuel').fill(password);
  await page.getByLabel('Nouveau mot de passe').fill('Browser-changed-2026!');
  await page.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }).click();
  await expect(page.getByText('Mot de passe modifié.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.getByRole('link', { name: 'Mon compte' }).click();
  await page.getByLabel('Téléphone', { exact: true }).fill(phone);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Browser-changed-2026!');
  await page.getByRole('button', { name: 'Me connecter', exact: true }).click();
  await expect(page.locator('.booking-card')).toHaveCount(1);
  await admin.getByRole('button', { name: 'Tarifs et paramètres' }).click();
  await expect(admin.getByRole('heading', { name: 'TARIFS DE TRANSPORT' })).toBeVisible();
  expect(await admin.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await admin.screenshot({ path: output + 'mobile-settings.png', fullPage: true });
  await admin.getByRole('button', { name: 'Se déconnecter' }).click();
  expect(errors).toEqual([]);
  console.log(
    'Navigateur OK : responsive 1440/390/320, inscription, brouillon conservé, trajet réel OSRM, réservation persistée, connexion administrateur, confirmation, devis final, PDF et suivi client.',
  );
} catch (error) {
  console.error('Messages visibles :', await page.locator('[role="alert"]').allTextContents());
  await page.screenshot({ path: output + 'browser-failure.png', fullPage: true });
  throw error;
} finally {
  const user = await db.utilisateur.findUnique({ where: { telephone: '+221' + phone } });
  if (user) {
    await db.reservation.deleteMany({ where: { utilisateurId: user.id } });
    await db.utilisateur.delete({ where: { id: user.id } });
  }
  await db.itineraire.deleteMany({ where: { id: { in: tickets } } });
  await browser.close();
  await db.$disconnect();
}
