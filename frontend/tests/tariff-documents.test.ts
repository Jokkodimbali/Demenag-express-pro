import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createTariffDocument } from '../src/adapters/tariff-documents';
import type { Catalogue, TollPoint } from '../src/domain/model';

const catalogue = {
  vehicles: [
    {
      id: 'sprinter',
      name: 'Sprinter',
      shortName: 'Sprinter',
      prices: [31_000, 41_000, 51_000],
      length: '4',
      width: '2',
      height: '2',
      wheelWidth: '1,5',
      volume: '12 m³',
      active: true,
    },
  ],
  settings: {
    labourPrice: 8_000,
    labourFloorPrice: 700,
    labourLiftPrice: 600,
    assemblyPrice: 5_000,
    rentalOvertimeHourlyRate: 12_000,
    quoteValidityDays: 20,
    whatsappPhone: '+221770000000',
    paymentWave: true,
    paymentCash: true,
  },
} as Catalogue;

async function pdfText(kind: 'client' | 'agent', tollPoints: TollPoint[] = []) {
  const document = createTariffDocument(
    catalogue,
    kind,
    new Date('2026-11-06T12:00:00Z'),
    tollPoints,
  );
  const pdf = await getDocument({ data: new Uint8Array(document.output('arraybuffer')) }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, index) => {
      const content = await (await pdf.getPage(index + 1)).getTextContent();
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    }),
  );
  return pages.join(' ');
}

test('les deux PDF tarifaires utilisent les montants de la base et le guide inclut les péages', async () => {
  const grid = await pdfText('client');
  const guide = await pdfText('agent', [
    {
      id: 'test',
      name: 'Péage test',
      axis: 'Dakar',
      region: 'Dakar',
      heavyPrice: 1_000,
      vehiclePrices: { sprinter: 900 },
      latitude: null,
      longitude: null,
    },
  ]);
  for (const text of [grid, guide]) {
    assert.match(text, /31 000 FCFA/u);
    assert.match(text, /8 000 FCFA/u);
    assert.match(text, /12 000 FCFA/u);
  }
  assert.match(grid, /20 jours/u);
  assert.match(guide, /Péage test/u);
  assert.match(guide, /900 FCFA/u);
  assert.match(guide, /Données structurées/u);
});
