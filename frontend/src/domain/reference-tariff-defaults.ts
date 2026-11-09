import type { AccountingFinanceConfiguration, Catalogue, Settings, Vehicle } from './model';
import { createLabourPriceMatrix } from './labour-price';
import { defaultMovingLaborPlanning } from './moving-estimate';

import { referenceAssemblyPayrollDefaults, referenceAssemblyPriceDefaults, referenceVehiclePrices } from '../../../shared/reference-tariff-defaults.js';

export function resetAccountingChargesToReference(
  current: AccountingFinanceConfiguration,
): AccountingFinanceConfiguration {
  return {
    ...current,
    moverCostPerMove: 5000,
    oilChangeCost: 150000,
    oilChangeIntervalMonths: 2,
    vehicleInsuranceAnnual: 200000,
    vehicleCount: 3,
    fleetValue: 30000000,
    fleetYears: 7,
    newVehicleTarget: 12000000,
    debt: 30000000,
    debtMonths: 18,
    profitCapPercent: 50,
    legalReservePercent: 10,
    legalReserveCapitalPercent: 20,
    monthlyProfitTarget: 3000000,
    averageMovingPrice: 0,
    menuPrices: referenceAssemblyPayrollDefaults,
  };
}

export function resetCatalogueAssemblyToReference(catalogue: Catalogue): Catalogue {
  const settings: Settings = {
    ...catalogue.settings,
    labourPrice: 6500,
    montageP: copyAssemblyPriceDefaults(),
  };
  settings.labourMatrix = createLabourPriceMatrix(settings);
  return { ...catalogue, settings };
}

function copyAssemblyPriceDefaults(): NonNullable<Settings['montageP']> {
  return Object.fromEntries(
    Object.entries(referenceAssemblyPriceDefaults).map(([key, value]) => [
      key,
      typeof value === 'number'
        ? value
        : {
            ...value,
            ...('sz' in value && value.sz ? { sz: { ...value.sz } } : {}),
          },
    ]),
  );
}

export function resetCatalogueTariffsToReference(catalogue: Catalogue): Catalogue {
  const settings: Settings = {
    ...catalogue.settings,
    labourPrice: 6500,
    labourFloorPrice: 500,
    labourLiftPrice: 500,
    assemblyPrice: 7500,
    montageP: copyAssemblyPriceDefaults(),
    rentalOvertimeHourlyRate: 10000,
    movingLaborPlanning: {
      ...defaultMovingLaborPlanning,
      ...catalogue.settings.movingLaborPlanning,
      followingTripDiscountPercent: 60,
      lowDemandDiscountPercent: 10,
      manoeuvreOvertimeThresholdHours: 8,
      manoeuvreOvertimeHourlyRate: 0,
    },
  };
  settings.labourMatrix = createLabourPriceMatrix(settings);

  return {
    ...catalogue,
    vehicles: catalogue.vehicles.map((vehicle) =>
      referenceVehiclePrices[vehicle.id]
        ? { ...vehicle, prices: [...referenceVehiclePrices[vehicle.id]] as Vehicle['prices'] }
        : vehicle,
    ),
    settings,
  };
}
