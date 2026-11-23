import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const origin = 'https://www.demenagexpresspro.com';
const env = dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url)));
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

function normalizedLabel(label) {
  return label
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/giu, 'oe')
    .toLocaleLowerCase('fr-FR');
}
function consolidated(lines) {
  const result = [];
  const indices = new Map();
  for (const line of lines) {
    const key = normalizedLabel(line.label);
    if (!indices.has(key)) {
      indices.set(key, result.length);
      result.push({ ...line });
    } else {
      const existing = result[indices.get(key)];
      existing.quantity += line.quantity;
      existing.total += line.total;
    }
  }
  return result;
}
function modeOf(quote) {
  return quote.billingMode ?? quote.pricingInput?.billingMode ?? 'complete';
}

try {
  await page.goto(`${origin}/connexion`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#auth-phone').fill(process.env.ADMIN_PHONE || env.ADMIN_PHONE);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD);
  await page.locator('form button').last().click();
  await page.locator('.admin-reservations-desktop').waitFor({ state: 'visible', timeout: 30000 });

  const response = await page.evaluate(async () => {
    const result = await fetch('/api/bookings', { credentials: 'include' });
    return { status: result.status, bookings: result.ok ? await result.json() : null };
  });
  assert.equal(response.status, 200, `GET /api/bookings: ${response.status}`);
  assert.ok(
    Array.isArray(response.bookings),
    'La réponse production doit être une liste de réservations.',
  );
  const bookings = response.bookings;
  const quoteRows = bookings.flatMap((booking) =>
    (booking.quotes ?? []).map((quote) => ({ booking, quote })),
  );
  const arithmeticErrors = [];
  const duplicateLines = [];
  const standardAssembly = [];
  const tripMismatches = [];
  const modeMismatches = [];
  const overtimeMismatches = [];
  const modeCounts = {};
  const kindCounts = {};
  for (const { quote } of quoteRows) {
    const lines = quote.price?.lines ?? [];
    const total = quote.price?.total;
    const discount = quote.price?.discount ?? 0;
    const subtotal = lines.reduce((sum, line) => sum + Number(line.total ?? 0), 0);
    if (Number.isFinite(total) && Math.round(subtotal - discount) !== Math.round(total)) {
      arithmeticErrors.push({ reference: quote.reference, subtotal, discount, total });
    }
    const counts = new Map();
    for (const line of lines) {
      const label = normalizedLabel(line.label);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    if ([...counts.values()].some((count) => count > 1)) duplicateLines.push(quote.reference);
    const mode = modeOf(quote);
    modeCounts[mode] = (modeCounts[mode] ?? 0) + 1;
    kindCounts[quote.kind] = (kindCounts[quote.kind] ?? 0) + 1;
    if (
      mode === 'standard' &&
      lines.some((line) =>
        /menuisier|montage|demontage|assemblage/u.test(normalizedLabel(line.label)),
      )
    ) {
      standardAssembly.push(quote.reference);
    }
    if (
      Number.isFinite(quote.price?.trips) &&
      Number.isFinite(quote.pricingInput?.trips) &&
      quote.price.trips !== quote.pricingInput.trips
    ) {
      tripMismatches.push({
        reference: quote.reference,
        priceTrips: quote.price.trips,
        inputTrips: quote.pricingInput.trips,
      });
    }
    if (
      quote.billingMode &&
      quote.pricingInput?.billingMode &&
      quote.billingMode !== quote.pricingInput.billingMode
    ) {
      modeMismatches.push({
        reference: quote.reference,
        billingMode: quote.billingMode,
        inputMode: quote.pricingInput.billingMode,
      });
    }
    const sourceNight = (quote.pricingInput?.extraLines ?? [])
      .filter((line) => /majoration de travail de nuit/iu.test(line.label))
      .reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const storedNight = lines
      .filter((line) => /majoration de travail de nuit/iu.test(line.label))
      .reduce((sum, line) => sum + line.total, 0);
    if (sourceNight > 0 && storedNight !== sourceNight)
      overtimeMismatches.push({ reference: quote.reference, sourceNight, storedNight });
  }

  const latestByMode = new Map();
  for (const booking of bookings) {
    const quote = booking.quotes?.at(-1);
    if (quote && quote.price?.total != null && !latestByMode.has(modeOf(quote)))
      latestByMode.set(modeOf(quote), { booking, quote });
  }
  const samples = [];
  for (const mode of ['complete', 'standard', 'driver-rental']) {
    const sample = latestByMode.get(mode);
    if (!sample) continue;
    const { booking, quote } = sample;
    await page.goto(`${origin}/admin/creer-un-devis?modifier=${encodeURIComponent(booking.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.locator('#admin-quote-form').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(
      () => document.querySelector('.admin-quote-save-bar')?.innerText.includes('FCFA'),
      null,
      { timeout: 30000 },
    );
    const view = await page.evaluate(() => {
      const bar = document.querySelector('.admin-quote-save-bar')?.innerText ?? '';
      const lines = [
        ...document.querySelectorAll(
          '.admin-quote-paper-lines .admin-quote-paper-line > div > span',
        ),
      ].map((node) => node.textContent?.trim() ?? '');
      const taxi = [...document.querySelectorAll('.admin-quote-taxi-field')].map((node) =>
        node.innerText.replace(/\s+/gu, ' ').trim(),
      );
      return { bar, lines, taxi };
    });
    const expectedLines = consolidated(quote.price.lines);
    const displayLabels = view.lines.map(normalizedLabel);
    const expectedLabels = expectedLines.map((line) => normalizedLabel(line.label));
    const linesMatch = JSON.stringify(displayLabels) === JSON.stringify(expectedLabels);
    const barDigits = view.bar.replace(/\D/gu, '');
    const totalVisible = quote.price.total == null || barDigits.includes(String(quote.price.total));
    const tripsVisible = barDigits.includes(String(quote.price.trips));
    samples.push({
      mode,
      kind: quote.kind,
      reference: quote.reference,
      total: quote.price.total,
      trips: quote.price.trips,
      lineCount: displayLabels.length,
      consolidatedLineCount: expectedLabels.length,
      linesMatch,
      totalVisible,
      tripsVisible,
      taxiRotationRow: view.taxi.find((line) => line.includes('Rotations enregistrées')) ?? null,
    });
    assert.ok(
      linesMatch,
      `Les lignes affichées ne correspondent pas au snapshot ${quote.reference}`,
    );
    assert.ok(
      totalVisible,
      `Le total sauvegardé ${quote.price.total} n'est pas visible pour ${quote.reference}`,
    );
    assert.ok(
      tripsVisible,
      `Le nombre de chargements/déchargements ${quote.price.trips} n'est pas visible pour ${quote.reference}`,
    );
  }

  const taxiCandidate = quoteRows.find(
    ({ booking, quote }) =>
      booking.quotes?.at(-1)?.id === quote.id &&
      modeOf(quote) !== 'driver-rental' &&
      Number(quote.pricingInput?.taxiFeeAmount) > 0 &&
      quote.price?.total != null,
  );
  let pdfCheck = null;
  if (taxiCandidate) {
    const { booking, quote } = taxiCandidate;
    await page.goto(`${origin}/admin/creer-un-devis?modifier=${encodeURIComponent(booking.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.locator('#admin-quote-form').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(
      () =>
        document
          .querySelector('.admin-quote-taxi-field')
          ?.innerText.includes('Rotations enregistrées'),
      null,
      { timeout: 30000 },
    );
    const taxiRow = await page
      .locator('.admin-quote-taxi-field')
      .filter({ hasText: 'Rotations enregistrées' })
      .innerText();
    const expectedPaidLegs = Math.max(1, quote.price.trips * 2 - 1);
    assert.match(taxiRow, new RegExp(`${quote.price.trips} rotation`, 'u'));
    assert.match(taxiRow, new RegExp(`${expectedPaidLegs} trajet`, 'u'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Télécharger le PDF/u }).click();
    const download = await downloadPromise;
    const file = `/tmp/${download.suggestedFilename()}`;
    await download.saveAs(file);
    const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
    const pageTexts = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const content = await (await pdf.getPage(index + 1)).getTextContent();
        return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      }),
    );
    const text = pageTexts.join(' ');
    assert.ok(text.includes(quote.reference), `Référence absente du PDF ${quote.reference}`);
    assert.ok(
      text.replace(/\D/gu, '').includes(String(quote.price.total)),
      `Total sauvegardé absent du PDF ${quote.reference}`,
    );
    pdfCheck = {
      reference: quote.reference,
      rotations: quote.price.trips,
      paidTaxiLegs: expectedPaidLegs,
      total: quote.price.total,
      pdfPages: pdf.numPages,
      pdfBytes: readFileSync(file).byteLength,
    };
  }

  console.log(
    JSON.stringify(
      {
        deploymentCommit: 'dae98dacead19dcc3a838796eff52fbbe8a2e166',
        productionApiStatus: response.status,
        bookingCount: bookings.length,
        quoteCount: quoteRows.length,
        modes: modeCounts,
        kinds: kindCounts,
        arithmeticErrorCount: arithmeticErrors.length,
        arithmeticErrors: arithmeticErrors.slice(0, 10),
        tripMismatchCount: tripMismatches.length,
        tripMismatches: tripMismatches.slice(0, 10),
        modeMismatchCount: modeMismatches.length,
        modeMismatches: modeMismatches.slice(0, 10),
        overtimeMismatchCount: overtimeMismatches.length,
        overtimeMismatches: overtimeMismatches.slice(0, 10),
        duplicateLineQuoteCount: duplicateLines.length,
        duplicateLineQuotes: duplicateLines.slice(0, 10),
        standardWithAssemblyCount: standardAssembly.length,
        standardWithAssemblyQuotes: standardAssembly.slice(0, 10),
        modeUiSamples: samples,
        taxiPdfCheck: pdfCheck,
        browserPageErrors: pageErrors,
      },
      null,
      2,
    ),
  );
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  });
} finally {
  await browser.close();
}
