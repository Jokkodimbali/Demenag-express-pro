import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { downloadQuote } from '../src/modules/admin/quotes/adapters/quote-pdf';
import { defaultRentalKit } from '../src/modules/moving/domain/rental-kit';
import type {
  Booking,
  Quote,
  QuotePricingInput,
  Settings,
} from '../src/modules/shared/domain/model';

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
  assert.match(enabledText, /Acompte à la réservation : 10 000 FCFA \(20 %\)/);
  assert.match(enabledText, /Solde le jour du déménagement : 40 000 FCFA/);
  assert.match(enabledText, new RegExp(clause));

  const disabledText = await extractPdfText(
    await downloadQuote(booking, quote, { ...pdfSettings, quoteTermsEnabled: false }),
  );
  assert.doesNotMatch(disabledText, new RegExp(clause));
});

test('le PDF reprend les conditions de chargement exactes, y compris le supplément balcon', async () => {
  const quote: Quote = {
    id: 'quote-loading-conditions-test',
    reference: 'DV-2026-CONDITIONS',
    kind: 'provisional',
    createdAt: '2026-11-03T00:00:00.000Z',
    notes: [
      'CONDITIONS DE CHARGEMENT',
      '- Matériel : tout doit être emballé et prêt à charger à l’arrivée de l’équipe.',
      '- Passage : par le balcon (supplément de 25 000 FCFA inclus).',
      'Ces conditions doivent être respectées le jour du déménagement. Sinon, le déménagement n’aura pas lieu.',
    ].join('\n'),
    price: booking.estimate,
    tolls: [],
  };
  const text = await extractPdfText(await downloadQuote(booking, quote, settings));
  assert.match(text, /CONDITIONS DE CHARGEMENT/);
  assert.match(text, /Matériel : tout doit être emballé et prêt à charger à l'arrivée de l'équipe/);
  assert.match(text, /Passage : par le balcon/);
  assert.match(text, /25 000 FCFA inclus/);
  assert.match(text, /Sinon, le déménagement n'aura pas lieu/);
});

test('le PDF conserve le mois demandé lorsque la réservation est sans date précise', async () => {
  const quote: Quote = {
    id: 'quote-no-date-month-test',
    reference: 'DV-2026-MONTH',
    kind: 'provisional',
    createdAt: '2026-11-03T00:00:00.000Z',
    notes: '',
    price: booking.estimate,
    tolls: [],
  };
  const text = await extractPdfText(
    await downloadQuote({ ...booking, date: null, month: '2026-12' }, quote, settings),
  );
  assert.match(text, /décembre 2026/);
});

for (const [billingMode, expected] of [
  ['complete', 'Formule Complète'],
  ['standard', 'Formule Standard'],
  ['driver-rental', 'Formule Économique - location avec chauffeur'],
] as const) {
  test(`le PDF présente la formule ${billingMode} comme la référence`, async () => {
    const quote: Quote = {
      id: `quote-${billingMode}`,
      reference: `DV-2026-${billingMode}`,
      kind: 'provisional',
      createdAt: '2026-11-03T00:00:00.000Z',
      notes: '',
      price: booking.estimate,
      tolls: [],
      billingMode,
    };
    const text = await extractPdfText(await downloadQuote(booking, quote, settings));
    assert.ok(text.includes(expected), `${billingMode}: ${text}`);
    assert.match(text, /Émis le \d{2}\/\d{2}\/\d{4}/);
  });
}

test('le PDF du devis ajoute le plan choisi et explicite la base des volumes', async () => {
  const runtime = globalThis as typeof globalThis & { window?: Window };
  const previousWindow = runtime.window;
  runtime.window = {
    THREE: {},
    DemSim: {
      plan: () => ({
        trips: [
          {
            boxes: [],
            walls: [],
            fill: 25,
            vol: 0.5,
            nItems: 1,
            kg: 10,
            need: 1,
            stock: 2,
            straps: 2,
            checks: [],
          },
        ],
        out: [],
        V: { net: 15.5 },
      }),
      snapshot: () => null,
    },
  } as unknown as Window;
  try {
    const sourceInventory = {
      dwellingType: '',
      fromFloor: 0,
      toFloor: 0,
      fromLift: false,
      toLift: false,
      entries: {},
      variants: [],
      flags: {},
      custom: [],
      blanketLengthCm: 150,
      blanketWidthCm: 120,
    };
    const withInventory = {
      ...booking,
      vehicle: {
        ...booking.vehicle,
        length: '4.3',
        width: '1.94',
        height: '1.78',
        wheelWidth: '1.35',
        volume: '15.5',
        image: '',
        interior: '',
        prices: [0, 0, 0],
      },
      inventorySnapshot: {
        sourceInventory,
        totalVolumeM3: 0.8,
        fromFloor: 0,
        toFloor: 0,
        fromLift: false,
        toLift: false,
        estimatedTrips: 1,
        moverCount: 6,
        carpenterCount: 0,
        loadingMinutes: 10,
        unloadingMinutes: 10,
        packingMinutes: 0,
        travelMinutes: 0,
        totalMinutes: 35,
        lowDurationMinutes: 30,
        highDurationMinutes: 45,
        startTime: '08:00',
        endTime: '08:35',
        vehicleCapacityM3: 14.7,
        fillRate: 0.4,
        itemCount: 1,
        annexIncluded: false,
        annexVolumeM3: 0,
        ready: 'oui',
        stairs: 'oui',
        flags: [],
        items: [],
      },
      workPlan: [
        {
          id: 'estimate-1',
          time: '08:00',
          title: 'Arrivée et briefing',
          detail: 'Tour du logement avec le client.',
          minutes: 20,
          review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
        },
        {
          id: 'estimate-2',
          time: '08:20',
          title: 'Récupération chaleur',
          detail:
            '15 min à l’ombre et eau après 45 min de portage (ISO 7243 : WBGT 26,5 °C, référence 25 °C)',
          minutes: 15,
          review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
        },
      ],
    } as unknown as Booking;
    const quote: Quote = {
      id: 'quote-loading-plan-test',
      reference: 'DV-2026-PLAN',
      kind: 'provisional',
      createdAt: '2026-11-03T00:00:00.000Z',
      notes: '',
      price: booking.estimate,
      tolls: [],
      billingMode: 'driver-rental',
      providedCrew: 6,
      overtimeMinutes: 0,
      pricingInput: {
        settings: {} as QuotePricingInput['settings'],
        trips: 1,
        customPrice: null,
        discount: 0,
        discountType: 'fcfa',
        discountReason: '',
        options: booking.options,
        labourUnitPriceOverride: null,
        extraLines: [],
        billingMode: 'driver-rental',
        rentalOvertimeHourlyRate: 10_000,
        overtimeMinutes: 0,
      },
      rentalKit: [
        { id: 'vehicle', label: 'Véhicule propre · Mercedes Sprinter', quantity: 1, image: pixel },
        { id: 'driver', label: 'Chauffeur', quantity: 1, image: pixel },
        { id: 'blankets', label: 'Serviettes de déménagement propres', quantity: 7, image: pixel },
        {
          id: 'lifting-straps',
          label: 'Paires de sangles de levage propres (1 paire pour 2 manœuvres)',
          quantity: 3,
          image: pixel,
        },
        { id: 'gloves', label: 'Paires de gants', quantity: 6, image: pixel },
        {
          id: 'tie-down-straps',
          label: 'Sangles d’attache (arrimage dans le véhicule)',
          quantity: 13,
          image: pixel,
        },
      ],
    };
    const blob = await downloadQuote(withInventory, quote, settings);
    const text = await extractPdfText(blob);
    assert.match(text, /Plan de chargement/);
    assert.match(text, /2\. Votre location avec chauffeur/);
    assert.match(text, /Au-delà de la fin prévue \(08:35\) : minutes supplémentaires/);
    assert.match(text, /Planning prévisionnel/);
    assert.match(text, /Chaleur ISO 7243 : WBGT 26,5 °C/);
    assert.match(text, /Pages suivantes : 3\. Planning prévisionnel heure par heure/);
    assert.match(text, /Synthèse des chargements et déchargements/);
    assert.ok(
      text.indexOf('Plan de chargement') < text.indexOf('Annexe - Inventaire'),
      'le plan précède l’annexe inventaire comme dans le PDF de référence',
    );
    assert.match(text, /Chargement et déchargement 1/);
    assert.match(text, /Lecture des volumes/);
    assert.match(text, /0,8 m³/);
    assert.match(text, /0,5 m³/);
    assert.match(text, /15,5 m³ géométriques/);
    assert.match(text, /14,7 m³ après application de sa réserve de sécurité de 5 %/);

    const standardPdf = await downloadQuote(
      withInventory,
      { ...quote, billingMode: 'standard', rentalKit: [], overtimeMinutes: 0 },
      settings,
    );
    const standardText = await extractPdfText(standardPdf);
    const standardDocument = await getDocument({
      data: new Uint8Array(await standardPdf.arrayBuffer()),
    }).promise;
    assert.equal(
      standardDocument.numPages,
      3,
      'le PDF standard conserve les trois pages de référence',
    );
    assert.doesNotMatch(standardText, /2\. Votre location avec chauffeur/);
    assert.doesNotMatch(standardText, /3\. Planning prévisionnel/);
    assert.doesNotMatch(standardText, /4\. Plan de chargement/);
    assert.match(standardText, /Annexe - Inventaire/);

    const pdf = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    assert.ok(pdf.numPages >= 5, 'le plan est intégré entre le devis et son annexe inventaire');
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageText = (await page.getTextContent()).items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      const hasReferenceSectionHeader =
        pageNumber === 1 ||
        /Conditions générales|2\. Votre location avec chauffeur|3\. Planning prévisionnel|4\. Plan de chargement|Annexe - Inventaire/iu.test(
          pageText,
        );
      if (!hasReferenceSectionHeader) continue;
      const operators = await page.getOperatorList();
      assert.ok(
        operators.fnArray.some(
          (operator) =>
            operator === OPS.paintImageXObject || operator === OPS.paintInlineImageXObject,
        ),
        `le logo est présent dans l’en-tête de la page de section ${pageNumber}`,
      );
      if (/Conditions générales/iu.test(pageText))
        assert.ok(
          operators.fnArray.includes(OPS.clip),
          'le logo de l’en-tête des conditions générales est masqué avec des coins arrondis',
        );
    }
  } finally {
    if (previousWindow) runtime.window = previousWindow;
    else delete runtime.window;
  }
});

test('le kit location fournit une photo de chauffeur par défaut', () => {
  const kit = defaultRentalKit(
    {
      ...booking.vehicle,
      length: '4.3',
      width: '1.94',
      height: '1.78',
      wheelWidth: '1.35',
      volume: '15.5',
      image: '/assets/sprinter-profil.png',
      interior: '/assets/sprinter-interieur.png',
      prices: [0, 0, 0],
    },
    6,
  );
  assert.equal(kit.find((item) => item.id === 'driver')?.image, '/assets/kit-chauffeur.jpg');
  assert.equal(
    kit.find((item) => item.id === 'vehicle')?.image,
    '/assets/kit-vehicle-sprinter.jpg',
  );
});
