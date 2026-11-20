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
  { id: 'mover-1', userId: null, name: 'Aminata Diop', phone: '770000002', photo: null, active: true, vehicleId: null, role: 'manoeuvre' },
  { id: 'mover-2', userId: null, name: 'Moussa Fall', phone: '770000003', photo: null, active: true, vehicleId: null, role: 'manoeuvre' },
];

const storedPrice = {
  lines: [
    {
      label: 'Transport Sprinter · moins de 15 km (chargement et déchargement)',
      quantity: 5,
      unitPrice: 28_000,
      total: 140_000,
    },
    { label: 'Manœuvre', quantity: 3, unitPrice: 6_500, total: 19_500 },
  ],
  total: 159_500,
  discount: 0,
  tier: 0,
  trips: 5,
  currency: 'XOF',
};
const savedQuote = {
  id: 'saved-quote-id',
  reference: 'DV-ROTATIONS',
  kind: 'provisional',
  createdAt: '2026-11-20T09:00:00.000Z',
  price: storedPrice,
  notes: '',
  options: { labour: 3, desk: 0, wardrobe: 0, bed: 0 },
  pricingInput: {
    settings: {
      distanceBounds: settings.distanceBounds,
      maxTrips: settings.maxTrips,
      maxOptions: settings.maxOptions,
      labourPrice: settings.labourPrice,
      labourFloorPrice: settings.labourFloorPrice,
      labourLiftPrice: settings.labourLiftPrice,
      assemblyPrice: settings.assemblyPrice,
      montageP: settings.montageP,
      movingLaborPlanning: settings.movingLaborPlanning,
    },
    trips: 5,
    calcMode: 'auto',
    legMinutes: 0,
    customPrice: null,
    discount: 0,
    discountType: 'fcfa',
    discountReason: '',
    options: { labour: 3, desk: 0, wardrobe: 0, bed: 0 },
    labourUnitPriceOverride: null,
    extraLines: [],
    customLines: [],
    taxiFeeAmount: 0,
    taxiFeeApplied: false,
    taxiRoundTripAmountOverride: null,
    taxiPerLegAmountOverride: null,
    taxiCompanyApproachAmountOverride: null,
    billingMode: 'complete',
    menuIncluded: false,
    overtimeMinutes: 0,
    manoeuvreOvertimePersonIds: [],
    manoeuvreOvertimeAdditionalPeople: 0,
  },
};
let booking = {
  id: 'saved-booking-id',
  reference: 'DEM-ROTATIONS',
  userId: 'visual-admin',
  customerName: draft.customerName,
  phone: draft.customerPhone,
  vehicle: vehicles[0],
  fromAddress: draft.fromAddress,
  toAddress: draft.toAddress,
  from: draft.from,
  to: draft.to,
  distanceKm: 12,
  date: draft.date,
  month: draft.month,
  timeSlot: draft.timeSlot,
  options: { labour: 3, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  status: 'pending',
  pricingSettings: settings,
  estimate: { ...storedPrice, trips: 1 },
  quotes: [savedQuote],
  createdAt: '2026-11-20T09:00:00.000Z',
  version: 1,
  inventorySnapshot: {
    sourceInventory: draft.inventory,
    dwellingType: 'Appartement',
    annexIncluded: false,
    annexVolumeM3: 0,
    fromFloor: 0,
    toFloor: 0,
    fromLift: false,
    toLift: false,
    ready: '',
    stairs: '',
    flags: [],
    items: [],
    itemCount: 1,
    totalVolumeM3: 30,
    vehicleCapacityM3: 14,
    fillRate: 214,
    estimatedTrips: 3,
    moverCount: 3,
    dismantle: true,
  },
};

const apiCalls = [];
const mutations = [];
const pageErrors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: '<html>mock whatsapp</html>' }));
const page = await context.newPage();
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.text().includes('QUOTE_DIRTY')) console.log(message.text());
});
page.on('requestfailed', (request) => {
  if (!request.url().includes('google.com/vt')) pageErrors.push(`${request.url()} ${request.failure()?.errorText}`);
});
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\/api/u, '');
  apiCalls.push(`${request.method()} ${path}`);
  if (!['GET', 'HEAD'].includes(request.method())) mutations.push(`${request.method()} ${path}`);
  let body = [];
  if (path === '/auth/me') body = user;
  else if (path === '/catalogue') body = catalogue;
  else if (path === '/toll-points') body = [];
  else if (path === '/admin/quote-draft') body = { draft: savedDraft };
  else if (path === '/admin/clients' || path === '/admin/clients/hidden') body = [];
  else if (path.startsWith('/bookings/') && request.method() === 'GET') body = booking;
  else if (path === '/bookings') body = [];
  else if (path.startsWith('/bookings/') && request.method() === 'GET') body = booking;
  else if (path === '/admin/accounting/configuration') body = accounting;
  else if (path === '/admin/drivers') body = employees;
  else if (path === '/admin/accounting') body = [];
  else if (path === '/notifications') body = { items: [], unreadCount: 0 };
  else if (path === '/admin/google-maps-key') body = '';
  else if (path === '/maps/route') {
    const { from, to } = request.postDataJSON();
    body = {
      id: `reload-route-${apiCalls.length}`,
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
    body = calculatePrice(vehicle, settings, input.distanceKmOverride ?? 12, input.options, input.trips ?? 1, null, 0, [], input.workAccess, null, 'fcfa', '', input.workDate);
  } else if (path === `/bookings/${booking.id}/quotes/${savedQuote.id}/kind` && request.method() === 'PATCH') {
    const { kind } = request.postDataJSON();
    const quote = { ...booking.quotes[0], kind };
    booking = { ...booking, status: kind === 'final' ? 'completed' : 'pending', version: booking.version + 1, quotes: [quote] };
    body = booking;
  }
  if (path === '/admin/quote-draft' && request.method() !== 'GET') {
    await route.fulfill({ status: 204 });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

try {
  const baseUrl = 'http://127.0.0.1:5174';
  await page.goto(`${baseUrl}/admin/creer-un-devis?modifier=${booking.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 10_000 });
  const transportLine = page.locator('.admin-quote-paper-line').filter({ hasText: /Transport Sprinter/i }).first();
  await expect(transportLine).toContainText(/5\s*[×x]/u);
  await expect(transportLine).toContainText('140');
  const tripsSummary = page.locator('button[data-step="3"] small');
  await expect(tripsSummary).toContainText(/5 chargements et déchargements/u);
  for (const step of [2, 3, 4, 5]) {
    await page.locator(`button[data-step="${step}"]`).click();
    await expect(transportLine).toContainText(/5\s*[×x]/u);
    await expect(transportLine).toContainText('140');
  }
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  await expect(transportLine).toContainText(/5\s*[×x]/u);
  await expect(transportLine).toContainText('140');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.admin-quote-paper-line').filter({ hasText: /Transport Sprinter/i }).first()).toContainText(/5\s*[×x]/u);
  await expect(page.locator('button[data-step="3"] small')).toContainText(/5 chargements et déchargements/u);

  await page.locator('.admin-quote-save-bar-submit').click();
  await expect(page.getByText(/aucun montant ni nombre de rotations n’a été recalculé/i)).toBeVisible();
  assert.equal(mutations.some((entry) => entry.startsWith('POST /bookings') || entry.includes('/quotes')), false, 'Enregistrer sans changement ne doit pas écrire un nouveau devis.');

  const popupPromise = page.waitForEvent('popup');
  await page.locator('.admin-quote-action-whatsapp').click();
  const popup = await popupPromise;
  await popup.waitForURL(/wa\.me/u, { timeout: 10_000 });
  assert.equal(mutations.some((entry) => entry.startsWith('POST /bookings') || entry.includes('/quotes')), false, 'WhatsApp sans changement doit partager le devis enregistré sans recalcul.');

  if ((await page.locator('button[data-step="4"]').getAttribute('aria-expanded')) !== 'true') await page.locator('button[data-step="4"]').click();
  const stages = page.locator('.admin-quote-stage-selector button');
  await stages.nth(1).click();
  await page.locator('.admin-quote-save-bar-submit').click();
  await expect.poll(() => mutations.filter((entry) => entry.includes('/kind')).length).toBe(1);
  assert.equal(mutations.some((entry) => entry.includes('/quote-stage')), false, 'Un changement de statut seul ne doit pas recalculer le prix.');
  await expect(page.locator('button[data-step="3"] small')).toContainText(/5 chargements et déchargements/u);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#admin-quote-form')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.admin-quote-paper-line').filter({ hasText: /Transport Sprinter/i }).first()).toContainText(/5\s*[×x]/u);
  await expect(page.locator('.admin-quote-paper-line').filter({ hasText: /Transport Sprinter/i }).first()).toContainText('140');
  await expect(page.locator('button[data-step="3"] small')).toContainText(/5 chargements et déchargements/u);
  await expect(page.getByText(/réservation est clôturée/i)).toHaveCount(0);
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ storedRotations: storedPrice.trips, displayedRotations: await tripsSummary.innerText(), mutations, apiCalls, browserErrors: pageErrors }, null, 2));
} finally {
  await browser.close();
}
