import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type { MovingEstimate } from '../../../../moving/domain/estimate/moving-estimate';
import type { Vehicle } from '../../../../shared/domain/model';
import type { Settings } from '../../../../shared/domain/model';
import { estimateMovingWork } from '../../../../moving/domain/estimate/moving-estimate';
import { vehicleDimensionWarnings } from '../../../../moving/domain/vehicle-dimensions';
import { createAdminQuotePreview } from './admin-quote-preview';
import { simulationInput } from '../../../../booking/application/services/loading-simulation-model';

export type CheaperVehicle = { vehicle: Vehicle; trips: number; total: number; savings: number };

export function vehicleFitWarnings(
  inventory: Inventory,
  vehicle: Vehicle,
  settings: Settings,
): string[] {
  const stock = settings.movingLaborPlanning?.blanketStock ?? 0;
  const blanketLength = settings.movingLaborPlanning?.blanketLengthCm ?? 204;
  const blanketWidth = settings.movingLaborPlanning?.blanketWidthCm ?? 184;
  try {
    const plan = window.DemSim?.plan(
      simulationInput(inventory, vehicle, stock, blanketLength, blanketWidth),
    );
    if (plan) return plan.out;
  } catch {
    // Fall back to the dimension checks if the 3D engine is not ready yet.
  }
  return vehicleDimensionWarnings(inventory, vehicle);
}

export function cheaperCompatibleVehicle(input: {
  inventory: Inventory;
  current: Vehicle;
  vehicles: Vehicle[];
  route: { distanceKm: number; durationMinutes: number } | null;
  date: string;
  month: string;
  fromAddress: string;
  toAddress: string;
  startTime: string;
  hasToll: boolean;
  settings?: Settings;
  estimate: MovingEstimate | null;
}): CheaperVehicle | null {
  if (!input.route || !input.settings || !input.estimate || input.estimate.volume === 0)
    return null;
  const settings = input.settings;
  const estimateFor = (vehicle: Vehicle) =>
    estimateMovingWork(input.inventory, vehicle, input.route, {
      startTime: input.startTime,
      laborPlanning: settings.movingLaborPlanning,
      date: input.date,
      month: input.month,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      hasToll: input.hasToll,
    });
  const currentEstimate = estimateFor(input.current);
  const currentWarnings = vehicleFitWarnings(input.inventory, input.current, settings);
  if (currentWarnings.length) return null;
  const priceFor = (vehicle: Vehicle, estimate: MovingEstimate) => {
    const draft = {
      vehicleId: vehicle.id,
      customerName: '',
      customerPhone: '',
      source: '',
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      fromNote: '',
      toNote: '',
      from: null,
      to: null,
      route: null,
      distanceKmOverride: input.route?.distanceKm ?? null,
      date: input.date,
      noDate: false,
      month: input.month,
      timeSlot: input.startTime,
      estimatedTrips: estimate.trips,
      options: { labour: estimate.crew, desk: 0, wardrobe: 0, bed: 0 },
      notes: '',
      inventory: input.inventory,
      questionnaireAnswers: {},
      requestId: 'vehicle-price',
    };
    const config = {
      trips: estimate.trips,
      calcMode: 'auto' as const,
      legMinutes: 0,
      trafficOff: false,
      heatOff: false,
      heatRest: 0,
      discount: 0,
      discountType: 'fcfa' as const,
      discountReason: '',
      customPrice: null,
      labourUnitPriceOverride: null,
      billingMode: 'complete' as const,
      menuIncluded: false,
      overtimeMinutes: 0,
      rentalKit: null,
    };
    return createAdminQuotePreview({
      draft,
      estimateInventory: input.inventory,
      config,
      vehicle,
      estimate,
      settings,
      price: null,
      extras: [
        ['labour', 'Manœuvres', 'Manœuvres'],
        ['desk', 'Bureau', 'Bureau'],
        ['wardrobe', 'Armoire', 'Armoire'],
        ['bed', 'Lit', 'Lit'],
      ],
      labourPrice: settings.labourPrice,
      simulationNeeds: null,
    }).total;
  };
  const currentTotal = priceFor(input.current, currentEstimate);
  const options = input.vehicles
    .filter((vehicle) => vehicle.id !== input.current.id && vehicle.active !== false)
    .map((vehicle) => ({ vehicle, estimate: estimateFor(vehicle) }))
    .filter(({ vehicle }) => vehicleFitWarnings(input.inventory, vehicle, settings).length === 0)
    .map(({ vehicle, estimate }) => ({ vehicle, estimate, total: priceFor(vehicle, estimate) }))
    .sort((left, right) => left.total - right.total);
  const best = options[0];
  if (!best || currentTotal - best.total < 500) return null;
  return {
    vehicle: best.vehicle,
    trips: best.estimate.trips,
    total: best.total,
    savings: currentTotal - best.total,
  };
}
