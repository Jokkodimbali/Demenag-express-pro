import assert from 'node:assert/strict';
import test from 'node:test';
import {
  referenceLowDemandDiscount,
  referenceTransportLines,
} from '../src/modules/moving/domain/pricing/reference-pricing';
import {
  referenceLowDemandDiscount as backendLowDemandDiscount,
  referenceTransportLines as backendTransportLines,
} from '../../backend/src/domain/pricing/reference-pricing.ts';
import { calculatePrice } from '../../backend/src/domain/pricing/pricing.ts';
import type { Settings, Vehicle } from '../src/modules/shared/domain/model';

test('réduit les chargements et déchargements suivants au pourcentage de référence et arrondit aux 500 FCFA', () => {
  const lines = referenceTransportLines('Transport Sprinter', 28000, 3, 60);
  assert.deepEqual(lines, [
    {
      label: 'Transport Sprinter · premier chargement et déchargement',
      quantity: 1,
      unitPrice: 28000,
      total: 28000,
    },
    {
      label: 'Chargements et déchargements suivants (60 % du 1er)',
      quantity: 2,
      unitPrice: 17000,
      total: 34000,
    },
  ]);
});

test('applique la remise jour creux uniquement du lundi au jeudi, du 6 au 24', () => {
  assert.equal(referenceLowDemandDiscount(45000, '2026-11-09', 10), 4500);
  assert.equal(referenceLowDemandDiscount(45000, '2026-11-07', 10), 0);
  assert.equal(referenceLowDemandDiscount(45000, '2026-11-05', 10), 0);
  assert.equal(referenceLowDemandDiscount(45000, '2026-11-25', 10), 0);
});

test('les moteurs frontend et backend gardent les mêmes lignes et remises', () => {
  for (const date of ['2026-11-09', '2026-11-07', '2026-11-25', null]) {
    assert.deepEqual(
      referenceTransportLines('Transport Master', 31000, 4, 60),
      backendTransportLines('Transport Master', 31000, 4, 60),
    );
    assert.equal(
      referenceLowDemandDiscount(62000, date, 10),
      backendLowDemandDiscount(62000, date, 10),
    );
  }
});

test('le prix backend applique ensemble la remise des trajets et la remise du jour creux', () => {
  const settings = {
    distanceBounds: [15, 25, 35],
    maxTrips: 10,
    maxOptions: 10,
    labourPrice: 6500,
    labourFloorPrice: 500,
    labourLiftPrice: 500,
    assemblyPrice: 7500,
    movingLaborPlanning: {
      followingTripDiscountPercent: 60,
      lowDemandDiscountPercent: 10,
    },
  } as Settings;
  const vehicle = {
    id: 'sprinter',
    name: 'Sprinter',
    prices: [28000, 34500, 41500],
  } as Vehicle;
  const price = calculatePrice(
    vehicle,
    settings,
    10,
    { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    3,
    null,
    0,
    [],
    undefined,
    null,
    'fcfa',
    '',
    '2026-11-09',
  );
  assert.equal(price.total, 56000);
  assert.equal(
    price.lines.slice(0, 2).reduce((sum, line) => sum + line.total, 0),
    62000,
  );
  assert.equal(price.lines[2]?.unitPrice, -6000);
});

test('le prix backend regroupe les lignes personnalisées de même libellé', () => {
  const settings = {
    distanceBounds: [15, 25, 35],
    maxTrips: 10,
    maxOptions: 10,
    labourPrice: 6_500,
    labourFloorPrice: 500,
    labourLiftPrice: 500,
    assemblyPrice: 7_500,
    movingLaborPlanning: { followingTripDiscountPercent: 60, lowDemandDiscountPercent: 0 },
  } as Settings;
  const vehicle = {
    id: 'sprinter',
    name: 'Sprinter',
    prices: [28_000, 34_500, 41_500],
  } as Vehicle;
  const price = calculatePrice(
    vehicle,
    settings,
    10,
    { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    1,
    null,
    0,
    [
      { label: 'Frais d’emballage', quantity: 1, unitPrice: 1_000 },
      { label: ' FRAIS   D’EMBALLAGE ', quantity: 2, unitPrice: 1_500 },
    ],
  );
  const grouped = price.lines.filter((line) =>
    line.label.toLocaleLowerCase('fr-FR').includes('frais'),
  );

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.quantity, 3);
  assert.equal(grouped[0]?.total, 4_000);
});
