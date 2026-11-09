import type { Catalogue, Settings, Vehicle } from './model';
import { createLabourPriceMatrix } from './labour-price';
import { defaultMovingLaborPlanning } from './moving-estimate';

import { referenceAssemblyPriceDefaults, referenceVehiclePrices } from '../../../shared/reference-tariff-defaults.js';

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
