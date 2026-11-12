import { referenceAssemblyPriceDefaults } from '../../../../../../../shared/reference-assembly-price-defaults.js';
import { defaultMovingLaborPlanning } from '../../../../moving/domain/estimate/moving-estimate';
import { inventoryItems } from '../../../../moving/domain/inventory/inventory';
import { referenceInventoryKey } from '../../../../moving/domain/inventory/inventory-assembly';
import { labourUnitPrice } from '../../../../moving/domain/pricing/labour-price';
import type { Catalogue, LabourMatrixScenario, Settings } from '../../../../shared/domain/model';

export const labourScenarios: {
  id: LabourMatrixScenario;
  label: string;
  from: boolean;
  to: boolean;
}[] = [
  { id: 'none', label: 'Sans ascenseur', from: false, to: false },
  { id: 'from', label: 'Ascenseur au départ', from: true, to: false },
  { id: 'to', label: "Ascenseur à l'arrivée", from: false, to: true },
  { id: 'both', label: 'Ascenseur des deux côtés', from: true, to: true },
];
export const labourFloors = ['RDC', '1er', '2e', '3e', '4e', '5e'];

export const planningDefaults = {
  ...defaultMovingLaborPlanning,
  blanketLengthCm: 204,
  blanketWidthCm: 184,
  blanketStock: 20,
};

const sizeRanges: Record<string, [number, number]> = {
  salon: [1, 10],
  tablem: [2, 12],
  lit: [1, 4],
  matelas: [1, 4],
  armoire: [1, 8],
};

export function transportSettingsModel(catalogue: Catalogue) {
  const customConfigured = catalogue.settings.montageP?.custom;
  const customPricingBase =
    typeof customConfigured === 'number'
      ? { local: customConfigured, import: Math.round(customConfigured * 1.5) }
      : (customConfigured ?? {});
  const customPricing = {
    local: customPricingBase.local ?? catalogue.settings.assemblyPrice,
    import: customPricingBase.import ?? Math.round(catalogue.settings.assemblyPrice * 1.5),
  };
  const rows = inventoryItems
    .filter((item) => item.key !== 'climatiseur')
    .map((item) => {
      const key = referenceInventoryKey(item.key);
      const configuredValue =
        catalogue.settings.montageP?.[key] ?? catalogue.settings.montageP?.[item.key];
      const configured =
        typeof configuredValue === 'number'
          ? { local: configuredValue, import: Math.round(configuredValue * 1.5) }
          : configuredValue;
      const referencePricing =
        referenceAssemblyPriceDefaults[key as keyof typeof referenceAssemblyPriceDefaults];
      const pricing = (configured ?? referencePricing ?? {}) as {
        local?: number;
        import?: number;
        u?: number;
        uI?: number;
        sz?: Record<string, { local?: number; import?: number }>;
      };
      const localPrice = pricing.local ?? 0;
      const importedPrice = pricing.import ?? localPrice;
      const range = item.sizeLabel ? (sizeRanges[key] ?? [1, (item.defaultSize ?? 1) + 3]) : null;
      return { item, key, pricing, range, localPrice, importedPrice };
    });
  const sectionRows = new Map<string, typeof rows>();
  for (const row of rows) {
    const existing = sectionRows.get(row.item.section) ?? [];
    existing.push(row);
    sectionRows.set(row.item.section, existing);
  }
  const assemblyColumns = [
    ['Salon & séjour', 'Divers'],
    ['Chambres', 'Cuisine & électroménager'],
  ].map((columnSections) =>
    columnSections.flatMap((section) => {
      const rows = sectionRows.get(section);
      return rows ? [[section, rows] as const] : [];
    }),
  );
  const referenceVehicleOrder = ['sprinter', 'trafic', 'master'];
  const vehicles = [...catalogue.vehicles].sort((left, right) => {
    const leftIndex = referenceVehicleOrder.indexOf(left.id);
    const rightIndex = referenceVehicleOrder.indexOf(right.id);
    return (
      (leftIndex < 0 ? referenceVehicleOrder.length : leftIndex) -
      (rightIndex < 0 ? referenceVehicleOrder.length : rightIndex)
    );
  });
  const planning = { ...planningDefaults, ...catalogue.settings.movingLaborPlanning };
  const paymentMethods =
    [
      catalogue.settings.paymentWave !== false ? 'Wave' : '',
      catalogue.settings.paymentCash !== false ? 'espèces' : '',
    ]
      .filter(Boolean)
      .join(' et ') || 'aucun mode de paiement';

  return {
    customPricing,
    assemblyColumns,
    floorSupplement: catalogue.settings.labourFloorPrice ?? 500,
    liftSupplement: catalogue.settings.labourLiftPrice ?? 500,
    vehicles,
    planning,
    paymentMethods,
  };
}

export function assemblyPriceAtSize(input: {
  basePrice: number;
  importedPrice: number;
  unitPrice: number;
  importedUnitPrice: number;
  size: number;
  defaultSize: number;
  savedPrice?: number;
  origin: 'local' | 'import';
}) {
  if (input.savedPrice !== undefined) return input.savedPrice;
  const base = input.origin === 'local' ? input.basePrice : input.importedPrice;
  const unit = input.origin === 'local' ? input.unitPrice : input.importedUnitPrice;
  return base + Math.max(0, input.size - input.defaultSize) * unit;
}

export function labourSettingsMatrix(settings: Settings, scenario: LabourMatrixScenario) {
  const selected = labourScenarios.find((item) => item.id === scenario) ?? labourScenarios[0];
  return labourFloors.map((fromFloor, fromIndex) => ({
    fromFloor,
    prices: labourFloors.map((_, toIndex) =>
      labourUnitPrice(settings, {
        fromFloor: fromIndex,
        toFloor: toIndex,
        fromLift: selected.from,
        toLift: selected.to,
      }),
    ),
  }));
}

export function planningFieldConstraints(key: string) {
  const minByField: Record<string, number> = {
    wbgtAdj: -10,
    heat: 0,
    maxDayHours: 1,
    maxMoversPerVehicle: 2,
    cubicMetersPerHourPerMover: 0.1,
    pauseMinutes: 0,
    handlingCalibration: 0.5,
    carryDistanceMeters: 1,
    defaultStartHour: 0,
  };
  const maxByField: Record<string, number> = {
    metabolicReference: 1500,
    effortGround: 1500,
    effortLift: 1500,
    effortStairs: 1500,
    effortMaximum: 1500,
    effortPerFloor: 200,
    maxTotalHours: 48,
    wbgtAdj: 10,
    heat: 1,
    maxHandlingHours: 12,
    maxDayHours: 16,
    defaultStartHour: 23,
    maxMoversPerVehicle: 20,
    cubicMetersPerHourPerMover: 50,
    teamVolumePerMover: 100,
    handlingCalibration: 5,
    carryDistanceMeters: 200,
  };
  const decimalFields = ['cubicMetersPerHourPerMover', 'teamVolumePerMover', 'handlingCalibration'];
  const halfStepFields = ['wbgtAdj', 'maxHandlingHours', 'maxDayHours'];
  return {
    min: minByField[key] ?? 0.5,
    max: maxByField[key] ?? 180,
    step: decimalFields.includes(key) ? '0.1' : halfStepFields.includes(key) ? '0.5' : 1,
  };
}
