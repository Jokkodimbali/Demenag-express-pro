import { requireValue } from './errors.js';
import type { Options, Price, Settings, Vehicle } from './model.js';
export function tierOf(distance: number, bounds: [number, number, number] = [15, 25, 35]) {
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
    Number.isInteger(trips) && trips >= 1 && trips <= (settings.maxTrips ?? 20),
    'Nombre d’allers-retours invalide.',
  );
  for (const quantity of Object.values(options))
    requireValue(
      Number.isInteger(quantity) && quantity >= 0 && quantity <= (settings.maxOptions ?? 20),
      'Quantité invalide.',
    );
  requireValue(
    Number.isInteger(discount) && discount >= 0 && discount <= 10000000,
    'Remise invalide.',
  );
  requireValue(
    customPrice === null ||
      (Number.isInteger(customPrice) && customPrice > 0 && customPrice <= 10000000),
    'Prix personnalisé invalide.',
  );
  const tier = tierOf(distance, settings.distanceBounds);
  const transport = tier === 3 ? customPrice : vehicle.prices[tier];
  const lines =
    transport === null
      ? []
      : [
          {
            label: `Transport ${vehicle.name} · aller-retour`,
            quantity: trips,
            unitPrice: transport,
            total: transport * trips,
          },
        ];
  for (const [label, quantity, unitPrice] of [
    ['Manœuvre', options.labour, settings.labourPrice],
    ['Menuisier · bureau', options.desk, settings.assemblyPrice],
    ['Menuisier · armoire', options.wardrobe, settings.assemblyPrice],
    ['Menuisier · lit', options.bed, settings.assemblyPrice],
  ] as [string, number, number][])
    if (quantity) lines.push({ label, quantity, unitPrice, total: quantity * unitPrice });
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  requireValue(
    transport === null ? discount === 0 : discount <= subtotal,
    'La remise dépasse le montant du devis.',
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
