import { chromium, expect as baseExpect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createIntegrationContext,
  integrationHeader,
  integrationPassword,
  captureOriginalConfiguration,
} from '../../backend/tests/integration/context.ts';
import {
  deleteScenarioData,
  restoreConfiguration,
} from '../../backend/tests/integration/cleanup.ts';
import { registerScenarioUsers } from '../../backend/tests/integration/accounts.ts';
import { defaultClientQuestions } from '../src/domain/questionnaire.ts';
import { labourMatrixScenarios } from '../src/domain/labour-price.ts';

const expect = baseExpect.configure({ timeout: 20000 });

if (process.env.BROWSER_TEST_BRANCH_ID !== 'br-small-hall-b4i75gr6')
  throw new Error('Le test Paramètres doit viser uniquement la branche Neon isolée.');
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL doit viser la branche Neon isolée.');

const baseUrl = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:5174';
const output = fileURLToPath(new URL('../../.verification/', import.meta.url));
const imageAsset = fileURLToPath(new URL('../public/assets/sprinter-profil.png', import.meta.url));
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
let original;
let testVehicleId = '';
let testVehicleName = '';
let routeIds = [];

const getCatalogue = async () => {
  const response = await data.clients.first.get('/api/catalogue');
  expect(response.status).toBe(200);
  return response.body;
};
const getSettings = async () => (await getCatalogue()).settings;
const settingsRow = () => data.db.parametreApplication.findUniqueOrThrow({ where: { id: 'main' } });
try {
  original = await captureOriginalConfiguration(data.db);
  const initialCatalogue = await getCatalogue();
  const users = await registerScenarioUsers(data);
  const testDriverId = users.driverId;
  const adminLogin = await data.clients.admin
    .post('/api/auth/login')
    .set(integrationHeader)
    .send({ phone: data.phone(2), password: integrationPassword });
  expect(adminLogin.status, JSON.stringify(adminLogin.body)).toBe(200);
  const forbiddenUpdate = await data.clients.first
    .put('/api/catalogue')
    .set(integrationHeader)
    .send(initialCatalogue);
  expect(forbiddenUpdate.status).toBe(403);

  await page.goto(`${baseUrl}/connexion`);
  await page.getByLabel('Téléphone ou email administrateur').fill(data.phone(2));
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(integrationPassword);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('table', { name: /réservations/i })).toBeVisible({ timeout: 20000 });
  await page.goto(`${baseUrl}/admin/parametres`);
  const settingsPage = page.locator('.reference-settings-page');
  await expect(settingsPage).toBeVisible({ timeout: 20000 });
  const form = page.locator('.settings-form');
  const referenceBlocks = [
    form.locator('.reference-company-fields'),
    form.locator('.reference-rental-kit-card'),
    form.locator('.reference-claude-settings'),
    form.locator('.reference-quote-terms'),
    form.locator('.reference-settings-fixed-fields'),
    form.locator('.reference-settings-kicker').first(),
    form.locator('.reference-settings-scenarios'),
    form.locator('.reference-settings-google-maps'),
    form.locator('.reference-settings-whatsapp'),
  ];
  for (const block of referenceBlocks) await expect(block).toBeVisible();
  const blockPositions = await Promise.all(
    referenceBlocks.map((block) =>
      block.evaluate((element) => element.getBoundingClientRect().top),
    ),
  );
  expect(blockPositions).toEqual([...blockPositions].sort((left, right) => left - right));
  await expect(form.locator('.reference-company-fields input').first()).toHaveCSS(
    'font-size',
    '15px',
  );
  await expect(form.locator('.reference-company-fields input').first()).toHaveCSS(
    'font-weight',
    '400',
  );
  await expect(form.locator('.reference-settings-google-maps input')).toHaveCSS(
    'font-size',
    '15px',
  );
  await expect(form.locator('.reference-rental-kit-title-row').first()).toHaveCSS(
    'flex-wrap',
    'nowrap',
  );
  const publicCatalogue = await page.evaluate(async () => {
    const response = await fetch('/api/catalogue');
    return response.json();
  });
  expect(publicCatalogue.settings).not.toHaveProperty('googleMapsApiKey');
  const forbiddenMapsKey = await data.clients.first
    .get('/api/admin/google-maps-key')
    .set(integrationHeader);
  expect(forbiddenMapsKey.status).toBe(401);
  const field = (name) => form.locator(`[name="${name}"]`);
  const persistBlur = async (input, value) => {
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/catalogue') && response.request().method() === 'PUT',
    );
    await input.fill(String(value));
    await input.blur();
    const response = await save;
    expect(response.status()).toBe(200);
  };

  const sprinter = initialCatalogue.vehicles.find((vehicle) => vehicle.id === 'sprinter');
  expect(sprinter).toBeTruthy();
  const firstTierPrice = (sprinter.prices[0] ?? 0) + 137;
  await persistBlur(field('sprinter-0'), firstTierPrice);
  await expect
    .poll(
      async () =>
        (await getCatalogue()).vehicles.find((vehicle) => vehicle.id === 'sprinter')?.prices[0],
    )
    .toBe(firstTierPrice);

  const fixedPrices = { labourPrice: 1234, labourFloorPrice: 321, labourLiftPrice: 654 };
  for (const [name, value] of Object.entries(fixedPrices)) await persistBlur(field(name), value);
  await expect
    .poll(async () => {
      const row = await settingsRow();
      return [row.tarifManoeuvre, row.tarifEtageManoeuvre, row.tarifAscenseurManoeuvre];
    })
    .toEqual([1234, 321, 654]);
  const matrixCatalogue = await getCatalogue();
  const matrix = matrixCatalogue.settings.labourMatrix;
  expect(matrix.none).toHaveLength(6);
  for (const scenario of labourMatrixScenarios) {
    expect(matrix[scenario.id]).toHaveLength(6);
    for (const row of matrix[scenario.id]) expect(row).toHaveLength(6);
  }
  expect(matrix.none[0][0]).toBe(1234);
  expect(matrix.from[1][0]).toBe(1888);
  expect(matrix.to[0][1]).toBe(1888);
  expect(matrix.both[2][3]).toBe(1234 + 654 + 654);
  const scenarioButtons = form.locator('.reference-settings-scenarios button');
  await expect(scenarioButtons).toHaveCount(4);
  for (const scenario of labourMatrixScenarios) {
    await scenarioButtons.filter({ hasText: scenario.label }).click();
    await expect(scenarioButtons.filter({ hasText: scenario.label })).toHaveClass(/active/u);
    const base = matrix[scenario.id][0][0].toLocaleString('fr-FR');
    await expect(form.locator('.reference-settings-labour-row').first()).toContainText(base);
  }

  await persistBlur(field('montageP.salon.local'), 2345);
  await persistBlur(field('montageP.salon.import'), 3456);
  await persistBlur(field('montageP.salon.u'), 111);
  await persistBlur(field('montageP.salon.uI'), 222);
  await persistBlur(field('montageP.salon.sz.5.local'), 4567);
  await persistBlur(field('montageP.salon.sz.5.import'), 5678);
  await expect
    .poll(async () => (await settingsRow()).grillePrixMontage.salon)
    .toMatchObject({
      local: 2345,
      import: 3456,
      u: 111,
      uI: 222,
      sz: { 5: { local: 4567, import: 5678 } },
    });
  await persistBlur(field('montageP.custom.local'), 789);
  await persistBlur(field('montageP.custom.import'), 1184);
  await expect
    .poll(async () => (await settingsRow()).grillePrixMontage.custom)
    .toMatchObject({ local: 789, import: 1184 });

  const planningValues = {
    'movingLaborPlanning.maxHandlingHours': 3.5,
    'movingLaborPlanning.maxDayHours': 9.5,
    'movingLaborPlanning.defaultStartHour': 9,
    'movingLaborPlanning.maxMoversPerVehicle': 7,
    'movingLaborPlanning.cubicMetersPerHourPerMover': 3.1,
    'movingLaborPlanning.pauseMinutes': 40,
    'movingLaborPlanning.heat': 0,
    'movingLaborPlanning.wbgtAdj': 0.5,
  };
  for (const [name, value] of Object.entries(planningValues)) await persistBlur(field(name), value);
  await expect
    .poll(async () => (await settingsRow()).planificationManoeuvre)
    .toMatchObject({
      maxHandlingHours: 3.5,
      maxDayHours: 9.5,
      defaultStartHour: 9,
      maxMoversPerVehicle: 7,
      cubicMetersPerHourPerMover: 3.1,
      pauseMinutes: 40,
      heat: 0,
      wbgtAdj: 0.5,
    });
  const planningSection = field('movingLaborPlanning.maxHandlingHours').locator(
    'xpath=ancestor::section[contains(@class, "reference-settings-wide")]',
  );
  await expect(form.getByRole('status').last()).toContainText(
    'Les paramètres ont été enregistrés.',
  );
  const planningReset = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/catalogue') && response.request().method() === 'PUT',
  );
  await planningSection.locator('button.reference-settings-reset').click();
  expect((await planningReset).status()).toBe(200);
  await expect
    .poll(async () => (await settingsRow()).planificationManoeuvre)
    .toMatchObject({
      maxHandlingHours: 3,
      maxDayHours: 8,
      defaultStartHour: 8,
      maxMoversPerVehicle: 6,
      cubicMetersPerHourPerMover: 2.7,
      pauseMinutes: 30,
      heat: 1,
      wbgtAdj: 0,
    });

  const blanketSection = form
    .locator('.reference-settings-blanket-fields')
    .locator('xpath=ancestor::section[1]');
  await persistBlur(field('movingLaborPlanning.blanketLengthCm'), 206);
  await persistBlur(field('movingLaborPlanning.blanketWidthCm'), 182);
  await persistBlur(field('movingLaborPlanning.blanketStock'), 25);
  await expect
    .poll(async () => (await settingsRow()).planificationManoeuvre)
    .toMatchObject({
      blanketLengthCm: 206,
      blanketWidthCm: 182,
      blanketStock: 25,
    });
  await expect(form.getByRole('status').last()).toContainText(
    'Les paramètres ont été enregistrés.',
  );
  const invalidBeforeBlanketReset = await form.locator(':invalid').evaluateAll((inputs) =>
    inputs.map((input) => ({
      name: input.getAttribute('name'),
      value: input.value,
      message: input.validationMessage,
    })),
  );
  expect(invalidBeforeBlanketReset).toEqual([]);
  const blanketReset = page
    .waitForResponse(
      (response) =>
        response.url().endsWith('/api/catalogue') && response.request().method() === 'PUT',
    )
    .catch(() => null);
  await blanketSection.locator('button.reference-settings-reset').click();
  const blanketResetResponse = await blanketReset;
  expect(blanketResetResponse).not.toBeNull();
  expect(blanketResetResponse.status()).toBe(200);
  await expect
    .poll(async () => (await settingsRow()).planificationManoeuvre)
    .toMatchObject({
      blanketLengthCm: 204,
      blanketWidthCm: 184,
      blanketStock: 20,
    });
  await expect(blanketSection).toContainText('3,75 m²');

  const questionnaireToggle = form.locator('.reference-settings-questionnaire-toggle');
  const questionnairePanel = form.locator('#reference-settings-questionnaire-panel');
  await expect(questionnaireToggle).toHaveAttribute('aria-expanded', 'false');
  await questionnaireToggle.click();
  await expect(questionnaireToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(questionnairePanel).toBeVisible();
  const questionnaireRows = () =>
    questionnairePanel.locator('.reference-settings-questionnaire-row');
  const questionsBefore = await getSettings().then((settings) =>
    settings.questionnaire?.length ? settings.questionnaire : defaultClientQuestions,
  );
  expect(await questionnaireRows().count()).toBe(questionsBefore.length);
  const editedQuestionLabel = `Question test ${data.prefix}`;
  await questionnaireRows().first().locator('input[name$=".label"]').fill(editedQuestionLabel);
  await expect
    .poll(async () =>
      (await getSettings()).questionnaire?.some(
        (question) => question.label === editedQuestionLabel,
      ),
    )
    .toBe(true);
  const firstQuestionId = await questionnaireRows()
    .first()
    .locator('input[type="hidden"][name$=".id"]')
    .inputValue();
  const secondQuestionId = await questionnaireRows()
    .nth(1)
    .locator('input[type="hidden"][name$=".id"]')
    .inputValue();
  await questionnaireRows()
    .first()
    .locator('.reference-settings-questionnaire-actions button')
    .nth(1)
    .click();
  await expect
    .poll(async () =>
      (await getSettings()).questionnaire?.slice(0, 2).map((question) => question.id),
    )
    .toEqual([secondQuestionId, firstQuestionId]);
  await questionnairePanel.locator('.reference-settings-questionnaire-add').click();
  await expect
    .poll(async () => (await getSettings()).questionnaire?.length)
    .toBe(questionsBefore.length + 1);
  const addedRow = questionnaireRows().last();
  await addedRow.locator('input[name$=".label"]').fill(`Question ajoutée ${data.prefix}`);
  await expect
    .poll(async () =>
      (await getSettings()).questionnaire?.some(
        (question) => question.label === `Question ajoutée ${data.prefix}`,
      ),
    )
    .toBe(true);
  await addedRow.locator('.reference-settings-questionnaire-actions button').nth(2).click();
  await expect
    .poll(async () => (await getSettings()).questionnaire?.length)
    .toBe(questionsBefore.length);
  await questionnaireToggle.click();
  await expect(questionnairePanel).toBeHidden();

  const googleMapsInput = form.locator('.reference-settings-google-maps input');
  const googleTestKey = `settings-test-${data.prefix.replace(/\W/gu, '')}`;
  const saveMapsKey = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/admin/google-maps-key') &&
      response.request().method() === 'PUT',
  );
  await googleMapsInput.fill(googleTestKey);
  await googleMapsInput.blur();
  expect((await saveMapsKey).status()).toBe(204);
  await expect.poll(async () => (await settingsRow()).cleApiGoogleMaps).toBe(googleTestKey);
  await page.reload();
  await expect(settingsPage).toBeVisible();
  await expect(form.locator('.reference-settings-google-maps input')).toHaveValue(googleTestKey);
  const adminMapsKey = await page.evaluate(async () => {
    const response = await fetch('/api/admin/google-maps-key');
    return response.json();
  });
  expect(adminMapsKey.key).toBe(googleTestKey);

  const termsInput = field('quoteTerms');
  const termsMarker = `Clause de vérification ${data.prefix}`;
  await persistBlur(termsInput, termsMarker);
  await expect.poll(async () => (await settingsRow()).conditionsDevis).toBe(termsMarker);
  const termsToggle = form.locator('input[type="checkbox"][name="quoteTermsEnabled"]');
  const toggleSave = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/catalogue') && response.request().method() === 'PUT',
  );
  await termsToggle.uncheck();
  expect((await toggleSave).status()).toBe(200);
  await expect.poll(async () => (await settingsRow()).conditionsDevisActives).toBe(false);
  await page.reload();
  await expect(termsToggle).not.toBeChecked();
  await termsToggle.check();
  await expect.poll(async () => (await settingsRow()).conditionsDevisActives).toBe(true);

  const rentalLabel = form.locator('[name="rentalKitConfiguration.0.label"]');
  const updatedRentalLabel = `Matériel test ${data.prefix}`;
  await persistBlur(rentalLabel, updatedRentalLabel);
  await expect
    .poll(async () => (await settingsRow()).materielLocation)
    .toEqual(expect.arrayContaining([expect.objectContaining({ label: updatedRentalLabel })]));

  const businessEmail = form.locator('[name="businessEmail"]');
  await persistBlur(businessEmail, `settings-${data.prefix}@example.test`);
  await expect
    .poll(async () => (await settingsRow()).emailEntreprise)
    .toBe(`settings-${data.prefix}@example.test`);

  const whatsappNumber = form.locator('[name="w.biz"]');
  await persistBlur(form.locator('[name="w.cc"]'), '221');
  await persistBlur(whatsappNumber, '771234567');
  await form.locator('[name="w.mode"]').selectOption('web');
  await persistBlur(form.locator('[name="w.tplP"]'), `Bonjour {nom} ${data.prefix} {total}`);
  await persistBlur(form.locator('[name="w.tpl"]'), `Devis {num} ${data.prefix} {paiement}`);
  await expect.poll(async () => (await settingsRow()).numeroWhatsapp).toBe('+221771234567');
  await expect.poll(async () => (await settingsRow()).modeWhatsapp).toBe('web');
  await expect
    .poll(async () => (await settingsRow()).modeleDevisProvisoireWhatsapp)
    .toContain(data.prefix);
  await expect.poll(async () => (await settingsRow()).modeleDevisWhatsapp).toContain(data.prefix);
  const whatsappTestLink = form.locator('.reference-settings-whatsapp-test a');
  await expect(whatsappTestLink).toHaveAttribute(
    'href',
    /web\.whatsapp\.com\/send\?phone=221771234567/u,
  );
  await expect(form.locator('.reference-settings-whatsapp-preview').last()).toContainText(
    data.prefix,
  );

  const paymentPanel = form.locator('.payment-settings-panel');
  const wave = paymentPanel.locator('[name="paymentWave"]');
  const cash = paymentPanel.locator('[name="paymentCash"]');
  const setPaymentOption = async (input, fieldName, value) => {
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/catalogue') &&
        response.request().method() === 'PUT' &&
        response.request().postDataJSON()?.settings?.[fieldName] === value,
      { timeout: 30000 },
    );
    if (value) await input.check();
    else await input.uncheck();
    const response = await save;
    expect(response.status()).toBe(200);
  };
  await setPaymentOption(wave, 'paymentWave', false);
  await expect.poll(async () => (await settingsRow()).paiementWave).toBe(false);
  await expect(paymentPanel.locator('.payment-qr-panel')).toHaveCount(0);
  await setPaymentOption(cash, 'paymentCash', false);
  await expect.poll(async () => (await settingsRow()).paiementEspeces).toBe(false);
  await expect(paymentPanel.locator('.payment-settings-preview')).toContainText('Aucun mode coché');
  await setPaymentOption(wave, 'paymentWave', true);
  await expect.poll(async () => (await settingsRow()).paiementWave).toBe(true);
  await expect(form.getByRole('status').last()).toContainText(
    'Les paramètres ont été enregistrés.',
  );
  await setPaymentOption(cash, 'paymentCash', true);
  await expect.poll(async () => (await settingsRow()).paiementEspeces).toBe(true);
  await expect(form.getByRole('status').last()).toContainText(
    'Les paramètres ont été enregistrés.',
  );
  const qrInput = paymentPanel.locator('input[type="file"][name="paymentQr"]');
  const qrSaveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/catalogue') &&
      response.request().method() === 'PUT' &&
      response.request().postDataJSON()?.settings?.paymentQr?.startsWith('data:image/'),
  );
  await qrInput.setInputFiles(imageAsset);
  const qrResponse = await qrSaveResponse;
  expect(qrResponse.status(), await qrResponse.text()).toBe(200);
  await expect
    .poll(async () => (await settingsRow()).qrPaiement)
    .toMatch(/^data:image\/png;base64,/u);
  await expect(paymentPanel.locator('.payment-qr-preview')).toBeVisible();
  await expect(form.getByRole('status').last()).toContainText(
    'Les paramètres ont été enregistrés.',
  );
  const qrRemovalResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/catalogue') &&
      response.request().method() === 'PUT' &&
      response.request().postDataJSON()?.settings?.paymentQr === null,
  );
  await paymentPanel.getByText('Retirer', { exact: true }).click();
  const qrRemoval = await qrRemovalResponse;
  expect(qrRemoval.status()).toBe(200);
  expect(qrRemoval.request().postDataJSON().settings.paymentQr).toBeNull();
  const qrRemovalResult = await qrRemoval.json();
  const qrAfterRemoval = await data.db.parametreApplication.findUniqueOrThrow({
    where: { id: 'main' },
    select: { qrPaiement: true },
  });
  expect(qrRemovalResult.settings.paymentQr).toBeNull();
  expect(qrAfterRemoval.qrPaiement).toBeNull();
  await expect.poll(async () => (await settingsRow()).qrPaiement === null).toBe(true);
  await expect(paymentPanel.locator('.payment-qr-preview')).toHaveCount(0);

  const sprinterCard = form.locator('.fleet-dimension-card').filter({ hasText: sprinter.name });
  const lengthInput = sprinterCard.getByLabel(`Longueur (m) pour ${sprinter.name}`);
  const originalLength = Number.parseFloat(sprinter.length);
  await persistBlur(lengthInput, '0');
  await page.waitForTimeout(700);
  expect((await data.db.vehicule.findUniqueOrThrow({ where: { id: 'sprinter' } })).longueur).toBe(
    sprinter.length,
  );
  const updatedLength = Number((originalLength + 0.1).toFixed(2));
  await persistBlur(lengthInput, updatedLength);
  await expect
    .poll(() => data.db.vehicule.findUnique({ where: { id: 'sprinter' } }))
    .toMatchObject({ longueur: `${updatedLength} m` });

  const vehicleManagement = form.locator('.reference-settings-vehicles');
  await vehicleManagement.getByRole('button', { name: /ajouter un véhicule/i }).click();
  let vehicleDialog = page.getByRole('dialog', { name: /fiche véhicule/i });
  await expect(vehicleDialog).toBeVisible();
  const vehicleName = `Vehicule test ${data.prefix}`;
  const savedVehicleName = vehicleName.toLocaleUpperCase('fr-FR');
  testVehicleName = savedVehicleName;
  await vehicleDialog.locator('input[name="name"]').fill(vehicleName);
  await vehicleDialog.locator('input[name="shortName"]').fill('TEST');
  await vehicleDialog.locator('input[name="length"]').fill('5.2');
  await vehicleDialog.locator('input[name="height"]').fill('2.4');
  await vehicleDialog.locator('input[name="width"]').fill('2.1');
  await vehicleDialog.locator('input[name="wheelWidth"]').fill('1.4');
  await vehicleDialog.getByRole('button', { name: /enregistrer/i }).click();
  await expect(vehicleDialog.getByRole('alert')).toContainText(/importez la photo/i);
  expect((await getCatalogue()).vehicles.some((vehicle) => vehicle.name === savedVehicleName)).toBe(
    false,
  );
  const photoInputs = vehicleDialog.locator('.vehicle-photo-editor input[type="file"]');
  await photoInputs.nth(0).setInputFiles(imageAsset);
  await photoInputs.nth(1).setInputFiles(imageAsset);
  await vehicleDialog.getByRole('button', { name: /enregistrer/i }).click();
  await expect(vehicleDialog).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await getCatalogue()).vehicles.find((vehicle) => vehicle.name === savedVehicleName)?.id,
    )
    .toBeTruthy();
  const customVehicle = (await getCatalogue()).vehicles.find(
    (vehicle) => vehicle.name === savedVehicleName,
  );
  expect(customVehicle).toBeTruthy();
  testVehicleId = customVehicle.id;
  expect(customVehicle.name).toBe(savedVehicleName);
  const savedCustomVehicle = await data.db.vehicule.findUniqueOrThrow({
    where: { id: testVehicleId },
  });
  expect(savedCustomVehicle.longueur).toBe('5.2');
  expect(savedCustomVehicle.image).toMatch(/^data:image\/webp;base64,/u);
  expect(savedCustomVehicle.interieur).toMatch(/^data:image\/webp;base64,/u);

  const customCard = () =>
    vehicleManagement
      .locator('.reference-settings-custom-vehicle')
      .filter({ has: page.getByRole('img', { name: `Profil ${savedVehicleName}`, exact: true }) });
  await customCard()
    .getByRole('button', { name: /modifier/i })
    .click();
  vehicleDialog = page.getByRole('dialog', { name: /fiche véhicule/i });
  await expect(vehicleDialog).toBeVisible();
  await vehicleDialog.locator('input[name="shortName"]').fill('TST2');
  await vehicleDialog.locator('input[name="length"]').fill('5.4');
  await vehicleDialog.getByRole('button', { name: /enregistrer/i }).click();
  await expect(vehicleDialog).toHaveCount(0);
  await expect
    .poll(async () =>
      (await getCatalogue()).vehicles.find((vehicle) => vehicle.id === testVehicleId),
    )
    .toMatchObject({ shortName: 'TST2', length: '5.4' });

  await data.db.chauffeur.update({
    where: { id: testDriverId },
    data: { vehiculeId: testVehicleId },
  });
  await customCard()
    .getByRole('button', { name: /supprimer/i })
    .click();
  let vehicleConfirmation = page.getByRole('dialog');
  await expect(vehicleConfirmation).toBeVisible();
  await vehicleConfirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(vehicleConfirmation.getByRole('alert')).toContainText(
    /membre de l’équipe est affecté/i,
    { timeout: 25000 },
  );
  expect(await data.db.vehicule.findUnique({ where: { id: testVehicleId } })).not.toBeNull();
  await vehicleConfirmation.getByRole('button', { name: /annuler/i }).click();
  await data.db.chauffeur.update({ where: { id: testDriverId }, data: { vehiculeId: 'sprinter' } });
  await page.reload();
  await expect(page.locator('.reference-settings-page')).toBeVisible();
  const refreshedVehicleCard = () =>
    page
      .locator('.reference-settings-custom-vehicle')
      .filter({ has: page.getByRole('img', { name: `Profil ${savedVehicleName}`, exact: true }) });
  await refreshedVehicleCard()
    .getByRole('button', { name: /supprimer/i })
    .click();
  vehicleConfirmation = page.getByRole('dialog');
  await vehicleConfirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(vehicleConfirmation).toHaveCount(0, { timeout: 25000 });
  await expect.poll(() => data.db.vehicule.findUnique({ where: { id: testVehicleId } })).toBeNull();

  await page.reload();
  await expect(settingsPage).toBeVisible();
  await expect(field('sprinter-0')).toHaveValue(String(firstTierPrice));
  await expect(field('labourPrice')).toHaveValue('1234');
  await expect(field('w.biz')).toHaveValue('771234567');
  await expect(field('w.mode')).toHaveValue('web');
  await expect(paymentPanel.locator('[name="paymentWave"]')).toBeChecked();
  await expect(paymentPanel.locator('[name="paymentCash"]')).toBeChecked();
  await expect
    .poll(async () =>
      (await getSettings()).questionnaire?.some(
        (question) => question.label === editedQuestionLabel,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: output + 'admin-settings-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await form
        .locator('.reference-settings-size-card > span')
        .evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth)),
    ).toBe(true);
    await expect(settingsPage).toBeVisible();
    await page.screenshot({ path: output + `admin-settings-mobile-${width}.png`, fullPage: true });
  }

  const invalidPayload = await getCatalogue();
  invalidPayload.settings.labourPrice = -1;
  const invalidSettings = await data.clients.admin
    .put('/api/catalogue')
    .set(integrationHeader)
    .send(invalidPayload);
  expect(invalidSettings.status).toBe(400);
  expect((await settingsRow()).tarifManoeuvre).toBe(1234);
  expect(pageErrors).toEqual([]);
  console.log(
    'Paramètres admin : accès et refus non-admin, ordre et style des nouveautés de référence, identité PDF, conditions activables et persistées, matériel fourni, tarifs véhicule, matrices, planification, questionnaire pliable, dimensions, véhicules, paiement, WhatsApp, clé Maps séparée du catalogue public et sauvegardée en base, rechargement, responsive et validation API vérifiés.',
  );
} finally {
  await page.waitForTimeout(1000).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await browser.close();
  try {
    if (!testVehicleId && testVehicleName) {
      const createdVehicle = await data.db.vehicule.findFirst({
        where: { nom: testVehicleName },
        select: { id: true },
      });
      testVehicleId = createdVehicle?.id ?? '';
    }
    if (testVehicleId) {
      await data.db.chauffeur.updateMany({
        where: { vehiculeId: testVehicleId },
        data: { vehiculeId: 'sprinter' },
      });
      await data.db.vehicule.deleteMany({ where: { id: testVehicleId } });
    }
    if (original) {
      await restoreConfiguration(data, original);
      await data.db.vehicule.update({
        where: { id: original.vehicle.id },
        data: { longueur: original.vehicle.longueur },
      });
    }
    await deleteScenarioData(data, routeIds);
  } finally {
    await data.db.$disconnect();
  }
}
