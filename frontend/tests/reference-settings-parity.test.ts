import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { defaultAccountingFinanceConfiguration } from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import {
  resetAccountingChargesToReference,
  resetCatalogueAssemblyToReference,
  resetCatalogueTariffsToReference,
} from '../src/modules/admin/settings/domain/reference-tariff-defaults.ts';
import { assemblyUnitPrice as frontendAssemblyUnitPrice } from '../src/modules/moving/domain/pricing/labour-price.ts';
import { assemblyUnitPrice as backendAssemblyUnitPrice } from '../../backend/src/domain/pricing/pricing.ts';
import type { Catalogue } from '../src/modules/shared/domain/model.ts';
import type {
  AccountingFinanceConfiguration,
  Booking,
} from '../src/modules/shared/domain/model.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import {
  inventoryAssemblyLines as frontendAssemblyLines,
  referenceInventoryKey,
} from '../src/modules/moving/domain/inventory/inventory-assembly.ts';
import { inventoryAssemblyLines as backendAssemblyLines } from '../../backend/src/domain/inventory/inventory-assembly.ts';
import {
  accountingMenuPrice,
  defaultAccountingFinanceConfiguration,
} from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import { captureAccountingCosts } from '../../backend/src/domain/accounting/accounting-costs.ts';
import {
  referenceAssemblyPayrollDefaults,
  referenceAssemblyPriceDefaults,
  referenceVehiclePrices,
} from '../../shared/reference-tariff-defaults.ts';

const source = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);
function literal(name: string) {
  const match = source.match(new RegExp(`\\b${name} = (\\{[^;]+\\});`));
  assert.ok(match, `${name} doit exister dans la référence`);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${match[1]})`)));
}
function referenceGrid(who: 'cli' | 'pay') {
  const columns = who === 'cli' ? [1, 3] : [0, 2];
  return Object.fromEntries(
    Object.entries(literal('MNGRID')).map(([key, value]) => {
      if (Array.isArray(value))
        return [key, { local: value[columns[0]], import: value[columns[1]] }];
      const sizes = Object.keys(value as object)
        .map(Number)
        .sort((a, b) => a - b);
      const rates = value as Record<string, number[]>;
      const base = rates[String(sizes.includes(2) ? 2 : sizes[0])];
      return [
        key,
        {
          local: base[columns[0]],
          import: base[columns[1]],
          sz: Object.fromEntries(
            sizes.map((size) => [
              size,
              {
                local: rates[String(size)][columns[0]],
                import: rates[String(size)][columns[1]],
              },
            ]),
          ),
        },
      ];
    }),
  );
}

test('les grilles client et paie reprennent chaque montant du fichier de référence', () => {
  assert.deepEqual(referenceAssemblyPriceDefaults, referenceGrid('cli'));
  assert.deepEqual(referenceAssemblyPayrollDefaults, referenceGrid('pay'));
  const tariffs = literal('DEFTAR');
  for (const id of ['trafic', 'sprinter', 'master'])
    assert.deepEqual(referenceVehiclePrices[id], tariffs[id]);
});

test('la remise à zéro reprend DEFTAR et DEFFIN en préservant les données métier', () => {
  const tariffs = literal('DEFTAR');
  const finance = literal('DEFFIN');
  const catalogue = {
    vehicles: [
      { id: 'trafic', prices: [1, 2, 3] },
      { id: 'sprinter', prices: [4, 5, 6] },
      { id: 'master', prices: [7, 8, 9] },
      { id: 'custom', prices: [10, 20, 30] },
    ],
    settings: { labourPrice: 99, assemblyPrice: 88, movingLaborPlanning: { heat: 1 } },
  } as Catalogue;
  const updated = resetCatalogueTariffsToReference(catalogue);
  assert.deepEqual(
    updated.vehicles.map((vehicle) => vehicle.prices),
    [tariffs.trafic, tariffs.sprinter, tariffs.master, [10, 20, 30]],
  );
  assert.equal(updated.settings.labourPrice, tariffs.manoeuvre);
  assert.equal(updated.settings.labourFloorPrice, tariffs.manEtage);
  assert.equal(updated.settings.labourLiftPrice, tariffs.manAsc);
  assert.equal(updated.settings.assemblyPrice, tariffs.montage);
  assert.equal(updated.settings.rentalOvertimeHourlyRate, tariffs.otH);
  assert.equal(updated.settings.movingLaborPlanning?.followingTripDiscountPercent, tariffs.tripDeg);
  assert.equal(updated.settings.movingLaborPlanning?.lowDemandDiscountPercent, tariffs.creux);
  assert.equal(
    updated.settings.movingLaborPlanning?.manoeuvreOvertimeThresholdHours,
    tariffs.manOverH,
  );
  assert.equal(
    updated.settings.movingLaborPlanning?.manoeuvreOvertimeHourlyRate,
    tariffs.manOverPx,
  );
  assert.deepEqual(updated.settings.montageP, referenceGrid('cli'));

  const pay = resetAccountingChargesToReference({
    ...defaultAccountingFinanceConfiguration(),
    salaries: [{ id: 'employee', name: 'Employé', amount: 12345 }],
  });
  const keys = {
    moverCostPerMove: 'manPay',
    oilChangeCost: 'vidange',
    oilChangeIntervalMonths: 'vidangeMois',
    vehicleInsuranceAnnual: 'assur',
    vehicleCount: 'nVeh',
    fleetValue: 'fleet',
    fleetYears: 'fleetYears',
    newVehicleTarget: 'newVeh',
    debt: 'dette',
    debtMonths: 'detteMois',
    profitCapPercent: 'seuil',
    legalReservePercent: 'legPct',
    legalReserveCapitalPercent: 'legCap',
    monthlyProfitTarget: 'objectif',
    averageMovingPrice: 'avgTicket',
  } as const;
  for (const [field, key] of Object.entries(keys))
    assert.equal(pay[field as keyof typeof keys], finance[key]);
  assert.deepEqual(pay.menuPrices, referenceGrid('pay'));
  assert.deepEqual(pay.salaries, [{ id: 'employee', name: 'Employé', amount: 12345 }]);
});

test('le repli d’un meuble absent de montageP reprend le tarif de sa catégorie comme la référence', () => {
  const settings = {
    labourPrice: 6500,
    assemblyPrice: 7500,
    montageP: { custom: { local: 9000, import: 13500 } },
  } as Catalogue['settings'];
  for (const key of ['bureau', 'salon', 'tablem', 'armoire']) {
    const expected =
      referenceAssemblyPriceDefaults[key as keyof typeof referenceAssemblyPriceDefaults];
    const local = typeof expected === 'number' ? expected : expected.local;
    const imported = typeof expected === 'number' ? Math.round(expected * 1.5) : expected.import;
    assert.equal(frontendAssemblyUnitPrice(settings, key), local);
    assert.equal(backendAssemblyUnitPrice(settings, key), local);
    assert.equal(frontendAssemblyUnitPrice(settings, key, 'import'), imported);
    assert.equal(backendAssemblyUnitPrice(settings, key, 'import'), imported);
  }
  assert.equal(frontendAssemblyUnitPrice(settings, 'custom'), 9000);
  assert.equal(backendAssemblyUnitPrice(settings, 'custom'), 9000);
});

test('le bouton de réinitialisation ciblée remet la grille client et la manœuvre sans toucher au reste', () => {
  const catalogue = {
    vehicles: [{ id: 'trafic', prices: [1, 2, 3] }],
    settings: {
      labourPrice: 99,
      assemblyPrice: 4321,
      montageP: { bureau: { local: 1, import: 2 } },
      businessName: 'Entreprise conservée',
    },
  } as Catalogue;
  const updated = resetCatalogueAssemblyToReference(catalogue);
  assert.equal(updated.settings.labourPrice, 6500);
  assert.deepEqual(updated.settings.montageP, referenceGrid('cli'));
  assert.equal(updated.settings.assemblyPrice, 4321);
  assert.equal(updated.settings.businessName, 'Entreprise conservée');
  assert.deepEqual(updated.vehicles, catalogue.vehicles);
});

test('les noms d’objets de la fiche utilisent la grille client en frontend et en backend', () => {
  const settings = {
    labourPrice: 6500,
    assemblyPrice: 7500,
    montageP: referenceAssemblyPriceDefaults,
  } as Catalogue['settings'];
  for (const [key, canonical] of [
    ['table-basse', 'tbasse'],
    ['meuble-tv', 'meubletv'],
    ['television', 'tv'],
  ]) {
    assert.equal(referenceInventoryKey(key), canonical);
    const inventory = blankInventory();
    inventory.entries[key] = { quantity: 1, size: 1, dismantle: true, origin: 'local' };
    const expected = (referenceGrid('cli')[canonical] as { local: number }).local;
    assert.equal(frontendAssemblyLines(inventory, settings)[0]?.unitPrice, expected);
    assert.equal(backendAssemblyLines(inventory, settings)[0]?.unitPrice, expected);
  }
});

test('un même inventaire donne le même tarif de montage et le même coût de paie', () => {
  const catalogueSettings = {
    labourPrice: 6500,
    assemblyPrice: 7500,
    montageP: referenceAssemblyPriceDefaults,
  } as Catalogue['settings'];
  const finance = {
    ...defaultAccountingFinanceConfiguration(new Date('2026-11-10T12:00:00Z')),
    menuPrices: referenceAssemblyPayrollDefaults,
  } as AccountingFinanceConfiguration;
  for (const key of ['table-basse', 'meuble-tv', 'television']) {
    const inventory = blankInventory();
    inventory.entries[key] = { quantity: 1, size: 1, dismantle: true, origin: 'local' };
    const canonical = referenceInventoryKey(key);
    const customerPrice = (referenceGrid('cli')[canonical] as { local: number }).local;
    const payrollPrice = (referenceGrid('pay')[canonical] as { local: number }).local;
    assert.equal(frontendAssemblyLines(inventory, catalogueSettings)[0]?.unitPrice, customerPrice);
    assert.equal(accountingMenuPrice(finance, canonical, 'local'), payrollPrice);
    const costs = captureAccountingCosts(
      {
        inventorySnapshot: { sourceInventory: inventory },
        crew: { manoeuvre: ['m1', 'm2'] },
        estimate: { lines: [] },
      } as unknown as Booking,
      { lines: [] } as never,
      finance,
    );
    assert.equal(costs.carpenters, 1);
    assert.equal(costs.carpenterAmount, payrollPrice);
    assert.equal(costs.movers, 2);
    assert.equal(costs.moverAmount, 10000);
  }
});
