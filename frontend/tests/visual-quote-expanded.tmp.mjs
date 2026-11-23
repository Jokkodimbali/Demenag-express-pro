import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { blankDraft } from '../src/modules/booking/application/booking-draft.ts';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config.ts';
import { defaultAccountingFinanceConfiguration } from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import { calculatePrice } from '../../backend/src/domain/pricing/pricing.ts';
import { referenceVehiclePrices } from '../../shared/reference-tariff-defaults.ts';

const output = '/tmp/demenag-visual-results-continued';
mkdirSync(output, { recursive: true });
const settings = {
  bookingsEnabled: true,
  maxAdvanceDays: 366,
  minNoticeHours: 0,
  maxOptions: 20,
  maxTrips: 20,
  clientCancellation: true,
  cancellationNoticeHours: 0,
  enabledSlots: [
    { label: 'Matin', startHour: 8 },
    { label: 'Après-midi', startHour: 13 },
  ],
  distanceBounds: [15, 25, 35],
  labourPrice: 6500,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 7500,
  montageP: {
    salon: { local: 10000, import: 15000 },
    armoire: { local: 9000, import: 13500 },
    lit: { local: 7000, import: 10500 },
    bureau: { local: 5000, import: 7500 },
  },
  businessPhone: '+221775105104',
  whatsappPhone: '+221775105104',
  businessName: 'Demenag Express Pro',
  businessAddress: 'Dakar, Sénégal',
  businessLatitude: 14.69,
  businessLongitude: -17.44,
  businessEmail: 'contact@example.test',
  businessNinea: '012461448',
  businessRccm: 'SN.DKR.2025.A.36128',
  quoteValidityDays: 30,
  rentalOvertimeHourlyRate: 10000,
  taxiFeeEnabled: true,
  taxiFeePerKm: 300,
  rentalKitConfiguration: [],
  invoiceFooter: 'Merci pour votre confiance.',
  tiktokUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  invoiceLogo: null,
  invoiceStamp: null,
  invoiceSignature: null,
  questionnaire: [],
  movingLaborPlanning: {
    maxHandlingHours: 3,
    maxDayHours: 8,
    defaultStartHour: 8,
    maxMoversPerVehicle: 6,
    cubicMetersPerHourPerMover: 2.7,
    pauseMinutes: 30,
    teamVolumePerMover: 6,
    tripSetupMinutes: 15,
    handlingCalibration: 1,
    carryDistanceMeters: 15,
    heat: 0,
    followingTripDiscountPercent: 60,
    lowDemandDiscountPercent: 10,
    manoeuvreOvertimeHourlyRate: 500,
    fill: 85,
    fillF: 75,
  },
  customInventoryTypes: [],
  hiddenInventoryKeys: [],
};
const vehicles = [
  {
    id: 'sprinter',
    name: 'Mercedes Sprinter',
    shortName: 'Sprinter',
    volume: '~14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
    image: '/assets/sprinter-profil.png',
    interior: '/assets/sprinter-interieur.png',
    prices: [...referenceVehiclePrices.sprinter],
  },
  {
    id: 'trafic',
    name: 'Renault Trafic III',
    shortName: 'Trafic',
    volume: '~5,2 m³',
    length: '2,54 m',
    height: '1,39 m',
    width: '1,66 m',
    wheelWidth: '1,27 m',
    image: '/assets/trafic-profil.png',
    interior: '/assets/trafic-interieur.png',
    prices: [...referenceVehiclePrices.trafic],
  },
  {
    id: 'master',
    name: 'Renault Master III',
    shortName: 'Master',
    volume: '~13 m³',
    length: '3,73 m',
    height: '1,89 m',
    width: '1,76 m',
    wheelWidth: '1,38 m',
    image: '/assets/master-profil.png',
    interior: '/assets/master-interieur.png',
    prices: [...referenceVehiclePrices.master],
  },
];
const catalogue = { vehicles, settings };
const draft = blankDraft(catalogue);
draft.vehicleId = 'sprinter';
draft.customerName = 'Test visuel étendu';
draft.customerPhone = '775105104';
draft.fromAddress = 'Plateau, Dakar';
draft.toAddress = 'Colobane, Dakar';
draft.from = [14.69, -17.44];
draft.to = [14.71, -17.46];
draft.route = {
  id: 'visual-route',
  from: draft.from,
  to: draft.to,
  distanceKm: 12,
  durationMinutes: 28,
  geometry: [draft.from, draft.to],
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
draft.date = '2026-12-10';
draft.month = '2026-12';
draft.timeSlot = '18:30';
draft.options.labour = 3;
draft.inventory.crew = 3;
draft.inventory.dwellingType = 'Appartement';
draft.inventory.entries.salon = { quantity: 1, size: 5, dismantle: true };
const savedDraft = { draft, quoteConfig: defaultAdminQuoteConfig(), tollLines: [] };
const accounting = defaultAccountingFinanceConfiguration(new Date('2026-11-19T12:00:00Z'));
const user = { id: 'visual-admin', name: 'Admin visuel', phone: '770000001', role: 'admin' };
const employees = [
  {
    id: 'mover-1',
    userId: null,
    name: 'Aminata Diop',
    phone: '770000002',
    photo: null,
    active: true,
    vehicleId: null,
    role: 'manoeuvre',
  },
  {
    id: 'mover-2',
    userId: null,
    name: 'Moussa Fall',
    phone: '770000003',
    photo: null,
    active: true,
    vehicleId: null,
    role: 'manoeuvre',
  },
];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const writes = [];
const apiCalls = [];
page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
page.on('requestfailed', (request) =>
  pageErrors.push(`request failed: ${request.url()} ${request.failure()?.errorText}`),
);
page.on('console', (message) => {
  if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
});
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\/api/u, '');
  apiCalls.push(`${request.method()} ${path}`);
  if (!['GET', 'HEAD'].includes(request.method())) writes.push(`${request.method()} ${path}`);
  let body = [];
  if (path === '/auth/me') body = user;
  else if (path === '/catalogue') body = catalogue;
  else if (path === '/toll-points') body = [];
  else if (path === '/admin/quote-draft') body = { draft: savedDraft };
  else if (path === '/admin/clients' && request.method() === 'GET') body = [];
  else if (path === '/admin/clients/hidden') body = [];
  else if (path === '/bookings') body = [];
  else if (path === '/admin/accounting/configuration') body = accounting;
  else if (path === '/admin/drivers') body = employees;
  else if (path === '/admin/accounting') body = [];
  else if (path === '/notifications') body = { items: [], unreadCount: 0 };
  else if (path === '/admin/google-maps-key') body = '';
  else if (path === '/maps/route') {
    const { from, to } = request.postDataJSON();
    body = {
      id: `visual-route-${apiCalls.length}`,
      from,
      to,
      distanceKm: 4.5,
      durationMinutes: 12,
      geometry: [from, to],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  } else if (path === '/admin/estimates') {
    const input = request.postDataJSON();
    const vehicle = vehicles.find((candidate) => candidate.id === input.vehicleId) ?? vehicles[0];
    try {
      body = calculatePrice(
        vehicle,
        settings,
        input.distanceKmOverride ?? 12,
        input.options,
        input.trips ?? 1,
        null,
        0,
        [],
        input.workAccess,
        null,
        'fcfa',
        '',
        input.workDate,
      );
    } catch (error) {
      console.error('MOCK ESTIMATE ERROR', JSON.stringify({ input, error: String(error) }));
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: String(error) }),
      });
      return;
    }
  }
  if (path === '/admin/quote-draft' && request.method() !== 'GET') {
    await route.fulfill({ status: 204 });
    return;
  }
  if (path === '/admin/quotes') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

const baseUrl = 'http://127.0.0.1:5174';
try {
  const initialResponse = await page.goto(`${baseUrl}/admin/creer-un-devis`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  if (!(await page.locator('#admin-quote-form').count())) {
    console.log(
      'INITIAL DIAGNOSTIC',
      JSON.stringify(
        {
          status: initialResponse?.status(),
          url: page.url(),
          body: (await page.locator('body').innerText()).slice(0, 1800),
          apiCalls,
          pageErrors,
        },
        null,
        2,
      ),
    );
  }
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 3000 });
  const expandButton = page.getByRole('button', { name: /tout afficher|replier les étapes/i });
  if (/tout afficher/iu.test(await expandButton.innerText())) await expandButton.click();
  await expect(page.locator('.admin-quote-paper')).toBeVisible();
  await expect(page.locator('.call-inventory')).toBeVisible();
  await expect(page.locator('.admin-quote-formula-options button')).toHaveCount(3);
  if ((await page.locator('.inventory-collapse').innerText()) !== 'Réduire')
    await page.locator('.inventory-collapse').click();
  await page.locator('.call-inventory').scrollIntoViewIfNeeded();
  const salonSection = page
    .locator('.inventory-section')
    .filter({ hasText: 'Salon & séjour' })
    .first();
  if (!(await salonSection.evaluate((element) => element.open)))
    await salonSection.locator('summary').click();

  const inventoryRow = salonSection
    .locator('.inventory-row')
    .filter({ has: page.getByRole('button', { name: 'Ajouter Salon', exact: true }).first() })
    .first();
  const inventorySalonStepper = salonSection.locator(
    '.inventory-quantity button[aria-label="Ajouter Salon"]',
  );
  if (await inventorySalonStepper.count()) {
    const initialCount = Number(
      await inventorySalonStepper.locator('xpath=..').locator('output').innerText(),
    );
    await inventorySalonStepper.click();
    await expect(inventorySalonStepper.locator('xpath=..').locator('output')).toHaveText(
      String(initialCount + 1),
    );
  } else {
    assert.equal(
      await inventoryRow.count(),
      1,
      'La ligne Salon doit être présente dans l’inventaire.',
    );
  }
  const inventoryCheckbox = inventoryRow.locator('.inventory-dismantle input[type="checkbox"]');
  if (await inventoryCheckbox.count()) await inventoryCheckbox.uncheck();
  await page.locator('.call-inventory').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/quote-inventory-desktop.png` });

  const formulaButtons = page.locator('.admin-quote-formula-options button');
  const quoteKindButtons = page.locator('.admin-quote-stage-selector button');
  await quoteKindButtons.first().scrollIntoViewIfNeeded();
  const initialKindPositions = await quoteKindButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
    }),
  );
  await quoteKindButtons.nth(1).click();
  await expect(quoteKindButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const finalKindPositions = await quoteKindButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
    }),
  );
  assert.deepEqual(
    finalKindPositions,
    initialKindPositions,
    'Les boutons provisoire/final doivent garder la même position.',
  );

  await formulaButtons.nth(0).click();
  await expect(formulaButtons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.admin-quote-taxi-toggle')).toBeDisabled();
  await expect(page.locator('.admin-quote-overtime-card')).toHaveCount(0);
  await expect(page.locator('.admin-quote-rental-details')).toBeVisible();
  await page.locator('.admin-quote-reference-settings').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/quote-economic-desktop.png` });

  await formulaButtons.nth(2).click();
  await expect(formulaButtons.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.admin-quote-taxi-toggle')).toBeEnabled();
  await expect(page.locator('.admin-quote-overtime-card')).toBeVisible();

  const vehicleGroup = page.locator('.admin-quote-vehicle-choices');
  for (const [index, name] of [
    [1, 'Trafic'],
    [2, 'Master'],
    [0, 'Sprinter'],
  ]) {
    await vehicleGroup.getByRole('button').nth(index).click();
    await expect(vehicleGroup.getByRole('button').nth(index)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.admin-quote-paper-meta')).toContainText(name);
  }

  const manualButton = page.getByRole('button', { name: /^Manuel$/iu });
  const automaticButton = page.getByRole('button', { name: /^Automatique$/iu });
  await manualButton.click();
  await expect(manualButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.admin-quote-taxi-fields')).toContainText('saisies');
  await automaticButton.click();
  await expect(automaticButton).toHaveAttribute('aria-pressed', 'true');

  const taxiToggle = page.locator('.admin-quote-taxi-toggle');
  await taxiToggle.click();
  await expect(taxiToggle).toHaveAttribute('aria-pressed', 'true');
  const taxiAmount = page.locator('.admin-quote-taxi-amount input').first();
  await taxiAmount.fill('2000');
  await expect(taxiAmount).toHaveValue('2000');
  await expect(page.locator('.admin-quote-taxi-summary')).toContainText(/2[ \u202f]000/u);

  const overtimeCard = page.locator('.admin-quote-overtime-card');
  const overtimeToggle = overtimeCard.locator('.admin-quote-overtime-header button');
  if ((await overtimeToggle.getAttribute('aria-pressed')) === 'true') await overtimeToggle.click();
  await expect(overtimeToggle).toHaveAttribute('aria-pressed', 'false');
  await overtimeToggle.click();
  await expect(overtimeToggle).toHaveAttribute('aria-pressed', 'true');
  await overtimeCard.getByRole('button', { name: 'Ajouter une heure supplémentaire' }).click();
  await overtimeCard
    .getByRole('combobox', { name: /choisir un profil manœuvre/i })
    .selectOption('mover-1');
  await overtimeCard.getByLabel('Personnes non enregistrées').fill('1');
  await expect(overtimeCard.locator('.admin-quote-overtime-total')).not.toHaveText(/0 FCFA/u);
  await expect(overtimeCard.locator('.admin-quote-overtime-selected-profiles')).toContainText(
    'Aminata Diop',
  );
  await expect(
    page.locator('.admin-quote-paper-line').filter({ hasText: /Majoration de travail de nuit/i }),
  ).toHaveCount(1);
  await expect(
    page.locator('.admin-quote-paper-line').filter({ hasText: /^Manœuvre/u }),
  ).toHaveCount(1);

  await page.locator('.admin-quote-services .admin-quote-section-toggle').click();
  const addCustom = page.getByRole('button', { name: /ajouter une option facturée/i });
  await addCustom.click();
  await page
    .getByRole('textbox', { name: 'Libellé de l’option facturée' })
    .fill('Emballage renforcé');
  await page.getByRole('spinbutton', { name: 'Quantité de l’option' }).fill('3');
  await page.getByRole('spinbutton', { name: 'Prix unitaire en FCFA' }).fill('700');
  await expect(page.locator('.admin-quote-paper-lines')).toContainText('Emballage renforcé');

  const discountGroup = page.locator('.admin-quote-discount-types');
  await discountGroup.getByRole('button', { name: '%' }).click();
  const discountInput = page.getByRole('spinbutton', { name: /remise/i });
  await discountInput.fill('15');
  await expect(discountInput).toHaveValue('15');
  await expect(page.locator('.admin-quote-paper-total')).toBeVisible();

  const previewLines = page.locator('.admin-quote-paper-line');
  const previewText = await previewLines.allInnerTexts();
  assert.equal(
    previewText.filter((line) => /^Manœuvre\b/u.test(line.trim())).length,
    1,
    'L’aperçu doit contenir une seule ligne de manœuvre.',
  );
  assert.equal(
    previewText.filter((line) => /Majoration de travail de nuit/u.test(line)).length,
    1,
    'La majoration doit être une ligne distincte et unique.',
  );
  await page.locator('.admin-quote-reference-settings').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/quote-pricing-complete-desktop.png` });

  const viewportChecks = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.admin-quote-reference-settings').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${output}/quote-pricing-complete-mobile-${width}.png` });
    viewportChecks.push(
      await page.evaluate(() => {
        const save = document
          .querySelector('.admin-quote-save-bar-submit')
          ?.getBoundingClientRect();
        const bounds = document.documentElement;
        return {
          viewport: innerWidth,
          document: bounds.scrollWidth,
          saveButtonVisible: Boolean(
            save && save.width > 0 && save.left >= 0 && save.right <= innerWidth,
          ),
          saveButtonTop: save ? Math.round(save.top) : null,
          bodyHeight: bounds.scrollHeight,
        };
      }),
    );
  }
  assert.deepEqual(
    viewportChecks.map(({ viewport, document: width }) => [viewport, width]),
    [
      [390, 390],
      [320, 320],
    ],
    'Aucun débordement horizontal de page sur mobile.',
  );
  assert.ok(
    viewportChecks.every((item) => item.saveButtonVisible),
    'Le bouton Enregistrer reste entièrement visible sur mobile.',
  );
  assert.deepEqual(
    writes.filter(
      (entry) => !entry.includes('/admin/quote-draft') && !entry.includes('/maps/route'),
    ),
    [],
    'Aucune réservation ni devis réel ne doit être écrit.',
  );
  assert.deepEqual(pageErrors, [], `Erreurs navigateur: ${pageErrors.join('\n')}`);
  console.log(
    JSON.stringify(
      {
        viewportChecks,
        apiCalls,
        nonDraftWrites: writes.filter((entry) => !entry.includes('/admin/quote-draft')),
        previewLines: previewText,
        pageErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
