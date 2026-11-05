import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { downloadQuote } from '../src/adapters/pdf';
import type { Booking, Quote, Settings } from '../src/domain/model';

const pixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';

const booking = {
  id: 'booking-pdf-test',
  reference: 'DE-TEST-2026',
  userId: 'user-pdf-test',
  customerName: 'Client de test',
  phone: '+221770000000',
  vehicle: { id: 'sprinter', name: 'Mercedes Sprinter', shortName: 'Sprinter' },
  fromAddress: 'Dakar, Point A',
  toAddress: 'Dakar, Point B',
  from: [14.7, -17.4],
  to: [14.72, -17.45],
  distanceKm: 20,
  date: '2026-11-10',
  timeSlot: '09:00',
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  status: 'pending',
  estimate: {
    lines: [{ label: 'Transport Sprinter', quantity: 1, unitPrice: 50_000, total: 50_000 }],
    total: 50_000,
    discount: 0,
    tier: 1,
    trips: 1,
    currency: 'XOF',
  },
  quotes: [],
  createdAt: '2026-11-03T00:00:00.000Z',
  version: 1,
} as unknown as Booking;

const settings = {
  distanceBounds: [15, 25, 35],
  businessName: 'Demenag Express Test',
  businessPhone: '+221770000001',
  whatsappPhone: '+221770000001',
  businessAddress: 'Dakar, Sénégal',
  invoiceFooter: 'Merci pour votre confiance.',
  invoiceLogo: pixel,
  invoiceStamp: pixel,
  invoiceSignature: pixel,
  paymentWave: false,
  paymentCash: false,
  paymentQr: null,
} as unknown as Settings;

async function extractPdfText(blob: Blob) {
  const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const page = await pdf.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    }),
  );
  return pages.join(' ');
}

for (const kind of ['provisional', 'final'] as const) {
  test(`le PDF ${kind} reprend les lignes, remise, total et péages du devis`, async () => {
    const quote: Quote = {
      id: `quote-${kind}-test`,
      reference: `DV-2026-${kind.toUpperCase()}`,
      kind,
      createdAt: '2026-11-03T00:00:00.000Z',
      notes: 'Inventaire et accès confirmés',
      price: {
        lines: [
          { label: 'Transport Sprinter', quantity: 2, unitPrice: 50_000, total: 100_000 },
          { label: 'Manœuvre', quantity: 2, unitPrice: 8_000, total: 16_000 },
          { label: 'Protection spéciale', quantity: 1, unitPrice: 4_000, total: 4_000 },
        ],
        total: 108_000,
        discount: 12_000,
        discountLabel: 'Remise · Test devis',
        discountType: 'fcfa',
        discountValue: 12_000,
        discountReason: 'Test devis',
        tier: 1,
        trips: 2,
        currency: 'XOF',
      },
      tolls: [
        {
          tollPointId: 'toll-test',
          label: 'Péage Test · Aller simple',
          quantity: 2,
          unitPrice: 1_000,
        },
      ],
    };

    const text = await extractPdfText(await downloadQuote(booking, quote, settings));
    assert.match(text, new RegExp(kind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE'));
    assert.match(text, /DV-2026/);
    assert.match(text, /Client de test/);
    assert.match(text, /Dakar, Point A/);
    assert.match(text, /Dakar, Point B/);
    assert.match(text, /Transport Sprinter/);
    assert.match(text, /Manoeuvre|Manœuvre/);
    assert.match(text, /Protection spéciale/);
    assert.match(text, /Remise/);
    assert.match(text, /108 000|108,000/);
    assert.match(text, /PÉAGES/);
    assert.match(text, /Péage Test/);
    assert.match(text, /2 000|2,000/);
    assert.match(text, /NON INCLUS DANS LE TOTAL/);
  });
}

test('le PDF reprend les coordonnées et applique l’activation des conditions générales', async () => {
  const quote: Quote = {
    id: 'quote-settings-test',
    reference: 'DV-2026-SETTINGS',
    kind: 'provisional',
    createdAt: '2026-11-03T00:00:00.000Z',
    price: {
      lines: [{ label: 'Transport Sprinter', quantity: 1, unitPrice: 50_000, total: 50_000 }],
      total: 50_000,
      discount: 0,
      tier: 1,
      trips: 1,
      currency: 'XOF',
    },
    tolls: [],
  };
  const clause = `Clause de contrôle PDF ${quote.reference}`;
  const pdfSettings = {
    ...settings,
    businessEmail: 'contact@example.test',
    businessNinea: 'NINEA-TEST-2026',
    businessRccm: 'RCCM-TEST-2026',
    quoteValidityDays: 21,
    bookingDepositPercent: 20,
    quoteTerms: clause,
  } as Settings;
  const enabledText = await extractPdfText(
    await downloadQuote(booking, quote, { ...pdfSettings, quoteTermsEnabled: true }),
  );
  assert.match(enabledText, /contact@example\.test/);
  assert.match(enabledText, /NINEA-TEST-2026/);
  assert.match(enabledText, /RCCM-TEST-2026/);
  assert.match(enabledText, /21 jours/);
  assert.match(enabledText, /Acompte à la réservation \(20 %\)/);
  assert.match(enabledText, new RegExp(clause));

  const disabledText = await extractPdfText(
    await downloadQuote(booking, quote, { ...pdfSettings, quoteTermsEnabled: false }),
  );
  assert.doesNotMatch(disabledText, new RegExp(clause));
});
