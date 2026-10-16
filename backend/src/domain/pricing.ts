import { requireValue } from './errors.js';
import { messages } from './messages/fr.js';
import type { Options, Price, Settings, Vehicle } from './model.js';
export function tierOf(distance: number, bounds: [number, number, number]) {
  requireValue(Number.isFinite(distance) && distance > 0, 'Distance invalide.');
  return distance < bounds[0] ? 0 : distance <= bounds[1] ? 1 : distance <= bounds[2] ? 2 : 3;
}
export function calculatePrice(
  vehicle: Vehicle,
  settings: Settings,
  distance: number,
  options: Options,
  trips = 1,
  customPrice: number | null = null,
  discount = 0,
): Price {
  requireValue(
    Number.isInteger(trips) && trips >= 1 && trips <= settings.maxTrips,
    messages.nombreDAllersRetoursInvalide,
  );
  for (const quantity of Object.values(options))
    requireValue(
      Number.isInteger(quantity) && quantity >= 0 && quantity <= settings.maxOptions,
      messages.quantiteInvalide,
    );
  requireValue(
    Number.isInteger(discount) && discount >= 0 && discount <= 10000000,
    messages.remiseInvalide,
  );
  requireValue(
    customPrice === null ||
      (Number.isInteger(customPrice) && customPrice > 0 && customPrice <= 10000000),
    messages.prixPersonnaliseInvalide,
  );
  const tier = tierOf(distance, settings.distanceBounds);
  const transport = tier === 3 ? customPrice : vehicle.prices[tier];
  const lines =
    transport === null
      ? []
      : [
          {
            label: messages.transportLine(vehicle.name),
            quantity: trips,
            unitPrice: transport,
            total: transport * trips,
          },
        ];
  for (const [label, quantity, unitPrice] of [
    [messages.manUvre, options.labour, settings.labourPrice],
    [messages.menuisierBureau, options.desk, settings.assemblyPrice],
    [messages.menuisierArmoire, options.wardrobe, settings.assemblyPrice],
    [messages.menuisierLit, options.bed, settings.assemblyPrice],
  ] as [string, number, number][])
    if (quantity) lines.push({ label, quantity, unitPrice, total: quantity * unitPrice });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  requireValue(
    transport === null ? discount === 0 : discount <= subtotal,
    messages.laRemiseDepasseLeMontantDuDevis,
  );
  return {
    lines,
    total: transport === null ? null : subtotal - discount,
    discount,
    tier,
    trips,
    currency: 'XOF',
  };
}
