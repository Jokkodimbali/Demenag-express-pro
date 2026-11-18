import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminQuoteConfig } from '../src/modules/admin/quotes/application/admin-quote-draft-storage.ts';
import { blankDraft } from '../src/modules/booking/application/booking-draft.ts';
import { createAdminQuotePreview } from '../src/modules/admin/quotes/application/services/admin-quote-preview.ts';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config.ts';
import { calculatePrice } from '../../backend/src/domain/pricing/pricing.ts';
import { estimateMovingWork } from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import {
  inventoryAssemblyLines,
  subtractInventoryAssemblyOptions,
} from '../../backend/src/domain/inventory/inventory-assembly.ts';
import type { Catalogue, Options, Settings, Vehicle } from '../src/modules/shared/domain/model.ts';
import { removeTaxiFromManoeuvrePrice } from '../../shared/quote-taxi-allocation.js';

const settings: Settings = {
  distanceBounds: [15, 25, 35],
  maxTrips: 20,
  maxOptions: 20,
  labourPrice: 6_500,
  labourFloorPrice: 500,
  labourLiftPrice: 500,
  assemblyPrice: 7_500,
  montageP: {
    salon: { local: 10_000, import: 15_000 },
    armoire: { local: 9_000, import: 13_500 },
    lit: { local: 7_000, import: 10_500 },
    bureau: { local: 5_000, import: 7_500 },
  },
  movingLaborPlanning: {
    maxHandlingHours: 3,
    maxDayHours: 8,
    defaultStartHour: 8,
    maxMoversPerVehicle: 6,
    cubicMetersPerHourPerMover: 2.7,
    pauseMinutes: 30,
    tripSetupMinutes: 15,
    handlingCalibration: 1,
    followingTripDiscountPercent: 60,
    lowDemandDiscountPercent: 10,
  },
  rentalOvertimeHourlyRate: 10_000,
  rentalKitConfiguration: [],
} as Settings;

const vehicle: Vehicle = {
  id: 'sprinter',
  name: 'Mercedes Sprinter',
  shortName: 'Sprinter',
  volume: '14 m³',
  length: '4,30 m',
  height: '1,94 m',
  width: '1,78 m',
  wheelWidth: '1,35 m',
  image: '',
  interior: '',
  prices: [28_000, 34_500, 41_500],
};

const extras: [keyof Options, string, string][] = [
  ['labour', 'Manœuvres', ''],
  ['desk', 'Montage bureau', ''],
  ['wardrobe', 'Montage armoire', ''],
  ['bed', 'Montage lit', ''],
];

test('l’aperçu du devis reprend une seule fois transport, trajets suivants et jour creux', () => {
  const catalogue = { vehicles: [vehicle], settings } as Catalogue;
  const access = { fromFloor: 2, toFloor: 1, fromLift: false, toLift: true };
  let checked = 0;

  for (const distance of [0, 14.99, 15, 25, 25.01, 35, 35.01]) {
    for (const trips of [1, 2, 3]) {
      for (const billingMode of ['complete', 'standard', 'driver-rental'] as const) {
        const menuChoices = billingMode === 'driver-rental' ? [false, true] : [false];
        for (const discountCase of [
          { discount: 0, discountType: 'fcfa' as const },
          { discount: 10, discountType: 'pct' as const },
        ]) {
          for (const labourUnitPriceOverride of [null, 8_000]) {
            for (const menuIncluded of menuChoices) {
              const draft = blankDraft(catalogue);
              draft.vehicleId = vehicle.id;
              draft.route = {
                id: 'route-test',
                from: [14.69, -17.44],
                to: [14.73, -17.48],
                distanceKm: distance,
                durationMinutes: 35,
                geometry: [
                  [14.69, -17.44],
                  [14.73, -17.48],
                ],
                expiresAt: '2026-12-01T00:00:00.000Z',
              };
              draft.date = '2026-11-12';
              draft.timeSlot = '08:00';
              draft.options = { labour: 3, desk: 1, wardrobe: 1, bed: 1 };
              draft.inventory.entries = {
                salon: { quantity: 1, size: 5, dismantle: true, origin: 'local' },
                armoire: { quantity: 1, size: 3, dismantle: true, origin: 'import' },
                lit: { quantity: 1, size: 2, dismantle: true, origin: 'local' },
              };
              draft.inventory.fromFloor = access.fromFloor;
              draft.inventory.toFloor = access.toFloor;
              draft.inventory.fromLift = access.fromLift;
              draft.inventory.toLift = access.toLift;

              const config: AdminQuoteConfig = {
                trips,
                calcMode: 'auto',
                legMinutes: 0,
                trafficOff: false,
                heatOff: false,
                heatRest: 0,
                discount: discountCase.discount,
                discountType: discountCase.discountType,
                discountReason: 'Geste commercial',
                customPrice: distance > 35 ? 50_000 : null,
                labourUnitPriceOverride,
                billingMode,
                menuIncluded,
                overtimeMinutes: billingMode === 'driver-rental' ? 30 : 0,
                rentalKit: null,
              };
              const baseEstimate = calculatePrice(
                vehicle,
                settings,
                distance,
                draft.options,
                trips,
                null,
                0,
                [],
                access,
                null,
                'fcfa',
                '',
                draft.date,
              );
              const preview = createAdminQuotePreview({
                draft,
                estimateInventory: draft.inventory,
                config,
                vehicle,
                estimate: null,
                settings,
                price: baseEstimate,
                extras,
                labourPrice: settings.labourPrice,
                simulationNeeds: null,
              });

              const remainingOptions = subtractInventoryAssemblyOptions(
                draft.options,
                draft.inventory,
              );
              const pricingOptions =
                billingMode === 'driver-rental'
                  ? {
                      ...remainingOptions,
                      labour: 0,
                      ...(menuIncluded ? {} : { desk: 0, wardrobe: 0, bed: 0 }),
                    }
                  : billingMode === 'standard'
                    ? { ...remainingOptions, desk: 0, wardrobe: 0, bed: 0 }
                    : remainingOptions;
              const extraLines = [
                ...(billingMode === 'complete' || (billingMode === 'driver-rental' && menuIncluded)
                  ? inventoryAssemblyLines(draft.inventory, settings)
                  : []),
                ...(billingMode === 'driver-rental'
                  ? [
                      {
                        label:
                          'Dépassement du planning prévisionnel (30 min, 10000 FCFA par heure)',
                        quantity: 1,
                        unitPrice: 5_000,
                      },
                    ]
                  : []),
              ];
              const serverPrice = calculatePrice(
                vehicle,
                settings,
                distance,
                pricingOptions,
                trips,
                config.customPrice,
                config.discount,
                extraLines,
                access,
                labourUnitPriceOverride,
                config.discountType,
                config.discountReason,
                draft.date,
              );

              assert.equal(
                preview.total,
                serverPrice.total,
                `${distance} km, ${trips} trajet(s), formule ${billingMode}`,
              );
              assert.equal(
                preview.previewLines.filter((line) => line.label.startsWith('Remise jour creux'))
                  .length,
                serverPrice.lines.filter((line) => line.label.startsWith('Remise jour creux'))
                  .length,
                `${distance} km, ${trips} trajet(s), formule ${billingMode}: remise jour creux`,
              );
              checked += 1;
            }
          }
        }
      }
    }
  }

  assert.equal(checked, 336);
});

test('les frais taxi facturent chargement et déchargement à chaque rotation puis les répartissent sur les manœuvres', () => {
  const taxiSettings = {
    ...settings,
    taxiFeeEnabled: true,
    taxiFeePerKm: 1_000,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  };
  const draft = blankDraft({ vehicles: [vehicle], settings: taxiSettings } as Catalogue);
  draft.vehicleId = vehicle.id;
  draft.route = {
    id: 'route-taxi',
    from: [14.69, -17.44],
    to: [14.73, -17.48],
    distanceKm: 10,
    durationMinutes: 35,
    geometry: [],
    expiresAt: '2026-12-01T00:00:00.000Z',
  };
  draft.options = { labour: 5, desk: 0, wardrobe: 0, bed: 0 };
  const config = { ...defaultAdminQuoteConfig(), trips: 3, taxiFeeApplied: true };
  const input = {
    draft,
    estimateInventory: draft.inventory,
    config,
    vehicle,
    estimate: null,
    settings: taxiSettings,
    price: null,
    extras,
    labourPrice: 6_500,
    simulationNeeds: null,
    taxiPickupDistanceKm: 0,
  };
  const preview = createAdminQuotePreview(input);
  const labour = preview.previewLines.find((line) => line.label.startsWith('Manœuvres'));
  assert.equal(preview.taxiFeeLine?.total, 50_000);
  assert.equal(preview.taxiFeeLine?.quantity, 5);
  assert.equal(labour?.unitPrice, 16_500);
  assert.equal(labour?.total, 82_500);
  const automaticEstimate = estimateMovingWork(draft.inventory, vehicle, draft.route, {
    trips: 5,
    recommendedTrips: 5,
  });
  const automaticPreview = createAdminQuotePreview({ ...input, estimate: automaticEstimate });
  assert.equal(automaticPreview.taxiFeeLine?.quantity, 9);
  assert.equal(automaticPreview.taxiFeeLine?.total, 90_000);
  const twoTripEstimate = estimateMovingWork(draft.inventory, vehicle, draft.route, {
    trips: 2,
    recommendedTrips: 2,
  });
  const twoTripPreview = createAdminQuotePreview({ ...input, estimate: twoTripEstimate });
  const twoTripManoeuvres = twoTripPreview.previewLines.find((line) =>
    line.label.startsWith('Manœuvres'),
  );
  assert.equal(twoTripPreview.taxiFeeLine?.quantity, 3);
  assert.equal(twoTripPreview.taxiFeeLine?.total, 30_000);
  assert.equal(twoTripManoeuvres?.unitPrice, 12_500);
  assert.equal(twoTripManoeuvres?.total, 62_500);

  const manualDraft = {
    ...draft,
    options: { labour: 6, desk: 0, wardrobe: 0, bed: 0 },
  };
  const manualEstimate = estimateMovingWork(manualDraft.inventory, vehicle, manualDraft.route, {
    trips: 7,
    recommendedTrips: 7,
  });
  const manualPreview = createAdminQuotePreview({
    ...input,
    draft: manualDraft,
    estimate: manualEstimate,
    config: {
      ...config,
      calcMode: 'manual',
      trips: 2,
      taxiFeeAmountOverride: 13_650,
      taxiCompanyApproachAmountOverride: 930,
    },
  });
  const manualTaxiTotal = manualPreview.taxiFeeLines.reduce((sum, line) => sum + line.total, 0);
  const manualManoeuvre = manualPreview.previewLines.find((line) =>
    line.label.startsWith('Manœuvres'),
  );
  assert.equal(manualPreview.taxiFeeLines[0]?.quantity, 3);
  assert.equal(manualTaxiTotal, 41_880);
  assert.equal(manualPreview.taxiCrew, 6);
  assert.equal(manualManoeuvre?.unitPrice, 13_480);
  assert.equal(manualManoeuvre?.total, 80_880);
  assert.equal(
    preview.previewLines.some((line) => line.label.startsWith('Frais taxi')),
    false,
  );

  const adjusted = createAdminQuotePreview({
    ...input,
    config: { ...config, taxiFeeAmountOverride: 10_000 },
  });
  assert.equal(
    adjusted.previewLines.find((line) => line.label.startsWith('Manœuvres'))?.unitPrice,
    16_500,
  );
  assert.equal(adjusted.taxiFeeLine?.quantity, 5);
  assert.equal(adjusted.taxiFeeLine?.total, 50_000);
  assert.equal(adjusted.total, preview.total);

  const economic = createAdminQuotePreview({
    ...input,
    config: { ...config, billingMode: 'driver-rental' },
  });
  assert.equal(economic.taxiFeeLine, null);

  const missingCompanyLocation = createAdminQuotePreview({
    ...input,
    settings: { ...taxiSettings, businessLatitude: null, businessLongitude: null },
    taxiPickupDistanceKm: null,
  });
  assert.equal(missingCompanyLocation.taxiFeeLine, null);
});

test('les frais locaux et les taxis par rotation sont ajoutés aux manœuvres sans écart d’arrondi', () => {
  const taxiSettings = {
    ...settings,
    taxiFeeEnabled: true,
    taxiFeePerKm: 333,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  };
  const draft = blankDraft({ vehicles: [vehicle], settings: taxiSettings } as Catalogue);
  draft.vehicleId = vehicle.id;
  draft.route = {
    id: 'route-taxi-rounding',
    from: [14.7, -17.45],
    to: [14.73, -17.48],
    distanceKm: 10.25,
    durationMinutes: 35,
    geometry: [],
    expiresAt: '2026-12-01T00:00:00.000Z',
  };
  draft.options = { labour: 5, desk: 0, wardrobe: 0, bed: 0 };
  const config = { ...defaultAdminQuoteConfig(), trips: 3, taxiFeeApplied: true };
  const input = {
    draft,
    estimateInventory: draft.inventory,
    config,
    vehicle,
    estimate: null,
    settings: taxiSettings,
    price: null,
    extras,
    labourPrice: 6_500,
    simulationNeeds: null,
    taxiPickupDistanceKm: 5,
  };

  const preview = createAdminQuotePreview(input);
  const withoutTaxi = createAdminQuotePreview({
    ...input,
    config: { ...config, taxiFeeApplied: false },
  });
  const submittedTaxiAmount = preview.taxiFeeLines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPrice),
    0,
  );
  const previewLabour = preview.previewLines.filter((line) => line.label.startsWith('Manœuvres'));
  const baseLabour = withoutTaxi.previewLines.filter((line) => line.label.startsWith('Manœuvres'));

  assert.equal(preview.taxiFeeLines.length, 2);
  assert.equal(preview.taxiFeeLines[0]?.quantity, 5);
  assert.equal(preview.taxiFeeLines[0]?.unitPrice, 3_413);
  assert.equal(preview.taxiFeeLines[0]?.total, 17_065);
  assert.equal(preview.taxiFeeLines[1]?.quantity, 1);
  assert.equal(preview.taxiFeeLines[1]?.total, 1_665);
  assert.equal(submittedTaxiAmount, 18_730);
  assert.equal(preview.total - withoutTaxi.total, 18_730);
  assert.equal(
    previewLabour.reduce((sum, line) => sum + line.total, 0) -
      baseLabour.reduce((sum, line) => sum + line.total, 0),
    18_730,
  );
  assert.equal(
    previewLabour.reduce((sum, line) => sum + line.quantity, 0),
    5,
  );
  assert.ok(previewLabour.every((line) => Number.isInteger(line.unitPrice)));
  assert.equal(
    previewLabour.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    previewLabour.reduce((sum, line) => sum + line.total, 0),
  );
  assert.deepEqual(
    previewLabour.map((line) => [line.quantity, line.unitPrice, line.total]),
    [[5, 10_246, 51_230]],
  );
  const restoredPrice = removeTaxiFromManoeuvrePrice(preview.priceSnapshot, submittedTaxiAmount);
  assert.deepEqual(
    restoredPrice.lines.filter((line) => line.label.startsWith('Manœuvres')),
    baseLabour,
  );
  assert.equal(restoredPrice.total, withoutTaxi.total);

  const adjusted = createAdminQuotePreview({
    ...input,
    config: {
      ...config,
      taxiFeeAmountOverride: 10_000,
      taxiCompanyApproachAmountOverride: 2_000,
    },
  });
  assert.equal(adjusted.taxiFeeLines[0]?.quantity, 5);
  assert.equal(adjusted.taxiFeeLines[0]?.total, 50_000);
  assert.equal(adjusted.taxiFeeLines[1]?.quantity, 1);
  assert.equal(adjusted.taxiFeeLines[1]?.total, 2_000);
  assert.equal(adjusted.total - withoutTaxi.total, 52_000);
  assert.deepEqual(
    adjusted.previewLines
      .filter((line) => line.label.startsWith('Manœuvres'))
      .map((line) => [line.quantity, line.unitPrice, line.total]),
    [[5, 16_900, 84_500]],
  );
});
