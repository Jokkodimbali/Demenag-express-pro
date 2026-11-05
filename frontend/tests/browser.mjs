import { chromium, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPrisma } from '../../backend/src/adapters/out/prisma/client.ts';
if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Ce test navigateur doit viser uniquement la branche Neon isolée.');
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL doit viser la branche Neon isolée.');
const db = createPrisma(process.env.TEST_DATABASE_URL);
const localEnv = dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url)));
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
let teamUserId;
let scenarioError;
let cleanupError;
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
  admin.on('response', async (response) => {
    if (!/\/work-plan\/[^/]+\/review$/u.test(new URL(response.url()).pathname)) return;
    const body = await response.json().catch(() => null);
    console.log(`Planning review: HTTP ${response.status()}`, {
      version: body?.version,
      status: body?.workPlan?.find((step) => step.id === response.url().split('/').at(-2))?.review
        ?.status,
    });
  });
  await admin.goto(baseUrl + '/connexion');
  await admin
    .getByLabel('Téléphone ou email administrateur')
    .fill(process.env.ADMIN_PHONE || localEnv.ADMIN_PHONE);
  await admin
    .getByLabel(/mot de passe/i)
    .first()
    .fill(process.env.ADMIN_PASSWORD || localEnv.ADMIN_PASSWORD);
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
    if (path === '/admin/flotte') {
      let teamName = 'Test équipe ' + randomUUID().slice(0, 8);
      let teamPhone = '76' + String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
      const employeeForm = admin.locator('.teams-new-employee');
      const employeeCountBefore = await admin.locator('.teams-employee').count();
      const employeeInputs = employeeForm.locator('.teams-form-grid input');
      const mapLayerButton = admin
        .locator('.teams-map-panel .teams-chips')
        .getByRole('button', { name: /Logements des employés/u });
      const layerWasActive = await mapLayerButton.evaluate((element) =>
        element.classList.contains('active'),
      );
      await mapLayerButton.click();
      await expect(mapLayerButton).toHaveClass(
        layerWasActive ? /team-chip(?!.*active)/u : /active/u,
      );
      await mapLayerButton.click();
      await expect(mapLayerButton).toHaveClass(/active/u);
      await employeeForm.getByRole('button', { name: "Ajouter l'employé" }).click();
      await expect(admin.getByRole('alert')).toHaveText('Indiquez le nom.');
      await employeeInputs.nth(0).fill(teamName);
      await employeeForm.getByRole('button', { name: "Ajouter l'employé" }).click();
      await expect(admin.getByRole('alert')).toHaveText('Indiquez le téléphone.');
      await employeeInputs.nth(1).fill(teamPhone);
      await employeeForm
        .locator('.teams-chips')
        .getByRole('button', { name: 'Chauffeur', exact: true })
        .click();
      await employeeForm
        .locator('.teams-new-driver-vehicles')
        .getByRole('button', { name: /Sprinter/i })
        .click();
      await employeeForm.getByRole('button', { name: "Ajouter l'employé" }).click();
      const credentials = admin.locator('.teams-generated-credentials');
      await expect(credentials).toBeVisible({ timeout: 15000 });
      const initialPassword = await credentials
        .locator('.teams-generated-fields input')
        .nth(1)
        .inputValue();
      if (!initialPassword)
        throw new Error('Le mot de passe initial de l’employé n’a pas été généré.');
      const teamUser = await db.utilisateur.findUnique({
        where: { telephone: '+221' + teamPhone },
      });
      if (!teamUser || teamUser.empreinteMotDePasse === initialPassword)
        throw new Error('Le compte employé et son hash doivent être enregistrés en base.');
      teamUserId = teamUser.id;
      const teamDriver = await db.chauffeur.findUniqueOrThrow({
        where: { utilisateurId: teamUser.id },
      });
      const initialTeamHash = teamUser.empreinteMotDePasse;
      if (teamDriver.fonction !== 'chauffeur' || !teamDriver.actif)
        throw new Error('Le profil chauffeur créé depuis la page Équipe est incohérent en base.');
      const inputIndex = await admin
        .locator('.teams-name-input')
        .evaluateAll(
          (inputs, value) => inputs.findIndex((input) => input.value === value),
          teamName,
        );
      if (inputIndex < 0) throw new Error('Le nouvel employé n’apparaît pas dans la liste.');
      const employeeCard = admin.locator('.teams-employee').nth(inputIndex);
      const traffic = admin.locator('.teams-traffic');
      const trafficBefore = await traffic.innerText();
      await traffic.click();
      await expect(traffic).not.toHaveText(trafficBefore);
      const roleFilters = admin.locator('.teams-filter-chips');
      const acceptedSort = roleFilters.getByRole('button', {
        name: 'Trier par missions acceptées',
      });
      await acceptedSort.click();
      await expect(acceptedSort).toHaveClass(/active/u);
      const roleSort = roleFilters.getByRole('button', { name: 'Trier par rôle' });
      await roleSort.click();
      await expect(roleSort).toHaveClass(/active/u);
      await roleFilters.getByRole('button', { name: /^Manœuvres ·/u }).click();
      await expect(admin.locator('.teams-employee')).toHaveCount(0);
      await expect(admin.locator('.teams-empty')).toContainText('Aucun employé dans ce rôle.');
      await roleFilters.getByRole('button', { name: /^Tous ·/u }).click();
      await expect(admin.locator('.teams-employee')).toHaveCount(employeeCountBefore + 1);

      await employeeCard.locator('.teams-employee-heading .team-icon-button').first().click();
      const details = employeeCard.locator('.teams-employee-details');
      const updatedTeamName = teamName + ' modifié';
      await employeeCard.locator('.teams-name-input').fill(updatedTeamName);
      await employeeCard.locator('.teams-name-input').press('Tab');
      await expect
        .poll(
          async () => (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).nom,
        )
        .toBe(updatedTeamName);
      teamName = updatedTeamName;
      const updatedTeamPhone = '75' + String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
      await details.locator('.teams-contact-row input').first().fill(updatedTeamPhone);
      await details.locator('.teams-contact-row input').first().press('Tab');
      await expect
        .poll(
          async () =>
            (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } })).telephone,
        )
        .toBe('+221' + updatedTeamPhone);
      teamPhone = updatedTeamPhone;

      const sprinterChip = details
        .locator('.teams-vehicle-tags')
        .getByRole('button', { name: /Sprinter/i });
      await sprinterChip.click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } }))
              .vehiculesAutorises,
        )
        .toEqual([]);
      await sprinterChip.click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } }))
              .vehiculesAutorises,
        )
        .toEqual(['sprinter']);

      const disclosures = details.locator('.teams-disclosure');
      await disclosures.nth(0).click();
      const reliableTag = details.getByRole('button', { name: 'Fiable', exact: true });
      await reliableTag.click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).competences,
        )
        .toEqual(['Fiable']);
      const teamNotes = 'Contrôle navigateur équipe';
      const notesInput = details.locator('.teams-note-editor textarea');
      await notesInput.fill(teamNotes);
      await notesInput.press('Tab');
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).notes,
        )
        .toBe(teamNotes);

      await disclosures.nth(1).click();
      const monday = details.locator('.teams-hours-day').first();
      await monday.getByRole('button', { name: 'Travaille', exact: true }).click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } }))
              .disponibilites[0].available,
        )
        .toBe(false);
      await monday.getByRole('button', { name: 'Repos', exact: true }).click();
      const hours = monday.locator('input[type="time"]');
      await hours.nth(0).fill('07:15');
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } }))
              .disponibilites[0].startTime,
        )
        .toBe('07:15');
      await hours.nth(1).fill('17:15');
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } }))
              .disponibilites[0].endTime,
        )
        .toBe('17:15');
      await details.getByRole('button', { name: /Appliquer l.horaire du lundi/i }).click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).disponibilites,
        )
        .toEqual(
          Array.from({ length: 7 }, (_, index) => ({
            available: index < 6,
            startTime: index < 6 ? '07:15' : '08:00',
            endTime: index < 6 ? '17:15' : '18:00',
          })),
        );

      const jobCard = admin.locator('.teams-job').filter({ hasText: booking.reference });
      await expect(jobCard).toHaveCount(1, { timeout: 20000 });
      await jobCard.locator('.teams-accordion-heading').first().click();
      const chauffeurRole = jobCard.locator('.teams-role').filter({ hasText: /Chauffeur/u });
      await chauffeurRole.locator('.team-chip.add').click();
      const candidate = jobCard.locator('.teams-options button').filter({ hasText: teamName });
      await expect(candidate).toBeEnabled();
      await candidate.click();
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).chauffeurId,
        )
        .toBe(teamDriver.id);

      await jobCard
        .locator('.teams-accordion-heading')
        .filter({ hasText: /ENVOI DE LA MISSION/iu })
        .click();
      await jobCard.locator('.teams-send-controls select').selectOption(teamDriver.id);
      const customBrief = 'Brief navigateur enregistré et vérifié';
      const briefInput = jobCard.locator('.teams-message-editor textarea');
      await briefInput.fill(customBrief);
      await briefInput.press('Tab');
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
              .crewMessages?.[teamDriver.id],
        )
        .toBe(customBrief);

      await jobCard
        .locator('.teams-accordion-heading')
        .filter({ hasText: /SUIVI DES RÉPONSES/iu })
        .click();
      await jobCard.getByRole('button', { name: 'Marquer envoyé' }).click();
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
              .crewBriefs?.[teamDriver.id],
        )
        .toBeTruthy();
      await jobCard.getByRole('button', { name: 'A accepté', exact: true }).click();
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
              .crewReplies?.[teamDriver.id],
        )
        .toBe('ok');
      const refusalsBefore = (
        await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })
      ).refusMissions.length;
      await jobCard.getByRole('button', { name: 'A refusé', exact: true }).click();
      await expect(admin.locator('.confirmation-dialog')).toBeVisible();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Annuler', exact: true })
        .click();
      expect(
        (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
          .crewReplies?.[teamDriver.id],
      ).toBe('ok');
      expect(
        (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).refusMissions,
      ).toHaveLength(refusalsBefore);
      await jobCard.getByRole('button', { name: 'A refusé', exact: true }).click();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Confirmer', exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
              .crewReplies?.[teamDriver.id],
        )
        .toBe('no');
      expect(
        (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).refusMissions,
      ).toHaveLength(refusalsBefore + 1);
      expect(
        (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees.crew
          .chauffeur,
      ).not.toContain(teamDriver.id);
      await expect(jobCard.locator('.teams-refusals')).toContainText(teamName);
      const reAddRole = jobCard.locator('.teams-role').filter({ hasText: /Chauffeur/u });
      const reAddOptions = jobCard.locator('.teams-options');
      const reAddCandidate = reAddOptions.getByRole('button').filter({ hasText: teamName });
      if (await reAddCandidate.isVisible()) {
        await reAddRole.locator('.team-chip.add').click();
        await expect(reAddOptions).toHaveCount(0);
      }
      await reAddRole.locator('.team-chip.add').click();
      await expect(reAddOptions).toContainText(teamName);
      await reAddCandidate.click();
      await expect
        .poll(
          async () =>
            (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees.crew
              .chauffeur,
        )
        .toContain(teamDriver.id);
      expect(
        (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } })).donnees
          .crewRefusedBy,
      ).toContain(teamDriver.id);

      await employeeCard
        .getByRole('button', { name: `Réinitialiser le mot de passe de ${teamName}` })
        .click();
      await expect(admin.locator('.confirmation-dialog')).toBeVisible();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Annuler', exact: true })
        .click();
      await expect(admin.locator('.confirmation-dialog')).toHaveCount(0);
      expect(
        (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } }))
          .empreinteMotDePasse,
      ).toBe(initialTeamHash);
      await employeeCard
        .getByRole('button', { name: `Réinitialiser le mot de passe de ${teamName}` })
        .click();
      await expect(admin.locator('.confirmation-dialog')).toBeVisible();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Générer un nouveau mot de passe' })
        .click();
      await expect(credentials).toBeVisible({ timeout: 15000 });
      await expect
        .poll(() => credentials.locator('.teams-generated-fields input').nth(1).inputValue(), {
          timeout: 15000,
        })
        .not.toBe(initialPassword);
      const refreshedPassword = await credentials
        .locator('.teams-generated-fields input')
        .nth(1)
        .inputValue();
      if (!refreshedPassword || refreshedPassword === initialPassword)
        throw new Error('La réinitialisation n’a pas remplacé le mot de passe initial.');
      expect(
        (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } }))
          .empreinteMotDePasse,
      ).not.toBe(initialTeamHash);
      expect(await db.sessionConnexion.count({ where: { utilisateurId: teamUser.id } })).toBe(0);
      await employeeCard.locator('.team-status-pill').click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).actif,
        )
        .toBe(false);
      await expect
        .poll(
          async () =>
            (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } })).actif,
        )
        .toBe(false);
      await employeeCard.locator('.team-status-pill').click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).actif,
        )
        .toBe(true);
      await expect
        .poll(
          async () =>
            (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } })).actif,
        )
        .toBe(true);
      await employeeCard.locator('.team-delete').click();
      await expect(admin.locator('.confirmation-dialog')).toBeVisible();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Annuler', exact: true })
        .click();
      await expect(admin.locator('.confirmation-dialog')).toHaveCount(0);
      expect((await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).actif).toBe(
        true,
      );
      await employeeCard.locator('.team-delete').click();
      await expect(admin.locator('.confirmation-dialog')).toBeVisible();
      await admin
        .locator('.confirmation-dialog')
        .getByRole('button', { name: 'Confirmer', exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (await db.chauffeur.findUniqueOrThrow({ where: { id: teamDriver.id } })).actif,
        )
        .toBe(false);
      await expect
        .poll(
          async () =>
            (await db.utilisateur.findUniqueOrThrow({ where: { id: teamUser.id } })).actif,
        )
        .toBe(false);
      const bookingAfterRemoval = await db.reservation.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(bookingAfterRemoval.chauffeurId).toBeNull();
      expect(bookingAfterRemoval.donnees.crew.chauffeur).not.toContain(teamDriver.id);
      console.log(
        'Équipe navigateur : création, hash, réinitialisation, désactivation, réactivation et retrait vérifiés.',
      );
    }
    if (path === '/admin/suivi-planning') {
      const selectedDate = booking.date.toISOString().slice(0, 10);
      const followUp = admin.locator('.reference-plan-page');
      const followUpBooking = await db.reservation.findUniqueOrThrow({
        where: { id: booking.id },
      });
      const stepIds = followUpBooking.donnees.workPlan?.length
        ? followUpBooking.donnees.workPlan.map(({ id }) => id)
        : ['fallback-1', 'fallback-2', 'fallback-3'];
      const dateFilter = followUp.getByLabel('Date du suivi');
      const record = () =>
        admin.locator('.reference-plan-card').filter({ hasText: booking.reference });
      const savedStep = async (stepId) => {
        const current = await db.reservation.findUniqueOrThrow({ where: { id: booking.id } });
        return current.donnees.workPlan?.find(({ id }) => id === stepId)?.review;
      };
      const savedReview = (index) => savedStep(stepIds[index]);
      const reviewErrors = (index) => rows.nth(index).locator('[role="alert"]');

      await followUp.getByRole('button', { name: 'Jour', exact: true }).click();
      await dateFilter.fill(selectedDate);
      await expect(record()).toHaveCount(1, { timeout: 15000 });
      await followUp.getByRole('button', { name: 'Période précédente' }).click();
      await expect(record()).toHaveCount(0);
      await followUp.getByRole('button', { name: 'Période suivante' }).click();
      await expect(record()).toHaveCount(1);
      await followUp.getByRole('button', { name: 'Semaine', exact: true }).click();
      await expect(record()).toHaveCount(1);
      await followUp.getByRole('button', { name: 'Mois', exact: true }).click();
      await expect(record()).toHaveCount(1);
      await followUp.getByRole('button', { name: 'Jour', exact: true }).click();
      await dateFilter.fill(selectedDate);
      await expect(record()).toHaveCount(1);

      const card = record();
      await card.locator('.reference-plan-card-head').click();
      const rows = card.locator('.reference-plan-row');
      if (stepIds.length < 3)
        throw new Error('Le planning de réservation doit contenir au moins trois étapes.');
      await expect(rows).toHaveCount(stepIds.length);
      await rows.nth(0).getByRole('button', { name: 'Respecté', exact: true }).click();
      await expect.poll(async () => (await savedReview(0))?.status).toBe('respected');
      await rows.nth(0).locator('input[type="time"]').fill('09:32');
      await expect.poll(async () => (await savedReview(0))?.actualTime).toBe('09:32');

      await rows.nth(1).getByRole('button', { name: 'En retard', exact: true }).click();
      await expect.poll(async () => (await savedReview(1))?.status).toBe('late');
      const delayReason = rows.nth(1).locator('.reference-plan-proof textarea');
      await delayReason.fill('Embouteillage constaté sur le trajet.');
      await expect
        .poll(async () => (await savedReview(1))?.reason)
        .toBe('Embouteillage constaté sur le trajet.');
      await expect(reviewErrors(1)).toHaveCount(0);
      await rows.nth(1).getByRole('button', { name: 'Circulation', exact: true }).click();
      await expect.poll(async () => (await savedReview(1))?.cause).toBe('Circulation');
      await rows.nth(1).getByRole('button', { name: 'Majeure', exact: true }).click();
      await expect.poll(async () => (await savedReview(1))?.severity).toBe('maj');
      const correctiveAction = rows.nth(1).locator('.reference-plan-cause-fields textarea');
      await correctiveAction.fill('Prévoir un départ avec marge de circulation.');
      await expect
        .poll(async () => (await savedReview(1))?.correctiveAction)
        .toBe('Prévoir un départ avec marge de circulation.');
      await expect(reviewErrors(1)).toHaveCount(0);

      await rows.nth(2).getByRole('button', { name: 'Non respecté', exact: true }).click();
      await rows
        .nth(2)
        .locator('.reference-plan-proof textarea')
        .fill('Accès indisponible à l’arrivée.');
      const png = await admin.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const drawing = canvas.getContext('2d');
        if (!drawing) throw new Error('Canvas de preuve indisponible.');
        drawing.fillStyle = '#e5b700';
        drawing.fillRect(0, 0, 4, 4);
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await rows
        .nth(2)
        .locator('.reference-plan-photo input[type="file"]')
        .setInputFiles({
          name: 'preuve-planning.png',
          mimeType: 'image/png',
          buffer: Buffer.from(png, 'base64'),
        });
      await expect(rows.nth(2).locator('.reference-plan-thumbnail img')).toBeVisible();
      await rows.nth(2).getByRole('button', { name: 'Client', exact: true }).click();
      await rows.nth(2).getByRole('button', { name: 'Critique', exact: true }).click();
      await rows
        .nth(2)
        .locator('.reference-plan-cause-fields textarea')
        .fill('Confirmer les conditions d’accès avant le départ.');
      await expect
        .poll(async () => (await savedReview(2))?.photo)
        .toMatch(/^data:image\/jpeg;base64,/u);
      await expect.poll(async () => (await savedReview(2))?.severity).toBe('cri');
      for (const index of stepIds.keys()) {
        if (index < 3) continue;
        await rows.nth(index).getByRole('button', { name: 'Respecté', exact: true }).click();
        await expect.poll(async () => (await savedReview(index))?.status).toBe('respected');
      }
      const storedPlan = (await db.reservation.findUniqueOrThrow({ where: { id: booking.id } }))
        .donnees.workPlan;
      expect(storedPlan.map(({ review }) => review.status)).toEqual(
        stepIds.map((_, index) =>
          index === 0
            ? 'respected'
            : index === 1
              ? 'late'
              : index === 2
                ? 'not_respected'
                : 'respected',
        ),
      );

      await rows.nth(2).locator('.reference-plan-thumbnail img').click();
      const lightbox = followUp.getByRole('dialog', { name: 'Justificatif photographique' });
      await expect(lightbox).toBeVisible();
      await lightbox.getByRole('button', { name: '+' }).click();
      await expect(lightbox).toContainText('150 %');
      await lightbox.getByRole('button', { name: 'Fermer' }).click();
      await expect(lightbox).toHaveCount(0);

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
      const reportDownload = admin.waitForEvent('download');
      await report.getByRole('button', { name: /Télécharger le rapport QHSE/i }).click();
      await (await reportDownload).saveAs(output + 'rapport-qhse-planning.pdf');
      await admin.screenshot({
        path: output + 'admin-planning-follow-up-reviewed.png',
        fullPage: true,
      });
      console.log(
        'Suivi planning navigateur : périodes, filtres, trois étapes, sauvegarde PostgreSQL, justification, photo, zoom, rapport QHSE et PDF vérifiés.',
      );
    }
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
  scenarioError = error;
} finally {
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const user = userId
          ? await db.utilisateur.findUnique({ where: { id: userId } })
          : await db.utilisateur.findUnique({ where: { telephone: '+221' + phone } });
        if (user) {
          const bookings = await db.reservation.findMany({
            where: { utilisateurId: user.id },
            select: { devis: { select: { id: true } } },
          });
          const quoteIds = bookings.flatMap((booking) => booking.devis.map(({ id }) => id));
          if (quoteIds.length)
            await db.ecritureComptable.deleteMany({
              where: { sourceDevisId: { in: quoteIds } },
            });
          await db.reservation.deleteMany({ where: { utilisateurId: user.id } });
          await db.utilisateur.deleteMany({ where: { id: user.id } });
        }
        if (teamUserId) await db.utilisateur.deleteMany({ where: { id: teamUserId } });
        if (tickets.length) await db.itineraire.deleteMany({ where: { id: { in: tickets } } });
        cleanupError = undefined;
        break;
      } catch (error) {
        cleanupError = error;
        await db.$disconnect().catch(() => undefined);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}
if (scenarioError && cleanupError)
  throw new AggregateError(
    [scenarioError, cleanupError],
    'Le scénario et son nettoyage ont échoué.',
  );
if (scenarioError) throw scenarioError;
if (cleanupError) throw cleanupError;
