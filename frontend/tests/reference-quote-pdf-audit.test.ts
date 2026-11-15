import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { jsPDF } from 'jspdf';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { downloadQuote } from '../src/modules/admin/quotes/adapters/quote-pdf';
import type { Booking, Quote, Settings } from '../src/modules/shared/domain/model';

const html = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);
type ReferenceInstance = {
  state: unknown;
  loadPdf: () => Promise<typeof jsPDF>;
  logoData: () => Promise<null>;
  imgData: () => Promise<null>;
  calc: () => unknown;
  pdfBuild: (quote: unknown, kind: string) => Promise<void>;
};
const start = html.indexOf('class Component extends DCLogic {');
const end = html.indexOf('</script>', start);
assert.ok(start >= 0 && end > start);
let referenceBlob: Blob | undefined;
const context = vm.createContext({
  DCLogic: class {},
  console,
  Date,
  Math,
  Set,
  Map,
  Intl,
  URL: {
    createObjectURL(blob: Blob) {
      referenceBlob = blob;
      return 'blob:test';
    },
    revokeObjectURL() {},
  },
  document: {
    createElement() {
      return { click() {}, remove() {} };
    },
    body: { appendChild() {} },
  },
  setTimeout() {},
  window: {},
});
vm.runInContext(
  `${html.slice(start, end).replace('state = this.init();', 'state = {};')}\nglobalThis.ReferenceComponent = Component;`,
  context,
  { timeout: 10000 },
);

async function pdfText(blob: Blob) {
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages;
}

async function pdfItems(blob: Blob) {
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const result: { str: string; x: number; y: number }[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    result.push(
      content.items.flatMap((item) =>
        'str' in item && item.str.trim()
          ? [
              {
                str: item.str,
                x: item.transform[4] / 2.83465,
                y: (page.view[3] - item.transform[5]) / 2.83465,
              },
            ]
          : [],
      ),
    );
  }
  return result;
}

test('audit PDF final référence et application sur le même devis', async () => {
  const reference = new (
    context as unknown as { ReferenceComponent: new () => ReferenceInstance }
  ).ReferenceComponent();
  reference.state = {
    data: {
      res: [],
      company: { addr: 'Dakar, Sénégal', tel: '+221770000001', valid: 15, acompte: 20 },
      pay: { wave: false, cash: false },
      cgOff: true,
    },
  };
  reference.loadPdf = async () => jsPDF;
  reference.logoData = async () => null;
  reference.imgData = async () => null;
  reference.calc = () => ({
    lines: [
      { label: 'Transport Sprinter', qty: 2, pu: 50000, amount: 100000 },
      { label: 'Manœuvre', qty: 2, pu: 8000, amount: 16000 },
      { label: 'Protection spéciale', qty: 1, pu: 4000, amount: 4000 },
    ],
    tier: 1,
    unit: 50000,
    total: 108000,
    remise: 12000,
    remLbl: 'Remise · Test devis',
    tolls: [{ label: 'Péage Test · Aller simple', qty: 2, pu: 1000, amount: 2000 }],
    tollTot: 2000,
    loc: false,
  });
  const legacy = {
    ref: 'DV-2026-TEST',
    name: 'Client de test',
    phone: '+221770000000',
    date: '2026-11-10',
    time: '09:00',
    from: 'Dakar, Point A',
    to: 'Dakar, Point B',
    km: 20,
    trips: 2,
    vehicle: 'sprinter',
    notes: 'Inventaire et accès confirmés',
  };
  referenceBlob = undefined;
  await reference.pdfBuild(legacy, 'final');
  assert.ok(referenceBlob);

  const booking = {
    id: 'booking-test',
    reference: legacy.ref,
    customerName: legacy.name,
    phone: legacy.phone,
    vehicle: { id: 'sprinter', name: 'Mercedes Sprinter', shortName: 'Sprinter' },
    fromAddress: legacy.from,
    toAddress: legacy.to,
    distanceKm: legacy.km,
    date: legacy.date,
    timeSlot: legacy.time,
    notes: legacy.notes,
    createdAt: '2026-11-13T00:00:00.000Z',
  } as Booking;
  const quote = {
    id: 'quote-test',
    reference: legacy.ref,
    kind: 'final',
    createdAt: booking.createdAt,
    notes: legacy.notes,
    price: {
      lines: [
        { label: 'Transport Sprinter', quantity: 2, unitPrice: 50000, total: 100000 },
        { label: 'Manœuvre', quantity: 2, unitPrice: 8000, total: 16000 },
        { label: 'Protection spéciale', quantity: 1, unitPrice: 4000, total: 4000 },
      ],
      total: 108000,
      discount: 12000,
      discountLabel: 'Remise · Test devis',
      tier: 1,
      trips: 2,
      currency: 'XOF',
    },
    tolls: [
      { tollPointId: 'test', label: 'Péage Test · Aller simple', quantity: 2, unitPrice: 1000 },
    ],
  } as Quote;
  const settings = {
    businessName: 'DEMENAG EXPRESS PRO MTH',
    businessAddress: 'Dakar, Sénégal',
    businessPhone: '+221770000001',
    distanceBounds: [15, 25, 35],
    paymentWave: false,
    paymentCash: false,
    quoteTermsEnabled: false,
    bookingDepositPercent: 20,
    quoteValidityDays: 15,
    invoiceLogo:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=',
    invoiceStamp:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=',
    invoiceSignature:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=',
  } as Settings;
  const legacyPages = await pdfText(referenceBlob);
  const appBlob = await downloadQuote(booking, quote, settings);
  const appPages = await pdfText(appBlob);
  const legacyItems = await pdfItems(referenceBlob);
  const appItems = await pdfItems(appBlob);
  assert.equal(appPages.length, legacyPages.length);
  for (const value of [
    'DEVIS FINAL',
    legacy.name,
    legacy.from,
    legacy.to,
    '108 000 FCFA',
    'Péage Test',
    'cent-huit-mille francs CFA',
    'Page 1 / 2',
    'Page 2 / 2',
  ]) {
    assert.ok(legacyPages.join(' ').includes(value), `référence: ${value}`);
    assert.ok(appPages.join(' ').includes(value), `application: ${value}`);
  }
  assert.ok(appPages[0]?.includes('SIGNATURE DU CLIENT'));
  assert.ok(appPages[1]?.includes('PÉAGES À LA CHARGE DU CLIENT'));

  for (const label of [
    'CLIENT',
    'DATE PRÉVUE',
    'VÉHICULE',
    'TRAJET',
    'DÉSIGNATION',
    'QTÉ',
    'P.U.',
    'MONTANT',
    'TOTAL À PAYER',
    'SIGNATURE DU CLIENT',
  ]) {
    const find = (pages: typeof legacyItems) =>
      pages.flatMap((items, pageIndex) =>
        items.filter((item) => item.str.includes(label)).map((item) => ({ ...item, pageIndex })),
      )[0];
    const ref = find(legacyItems);
    const app = find(appItems);
    assert.ok(ref, `position référence trouvée: ${label}`);
    assert.ok(app, `position application trouvée: ${label}`);
    assert.equal(app.pageIndex, ref.pageIndex, `page: ${label}`);
    assert.ok(
      Math.abs(app.x - ref.x) < 1.5,
      `abscisse ${label}: ${app.x.toFixed(2)} vs ${ref.x.toFixed(2)}`,
    );
    assert.ok(
      Math.abs(app.y - ref.y) < 2,
      `ordonnée ${label}: ${app.y.toFixed(2)} vs ${ref.y.toFixed(2)}`,
    );
  }
});
