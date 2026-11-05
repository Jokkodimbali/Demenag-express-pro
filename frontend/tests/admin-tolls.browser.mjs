import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createIntegrationContext,
  integrationHeader,
  integrationPassword,
} from '../../backend/tests/integration/context.ts';
import { deleteScenarioData } from '../../backend/tests/integration/cleanup.ts';
import { registerScenarioUsers } from '../../backend/tests/integration/accounts.ts';

if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Le test Péages admin doit viser uniquement la branche Neon isolée.');
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
page.on('response', async (response) => {
  if (
    response.url().includes('/api/toll-points') &&
    response.request().method() === 'POST' &&
    response.status() >= 400
  )
    console.error('Échec API création depuis la carte :', response.status(), await response.text());
});
const startedAt = new Date(Date.now() - 1000);
const routeIds = [];
const testTollIds = [];
let baselineTollIds = [];
const testTag = data.prefix.replace(/[^a-z0-9]/giu, '').slice(-10);
const regionA = `Region ${testTag} Dakar`;
const regionB = `Region ${testTag} Thies`;
const axisA = `Axe ${testTag} Dakar`;
const axisB = `Axe ${testTag} Thies`;
const uiPointName = `Test ${testTag} carte`;
let uiPointId = '';

function priceText(amount) {
  return amount.toLocaleString('fr-FR');
}

function pointInput(name, region, axis, heavyPrice, vehiclePrices, latitude, longitude) {
  return { name, region, axis, heavyPrice, vehiclePrices, latitude, longitude };
}

async function createApiPoint(input) {
  const response = await data.clients.admin
    .post('/api/toll-points')
    .set(integrationHeader)
    .send(input);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  testTollIds.push(response.body.id);
  return response.body;
}

function tollRow(name) {
  return page.locator('.toll-reference-result').filter({ hasText: name });
}

async function findBlankMapSpot(map) {
  const mapBox = await map.boundingBox();
  expect(mapBox).not.toBeNull();
  const occupied = await map.locator('.toll-admin-marker-price').evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x - 8, y: box.y - 8, right: box.right + 8, bottom: box.bottom + 8 };
    }),
  );
  const candidates = [
    [0.72, 0.7],
    [0.3, 0.7],
    [0.72, 0.3],
    [0.3, 0.3],
    [0.5, 0.78],
    [0.82, 0.5],
    [0.18, 0.5],
    [0.5, 0.22],
  ];
  for (const [relativeX, relativeY] of candidates) {
    const x = mapBox.x + mapBox.width * relativeX;
    const y = mapBox.y + mapBox.height * relativeY;
    if (!occupied.some((box) => x >= box.x && x <= box.right && y >= box.y && y <= box.bottom))
      return { x, y };
  }
  throw new Error('Aucun espace libre trouvé sur la carte pour tester l’ajout.');
}

try {
  const initialPoints = await data.db.pointPeage.findMany({ select: { id: true } });
  baselineTollIds = initialPoints.map((point) => point.id);
  await registerScenarioUsers(data);
  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status, JSON.stringify(adminLogin.body)).toBe(200);
  const catalogue = await data.clients.first.get('/api/catalogue');
  expect(catalogue.status).toBe(200);
  const vehicles = catalogue.body.vehicles;
  expect(vehicles.length).toBeGreaterThanOrEqual(3);
  const vehiclePrices = Object.fromEntries(
    vehicles.map((vehicle, index) => [vehicle.id, 1200 + index * 300]),
  );

  expect((await data.clients.first.get('/api/toll-points')).status).toBe(200);
  expect(
    (
      await data.clients.first
        .post('/api/toll-points')
        .set(integrationHeader)
        .send(pointInput('Non autorisé', '', '', 100, vehiclePrices, 14.7, -17.3))
    ).status,
  ).toBe(403);
  const missingCoordinates = await data.clients.admin
    .post('/api/toll-points')
    .set(integrationHeader)
    .send(pointInput('Coordonnées absentes', '', '', 100, vehiclePrices, null, null));
  expect(missingCoordinates.status).toBe(400);
  const negativePrice = await data.clients.admin
    .post('/api/toll-points')
    .set(integrationHeader)
    .send(pointInput('Tarif négatif', '', '', -1, vehiclePrices, 14.7, -17.3));
  expect(negativePrice.status).toBe(400);

  const apiPointA = await createApiPoint(
    pointInput(`Contrôle ${testTag} Nord`, regionA, axisA, 2000, vehiclePrices, 14.68, -17.25),
  );
  await createApiPoint(
    pointInput(`Contrôle ${testTag} Sud`, regionB, axisA, 2500, vehiclePrices, 14.7, -17.2),
  );
  await createApiPoint(
    pointInput(`Contrôle ${testTag} Est`, regionB, axisB, 3000, vehiclePrices, 14.72, -17.18),
  );
  const listed = await data.clients.admin.get('/api/toll-points');
  expect(listed.status).toBe(200);
  expect(listed.body.filter((point) => testTollIds.includes(point.id))).toHaveLength(3);
  expect(listed.body.find((point) => point.id === apiPointA.id)).toMatchObject({
    region: regionA,
    axis: axisA,
    vehiclePrices,
  });

  await page.goto(`${baseUrl}/connexion`);
  await page.getByLabel('Téléphone ou email administrateur').fill(data.phone(2));
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(integrationPassword);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('table', { name: /réservations/i })).toBeVisible({ timeout: 20000 });
  await page.goto(`${baseUrl}/admin/peages`);
  const tollPage = page.locator('.toll-reference-page');
  await expect(tollPage).toBeVisible({ timeout: 20000 });
  const mapPanel = tollPage.locator('.toll-reference-map-panel');
  const map = mapPanel.locator('.toll-editor-map');
  await expect(map).toBeVisible();
  const mapRegion = mapPanel.getByRole('region');
  await expect(mapRegion).toBeVisible();
  const tabs = tollPage.locator('.toll-reference-vehicle-tabs');
  const search = tollPage.getByRole('textbox', { name: /rechercher un péage/i });
  const results = tollPage.locator('.toll-reference-results');

  await expect(tollPage.locator('.toll-admin-marker-host')).not.toHaveCount(0);
  const displayedVehicles = await tabs.getByRole('button').count();
  expect(displayedVehicles).toBe(vehicles.length);
  const vehicleOrder = (vehicle) => {
    const name = `${vehicle.shortName ?? ''} ${vehicle.name}`.toLocaleLowerCase('fr');
    if (name.includes('sprinter')) return 0;
    if (name.includes('trafic')) return 1;
    if (name.includes('master')) return 2;
    return 3;
  };
  const orderedVehicles = [...vehicles].sort(
    (first, second) => vehicleOrder(first) - vehicleOrder(second),
  );
  const firstVehicle = orderedVehicles[0];
  const firstVehicleTag = (firstVehicle.shortName || firstVehicle.name)
    .replace(/^(?:mercedes|renault)\s+/i, '')
    .replace(/\s+(?:iii|iv)(?:\s+phase\s+\d+)?$/i, '');
  await expect(tabs.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');

  await search.fill(testTag);
  await expect(results.locator('.toll-reference-result')).toHaveCount(3);
  await expect(map.locator('.toll-admin-marker-host')).toHaveCount(3);
  await search.fill(regionA);
  await expect(results.locator('.toll-reference-result')).toHaveCount(1);
  await expect(tollRow(apiPointA.name)).toBeVisible();
  await expect(map.locator('.toll-admin-marker-host')).toHaveCount(1);
  await search.fill('aucun résultat de péage');
  await expect(tollPage.locator('.toll-reference-empty')).toBeVisible();
  await expect(results.locator('.toll-reference-result')).toHaveCount(0);
  await search.clear();

  await tollPage
    .locator('.toll-reference-axis-list')
    .getByRole('button', { name: new RegExp(axisA) })
    .click();
  await expect(results.locator('.toll-reference-result')).toHaveCount(2);
  await expect(map.locator('.toll-admin-marker-host')).toHaveCount(2);
  await tollPage.getByRole('button', { name: /tout afficher/i }).click();
  await expect(map.locator('.toll-admin-marker-host')).not.toHaveCount(0);

  await search.fill(testTag);
  await expect(results.locator('.toll-reference-result')).toHaveCount(3);
  await tollRow(apiPointA.name).click();
  const editor = tollPage.locator('.toll-reference-editor');
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('Nom du péage')).toHaveValue(apiPointA.name);
  const firstVehiclePrice = vehiclePrices[firstVehicle.id];
  await expect(editor.locator('.toll-reference-price-summary')).toContainText(
    `${priceText(firstVehiclePrice)} FCFA`,
  );
  await expect(editor.locator('.toll-reference-price-summary')).toContainText(
    `Aller-retour ${priceText(firstVehiclePrice * 2)} FCFA`,
  );

  const updatedName = `Péage modifié ${testTag}`;
  const updatedRegion = `Région modifiée ${testTag}`;
  const updatedAxis = `Axe modifié ${testTag}`;
  const updatedPrice = 4321;
  await editor.getByLabel('Nom du péage').fill(updatedName);
  await editor.getByLabel('Prix SPRINTER').fill(String(updatedPrice));
  await editor.getByLabel('Axe routier').fill(updatedAxis);
  await editor.getByLabel('Région').fill(updatedRegion);
  await expect
    .poll(() => data.db.pointPeage.findUnique({ where: { id: apiPointA.id } }))
    .toMatchObject({
      nom: updatedName,
      region: updatedRegion,
      axe: updatedAxis,
      tarifsVehicules: { sprinter: updatedPrice },
    });
  await expect(editor.locator('.toll-reference-price-summary')).toContainText(
    `Aller-retour ${priceText(updatedPrice * 2)} FCFA`,
  );

  const secondVehicle = orderedVehicles[1];
  const secondVehicleTag = (secondVehicle.shortName || secondVehicle.name)
    .replace(/^(?:mercedes|renault)\s+/i, '')
    .replace(/\s+(?:iii|iv)(?:\s+phase\s+\d+)?$/i, '');
  const secondPrice = vehiclePrices[secondVehicle.id];
  await tabs.getByRole('button', { name: secondVehicleTag }).click();
  await expect(tabs.getByRole('button', { name: secondVehicleTag })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(editor.locator('.toll-reference-price-summary')).toContainText(
    `${priceText(secondPrice)} FCFA`,
  );
  await tabs.getByRole('button', { name: firstVehicleTag }).click();
  await expect(tabs.getByRole('button', { name: firstVehicleTag })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(editor.locator('.toll-reference-price-summary')).toContainText(
    `${priceText(updatedPrice)} FCFA`,
  );
  await editor.getByRole('button', { name: /fermer/i }).click();
  await expect(editor).toHaveCount(0);
  await expect(tollRow(updatedName).locator('b')).toHaveText(priceText(updatedPrice));
  await tollRow(updatedName).click();
  await expect(editor).toBeVisible();

  await editor.getByRole('link', { name: /google maps/i }).evaluate((link) => {
    const href = link.href;
    if (!href.includes('query=')) throw new Error('Lien Google Maps sans coordonnées.');
  });
  await editor.getByRole('button', { name: /fermer/i }).click();
  await expect(editor).toHaveCount(0);
  const coordinateRecord = await data.db.pointPeage.findUniqueOrThrow({
    where: { id: apiPointA.id },
  });
  const pointMarker = map.locator(`.leaflet-marker-icon[title="${updatedName}"]`);
  const markerBadge = pointMarker.locator('.toll-admin-marker-price');
  const markerBox = await markerBadge.boundingBox();
  expect(markerBox).not.toBeNull();
  expect(markerBox.width).toBeGreaterThan(0);
  expect(markerBox.height).toBeGreaterThan(0);
  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    markerBox.x + markerBox.width / 2 + 35,
    markerBox.y + markerBox.height / 2 + 24,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await expect
    .poll(async () => {
      const moved = await data.db.pointPeage.findUniqueOrThrow({ where: { id: apiPointA.id } });
      return (
        Math.abs(moved.latitude - coordinateRecord.latitude) +
        Math.abs(moved.longitude - coordinateRecord.longitude)
      );
    })
    .toBeGreaterThan(0.0001);

  await search.clear();
  const mapPointCountBefore = await data.db.pointPeage.count();
  const blankSpot = await findBlankMapSpot(map);
  await page.mouse.click(blankSpot.x, blankSpot.y);
  await expect(editor).toBeVisible();
  const newlyAdded = await data.db.pointPeage.findFirst({
    where: { nom: 'Nouveau péage', creeLe: { gte: startedAt } },
    orderBy: { creeLe: 'desc' },
  });
  expect(newlyAdded).not.toBeNull();
  uiPointId = newlyAdded.id;
  testTollIds.push(uiPointId);
  expect(await data.db.pointPeage.count()).toBe(mapPointCountBefore + 1);
  const uiEditor = tollPage.locator('.toll-reference-editor');
  await uiEditor.getByLabel('Nom du péage').fill(uiPointName);
  await uiEditor.getByLabel('Prix SPRINTER').fill('7654');
  await uiEditor.getByLabel('Axe routier').fill(`Axe carte ${testTag}`);
  await uiEditor.getByLabel('Région').fill(`Région carte ${testTag}`);
  await expect
    .poll(() => data.db.pointPeage.findUnique({ where: { id: uiPointId } }))
    .toMatchObject({
      nom: uiPointName,
      region: `Région carte ${testTag}`,
      axe: `Axe carte ${testTag}`,
      tarifsVehicules: { sprinter: 7654 },
    });

  await uiEditor.getByRole('button', { name: /fermer/i }).click();
  await expect(uiEditor).toHaveCount(0);
  await search.fill(uiPointName);
  await expect(tollRow(uiPointName)).toBeVisible();
  await tollRow(uiPointName).click();
  await expect(uiEditor.getByLabel('Nom du péage')).toHaveValue(uiPointName);
  await page.reload();
  await expect(tollPage).toBeVisible();
  await search.fill(uiPointName);
  await tollRow(uiPointName).click();
  await expect(uiEditor.getByLabel('Nom du péage')).toHaveValue(uiPointName);
  expect(
    (await data.db.pointPeage.findUniqueOrThrow({ where: { id: uiPointId } })).tarifsVehicules,
  ).toMatchObject({ sprinter: 7654 });

  await uiEditor.getByRole('button', { name: /supprimer/i }).click();
  let confirmation = page.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: /annuler/i }).click();
  await expect(confirmation).toHaveCount(0);
  expect(await data.db.pointPeage.findUnique({ where: { id: uiPointId } })).not.toBeNull();
  await uiEditor.getByRole('button', { name: /supprimer/i }).click();
  confirmation = page.getByRole('dialog');
  await confirmation.getByRole('button', { name: /supprimer/i }).click();
  await expect(confirmation).toHaveCount(0);
  await expect.poll(() => data.db.pointPeage.findUnique({ where: { id: uiPointId } })).toBeNull();
  await expect(tollRow(uiPointName)).toHaveCount(0);

  await search.clear();
  await page.reload();
  await expect(tollPage).toBeVisible();
  await expect(map).toBeVisible();
  await expect.poll(() => map.locator('.toll-admin-marker-host').count()).toBeGreaterThan(0);
  await page.screenshot({ path: output + 'admin-tolls-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(map).toBeVisible();
    const mapSize = await map.evaluate((element) => ({
      width: element.clientWidth,
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
    }));
    expect(mapSize.width).toBeGreaterThan(0);
    expect(mapSize.left).toBeGreaterThanOrEqual(0);
    expect(mapSize.right).toBeLessThanOrEqual(width);
    await page.screenshot({ path: output + `admin-tolls-mobile-${width}.png`, fullPage: true });
  }

  expect(pageErrors).toEqual([]);
  console.log(
    'Péages admin : accès, validation API, carte, ajout au clic, axes/recherche, tarif par véhicule et aller-retour, édition persistée, déplacement, lien Maps, confirmation/suppression, rechargement et responsive vérifiés.',
  );
} finally {
  await browser.close();
  try {
    const cleanupRows = await data.db.pointPeage.findMany({
      where: { id: { notIn: baselineTollIds }, creeLe: { gte: startedAt } },
      select: { id: true },
    });
    const cleanupIds = [...new Set([...testTollIds, ...cleanupRows.map((row) => row.id)])];
    if (cleanupIds.length)
      await data.db.pointPeage.deleteMany({ where: { id: { in: cleanupIds } } });
    await deleteScenarioData(data, routeIds);
    const [remainingTollPoints, remainingUsers, remainingBookings, remainingRoutes] =
      await Promise.all([
        cleanupIds.length ? data.db.pointPeage.count({ where: { id: { in: cleanupIds } } }) : 0,
        data.testUserIds.length
          ? data.db.utilisateur.count({ where: { id: { in: data.testUserIds } } })
          : 0,
        data.testUserIds.length
          ? data.db.reservation.count({ where: { utilisateurId: { in: data.testUserIds } } })
          : 0,
        routeIds.length ? data.db.itineraire.count({ where: { id: { in: routeIds } } }) : 0,
      ]);
    if (remainingTollPoints || remainingUsers || remainingBookings || remainingRoutes) {
      console.error(
        `Nettoyage Péages incomplet : ${remainingTollPoints} péage(s), ${remainingUsers} compte(s), ${remainingBookings} réservation(s), ${remainingRoutes} itinéraire(s) restant(s).`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        'Nettoyage Péages confirmé : points de péage, comptes et itinéraires de test supprimés.',
      );
    }
  } finally {
    await data.db.$disconnect();
  }
}
