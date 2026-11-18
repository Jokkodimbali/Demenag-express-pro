import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { jsPDF } from 'jspdf';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { downloadQuote } from '../src/modules/admin/quotes/adapters/quote-pdf';
import { withoutInventoryBlock } from '../src/modules/admin/quotes/adapters/quote-pdf-text';
import type { Booking, Quote, Settings } from '../src/modules/shared/domain/model';

const html = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);

test('le récapitulatif automatique répété de l’inventaire est retiré des notes PDF', () => {
  const generatedLines = [
    'Estimation : volume ~4,3 m³, soit un chargement et un déchargement en Sprinter.',
    "Main-d'oeuvre : 3 manœuvres (~ 120 kg, objet le plus lourd ~30 kg), chargement + déchargement ~2 h.",
    "Main-d'oeuvre : 3 manoeuvres (~ 130 kg, objet le plus lourd ~ 56 kg), chargement + déchargement ~ 1 h 35 - trajet ~ 40 min - durée ~ 3 h 25 (12:00 à 15:25).",
    'Main-d’œuvre : 3 manœuvres (≈ 130 kg, objet le plus lourd ≈ 56 kg), chargement + déchargement ≈ 1 h 35 · trajet ≈ 40 min · durée ≈ 3 h 25 (12:00 à 15:25).',
    'Estimation : volume ≈ 4,3 m³, soit un chargement et un déchargement en Mercedes Sprinter.',
    'Trajet : ~40 min par trajet (9,8 km).',
    'Planning prévisionnel : de 12:00 à 15:25, durée ~3 h 25 (entre 3 h et 4 h 30).',
    'Déménagement du 2ème étage de Dakar / au 3ème étage de Dakar',
    '- 1 salon de 5 places : ~ 3,75 m³',
    '- 1 table basse : ~ 0,40 m³',
    'Logement : appartement, 2 pièces',
    'À noter : accès par escalier',
    'Estimation : volume ≈ 4,3 m³, soit un chargement et un déchargement en Mercedes Sprinter.',
    'Main-d’œuvre : 3 manœuvres (≈ 130 kg, objet le plus lourd ≈ 56 kg), chargement + déchargement ≈ 1 h 35 · trajet ≈ 40 min · durée ≈ 3 h 25 (12:00 à 15:25).',
  ];
  const notes = [
    "FICHE D'APPEL · INVENTAIRE",
    'Départ : Dakar · étage 2',
    'Arrivée : Dalifort · étage 3',
    ...generatedLines,
    ...generatedLines,
    'NOTE PERSONNALISÉE : manipuler avec soin.',
  ].join('\n');
  const normalized = notes
    .replace(/^Départ :.*$/mu, 'Accès : A · 2e étage ; B · 3e étage')
    .replace(/^Arrivée :.*$/mu, '')
    .replace(/\n{2,}/gu, '\n');
  const cleaned = withoutInventoryBlock(normalized, undefined, 'Départ', 'Arrivée');
  assert.equal(
    cleaned,
    "FICHE D'APPEL · INVENTAIRE\nAccès : A · 2e étage ; B · 3e étage\nNOTE PERSONNALISÉE : manipuler avec soin.",
  );
});

test('le PDF provisoire avec notes de planning conserve le contenu manuel sans répétition', async () => {
  const repeatedPlanning =
    "Main-d'oeuvre : 3 manoeuvres (~ 130 kg, objet le plus lourd ~ 56 kg), chargement + déchargement ~ 1 h 35 - trajet ~ 40 min - durée ~ 3 h 25 (12:00 à 15:25).";
  const inventorySnapshot = {
    items: [
      { section: 'Salon', label: 'Salon', quantity: 1, details: '5 places', volumeM3: 3.75 },
      {
        section: 'Salon',
        label: 'Table basse',
        quantity: 1,
        details: 'Moyen : standard',
        volumeM3: 0.4,
      },
      {
        section: 'Salon',
        label: 'Tapis',
        quantity: 1,
        details: 'Moyen : salon moyen',
        volumeM3: 0.15,
      },
    ],
    ready: 'oui',
    stairs: 'oui',
    flags: [],
    fromFloor: 2,
    toFloor: 3,
    fromLift: false,
    toLift: false,
    totalVolumeM3: 4.3,
    estimatedTrips: 1,
    moverCount: 3,
    carpenterCount: 0,
    totalWeightKg: 130,
    maxItemWeightKg: 56,
    loadingMinutes: 48,
    unloadingMinutes: 47,
    packingMinutes: 0,
    travelMinutes: 40,
    travelLegMinutes: 40,
    totalMinutes: 205,
    lowDurationMinutes: 180,
    highDurationMinutes: 270,
    vehicleCapacityM3: 13.9,
    fillRate: 0.85,
    itemCount: 3,
    annexVolumeM3: 0,
    dwellingType: 'F2',
    startTime: '12:00',
    endTime: '15:25',
  };
  const bookingWithInventory = {
    id: 'booking-overflow-regression',
    reference: 'DV-2026-363976F1',
    userId: 'user-test',
    customerName: 'dddddd',
    phone: '+221779788778',
    vehicle: { id: 'sprinter', name: 'Mercedes Sprinter', shortName: 'Mercedes Sprinter' },
    fromAddress: "Dakar, Commune de Médina, Rue M'baye Worre",
    toAddress: 'Commune de Dalifort, Rue DF-26',
    from: [14.68, -17.45],
    to: [14.69, -17.42],
    distanceKm: 9.8,
    date: '2026-11-13',
    timeSlot: '11:58',
    options: { labour: 27000, desk: 0, wardrobe: 0, bed: 0 },
    notes: repeatedPlanning,
    inventorySnapshot,
    status: 'pending',
    estimate: { lines: [], total: 55000, discount: 0, tier: 0, trips: 1, currency: 'XOF' },
    quotes: [],
    createdAt: '2026-11-13T00:00:00.000Z',
    version: 1,
  } as unknown as Booking;
  const provisional = {
    id: 'quote-overflow-regression',
    reference: 'DV-2026-363976F1',
    kind: 'provisional',
    createdAt: '2026-11-13T00:00:00.000Z',
    notes: `FICHE D'APPEL · INVENTAIRE\nDépart : ${bookingWithInventory.fromAddress} · étage 2\nArrivée : ${bookingWithInventory.toAddress} · étage 3\n${repeatedPlanning}\n${repeatedPlanning}\nEstimation : volume ~4,3 m³, soit un chargement et un déchargement en Mercedes Sprinter.\nMain-d'oeuvre : 3 manoeuvres (~ 130 kg, objet le plus lourd ~56 kg), chargement + déchargement ~1 h 35\nNOTE PERSONNALISÉE : accès à confirmer.`,
    price: {
      lines: [
        {
          label: 'Transport Mercedes Sprinter - moins de 15 km (chargement et déchargement)',
          quantity: 1,
          unitPrice: 28000,
          total: 28000,
        },
        {
          label: 'Manœuvre (2e sans asc. > 3e sans asc.)',
          quantity: 3,
          unitPrice: 9000,
          total: 27000,
        },
      ],
      total: 55000,
      discount: 0,
      tier: 0,
      trips: 1,
      currency: 'XOF',
    },
  } as unknown as Quote;
  const generated = await downloadQuote(bookingWithInventory, provisional, {
    businessName: 'Demenag Express',
    businessAddress: 'Dakar, Sénégal',
    businessPhone: '+221775105104',
    distanceBounds: [15, 25, 35],
    paymentWave: true,
    paymentCash: true,
    paymentQr: assetData('wave-qr.png'),
    quoteTermsEnabled: false,
    quoteTerms: '',
    bookingDepositPercent: 0,
    quoteValidityDays: 15,
    invoiceLogo: assetData('logo.png'),
    invoiceStamp: assetData('cachet.png'),
    invoiceSignature: assetData('signature.png'),
  } as unknown as Settings);
  const pages = await pdfText(generated);
  const items = await pdfItems(generated);
  const inventoryPageIndex = pages.findIndex((page) => page.includes('DÉPART (A)'));
  assert.ok(inventoryPageIndex >= 0, 'annexe inventaire présente');
  assert.ok(pages[inventoryPageIndex]?.includes('NOTE PERSONNALISÉE : accès à confirmer.'));
  assert.equal(
    pages.join(' ').split('Main-d').length - 1,
    1,
    'le planning automatique n’est pas répété',
  );
  assert.equal(
    pages[inventoryPageIndex]?.split('Estimation').length,
    2,
    'la note automatique de volume ne se répète pas dans les notes de l’annexe',
  );
  const inventoryPage = items[inventoryPageIndex] ?? [];
  assert.ok(
    inventoryPage
      .filter(
        (item) => !item.str.startsWith('PROVISOIRE') && !item.str.startsWith('DEMENAG EXPRESS'),
      )
      .every((item) => item.x >= 0 && item.x < 210 && item.y >= 0 && item.y <= 293),
  );
  assert.ok(inventoryPage.some((item) => item.str.includes('Salon')));
});
type ReferenceInstance = {
  state: unknown;
  loadPdf: () => Promise<typeof jsPDF>;
  logoData: () => Promise<null>;
  imgData: (name: string) => Promise<{ url: string; w: number; h: number }>;
  calc: () => unknown;
  pdfBuild: (quote: unknown, kind: string) => Promise<void>;
};
const start = html.indexOf('class Component extends DCLogic {');
const end = html.indexOf('</script>', start);
assert.ok(start >= 0 && end > start);
let referenceBlob: Blob | undefined;
const assetData = (name: string) =>
  `data:image/png;base64,${readFileSync(new URL(`../public/assets/${name}`, import.meta.url)).toString('base64')}`;
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
  Image: class {
    naturalWidth = 997;
    naturalHeight = 1404;
    onload?: () => void;
    set src(_value: string) {
      this.onload?.();
    }
  },
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
  reference.logoData = async () => assetData('logo.png');
  reference.imgData = async (name: string) => {
    const asset = name.split('/').at(-1) || name;
    return {
      url: assetData(asset),
      w: asset === 'signature.png' ? 158 : 1200,
      h: asset === 'signature.png' ? 91 : 1200,
    };
  };
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
    invoiceLogo: assetData('logo.png'),
    invoiceStamp: assetData('cachet.png'),
    invoiceSignature: assetData('signature.png'),
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

  reference.state = {
    data: {
      res: [],
      company: { addr: 'Dakar, Sénégal', tel: '+221770000001', valid: 15, acompte: 20 },
      pay: { wave: true, cash: false },
      cgOff: true,
    },
  };
  referenceBlob = undefined;
  await reference.pdfBuild(legacy, 'provisional');
  assert.ok(referenceBlob);
  const provisionalQuote = { ...quote, kind: 'provisional' } as Quote;
  const referenceProvisionalPages = await pdfText(referenceBlob);
  const appProvisionalPages = await pdfText(
    await downloadQuote(booking, provisionalQuote, { ...settings, paymentWave: true }),
  );
  assert.equal(appProvisionalPages.length, referenceProvisionalPages.length);
  assert.equal(appProvisionalPages.length, 2, 'le paiement reste sur la page du devis');
  for (const value of [
    'DEVIS PROVISOIRE',
    'Wave uniquement',
    'SIGNATURE DU CLIENT',
    'Page 2 / 2',
  ]) {
    assert.ok(
      referenceProvisionalPages.join(' ').includes(value),
      `référence provisoire: ${value}`,
    );
    assert.ok(appProvisionalPages.join(' ').includes(value), `application provisoire: ${value}`);
  }

  reference.state = {
    data: {
      res: [],
      company: { addr: 'Dakar, Sénégal', tel: '+221770000001', valid: 15, acompte: 20 },
      pay: { wave: true, cash: false, qr: assetData('wave-qr.png') },
      cgOff: true,
    },
  };
  referenceBlob = undefined;
  await reference.pdfBuild(legacy, 'provisional');
  assert.ok(referenceBlob);
  const referenceQrPages = await pdfText(referenceBlob);
  const appQrBlob = await downloadQuote(booking, provisionalQuote, {
    ...settings,
    paymentWave: true,
    paymentQr: assetData('wave-qr.png'),
  });
  const appQrPages = await pdfText(appQrBlob);
  assert.equal(appQrPages.length, referenceQrPages.length);
  assert.equal(appQrPages.length, 2, 'le QR Wave et les signatures tiennent sur le devis');
  for (const value of [
    'Wave uniquement',
    'Scannez ce QR code',
    'SIGNATURE DU CLIENT',
    'Page 2 / 2',
  ]) {
    assert.ok(referenceQrPages.join(' ').includes(value), `référence avec QR: ${value}`);
    assert.ok(appQrPages.join(' ').includes(value), `application avec QR: ${value}`);
  }

  const inventorySnapshot = {
    items: Array.from({ length: 54 }, (_, index) => ({
      section: ['Salon', 'Chambre', 'Cuisine'][Math.floor(index / 18)] || 'Autres',
      label: `Canapé convertible trois places ${index + 1} avec dossier amovible`,
      quantity: 1,
      details: 'Grand : 210 × 90 cm, démontage et montage, protection renforcée nécessaire',
      volumeM3: 0.45,
    })),
    ready: 'oui',
    stairs: 'oui',
    flags: ['Accès par couloir étroit'],
    fromFloor: 2,
    toFloor: 3,
    fromLift: false,
    toLift: true,
    totalVolumeM3: 24.3,
    estimatedTrips: 3,
    moverCount: 3,
    carpenterCount: 0,
    totalWeightKg: 850,
    maxItemWeightKg: 75,
    loadingMinutes: 180,
    unloadingMinutes: 150,
    packingMinutes: 90,
    travelMinutes: 120,
    travelLegMinutes: 40,
    startTime: '08:00',
    endTime: '15:30',
    totalMinutes: 450,
    lowDurationMinutes: 390,
    highDurationMinutes: 540,
    vehicleCapacityM3: 12,
    fillRate: 0.85,
    itemCount: 54,
    annexVolumeM3: 3,
    dwellingType: 'F4',
  };
  const inventoryBlob = await downloadQuote(
    { ...booking, inventorySnapshot } as Booking,
    quote,
    settings,
  );
  const inventoryPages = await pdfText(inventoryBlob);
  const inventoryPositions = await pdfItems(inventoryBlob);
  assert.ok(inventoryPages.length >= 5, 'les objets longs sont répartis sur plusieurs pages');
  const inventoryText = inventoryPositions.slice(2).flat();
  const salonBand = inventoryText.find((item) => item.str === 'Salon');
  const firstItem = inventoryText.find((item) =>
    item.str.includes('Canapé convertible trois places 1'),
  );
  assert.ok(salonBand, 'bandeau Salon présent');
  assert.ok(firstItem, 'premier objet de l’inventaire présent');
  assert.ok(firstItem.y > salonBand.y + 4, 'la première ligne ne chevauche pas son bandeau');
  assert.ok(
    inventoryText
      .filter((item) => item.str.includes('Canapé convertible trois places'))
      .every((item) => item.x >= 15 && item.y < 278),
    'les lignes d’inventaire restent dans les marges et au-dessus du pied de page',
  );
});
