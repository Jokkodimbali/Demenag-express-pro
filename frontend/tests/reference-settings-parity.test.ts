import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { defaultAccountingFinanceConfiguration } from '../src/domain/accounting-forecast.ts';
import {
  resetAccountingChargesToReference,
  resetCatalogueAssemblyToReference,
  resetCatalogueTariffsToReference,
} from '../src/domain/reference-tariff-defaults.ts';
import type { Catalogue } from '../src/domain/model.ts';
import { blankInventory } from '../src/domain/inventory.ts';
import { inventoryAssemblyLines as frontendAssemblyLines, referenceInventoryKey } from '../src/domain/inventory-assembly.ts';
import { inventoryAssemblyLines as backendAssemblyLines } from '../../backend/src/domain/inventory-assembly.ts';
import {
  referenceAssemblyPayrollDefaults,
  referenceAssemblyPriceDefaults,
  referenceVehiclePrices,
} from '../../shared/reference-tariff-defaults.ts';

const source = readFileSync(new URL('../../reference/Demenag Express.dc.html', import.meta.url), 'utf8');
function literal(name: string) {
  const match = source.match(new RegExp(`\\b${name} = (\\{[^;]+\\});`));
  assert.ok(match, `${name} doit exister dans la référence`);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${match[1]})`)));
}
function referenceGrid(who: 'cli' | 'pay') {
  const columns = who === 'cli' ? [1, 3] : [0, 2];
  return Object.fromEntries(Object.entries(literal('MNGRID')).map(([key, value]) => {
    if (Array.isArray(value)) return [key, { local: value[columns[0]], import: value[columns[1]] }];
    const sizes = Object.keys(value as object).map(Number).sort((a, b) => a - b);
    const rates = value as Record<string, number[]>;
    const base = rates[String(sizes.includes(2) ? 2 : sizes[0])];
    return [key, {
      local: base[columns[0]],
      import: base[columns[1]],
      sz: Object.fromEntries(sizes.map((size) => [size, {
        local: rates[String(size)][columns[0]],
        import: rates[String(size)][columns[1]],
      }])),
    }];
  }));
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
  assert.deepEqual(updated.vehicles.map((vehicle) => vehicle.prices), [
    tariffs.trafic, tariffs.sprinter, tariffs.master, [10, 20, 30],
  ]);
  assert.equal(updated.settings.labourPrice, tariffs.manoeuvre);
  assert.equal(updated.settings.labourFloorPrice, tariffs.manEtage);
  assert.equal(updated.settings.labourLiftPrice, tariffs.manAsc);
  assert.equal(updated.settings.assemblyPrice, tariffs.montage);
  assert.equal(updated.settings.rentalOvertimeHourlyRate, tariffs.otH);
  assert.equal(updated.settings.movingLaborPlanning?.followingTripDiscountPercent, tariffs.tripDeg);
  assert.equal(updated.settings.movingLaborPlanning?.lowDemandDiscountPercent, tariffs.creux);
  assert.equal(updated.settings.movingLaborPlanning?.manoeuvreOvertimeThresholdHours, tariffs.manOverH);
  assert.equal(updated.settings.movingLaborPlanning?.manoeuvreOvertimeHourlyRate, tariffs.manOverPx);
  assert.deepEqual(updated.settings.montageP, referenceGrid('cli'));

  const pay = resetAccountingChargesToReference({
    ...defaultAccountingFinanceConfiguration(),
    salaries: [{ id: 'employee', name: 'Employé', amount: 12345 }],
  });
  const keys = {
    moverCostPerMove: 'manPay', oilChangeCost: 'vidange',
    oilChangeIntervalMonths: 'vidangeMois', vehicleInsuranceAnnual: 'assur',
    vehicleCount: 'nVeh', fleetValue: 'fleet', fleetYears: 'fleetYears',
    newVehicleTarget: 'newVeh', debt: 'dette', debtMonths: 'detteMois',
    profitCapPercent: 'seuil', legalReservePercent: 'legPct',
    legalReserveCapitalPercent: 'legCap', monthlyProfitTarget: 'objectif',
    averageMovingPrice: 'avgTicket',
  } as const;
  for (const [field, key] of Object.entries(keys))
    assert.equal(pay[field as keyof typeof keys], finance[key]);
  assert.deepEqual(pay.menuPrices, referenceGrid('pay'));
  assert.deepEqual(pay.salaries, [{ id: 'employee', name: 'Employé', amount: 12345 }]);

  const assemblyOnly = resetCatalogueAssemblyToReference(catalogue);
  assert.equal(assemblyOnly.settings.labourPrice, tariffs.manoeuvre);
  assert.deepEqual(assemblyOnly.settings.montageP, referenceGrid('cli'));
  assert.deepEqual(assemblyOnly.vehicles, catalogue.vehicles);
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
