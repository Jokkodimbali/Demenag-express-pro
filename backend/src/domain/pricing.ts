import { requireValue } from './errors.js';
import { messages } from './messages/fr.js';
import type { Options, Price, Settings, Vehicle, WorkAccess } from './model.js';

const MAX_DATABASE_INTEGER = 2_147_483_647;

const accessLabel = (floor: number, lift: boolean) =>
  `${floor === 0 ? 'RDC' : floor === 1 ? '1er étage' : `${floor}e étage`}${floor > 0 ? (lift ? ' avec ascenseur' : ' sans ascenseur') : ''}`;

export function labourUnitPrice(settings: Settings, access?: WorkAccess) {
  if (!access) return settings.labourMatrix?.none?.[0]?.[0] ?? settings.labourPrice;
  const scenario = access.fromLift
    ? access.toLift
      ? 'both'
      : 'from'
    : access.toLift
      ? 'to'
      : 'none';
  const matrixPrice = settings.labourMatrix?.[scenario]?.[access.fromFloor]?.[access.toFloor];
  if (Number.isInteger(matrixPrice) && matrixPrice! >= 0) return matrixPrice!;
  const surcharge = (floor: number, lift: boolean) =>
    floor <= 0
      ? 0
      : lift
        ? (settings.labourLiftPrice ?? 500)
        : floor * (settings.labourFloorPrice ?? 500);
  return (
    settings.labourPrice +
    surcharge(access.fromFloor, access.fromLift) +
    surcharge(access.toFloor, access.toLift)
  );
}
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
  extraLines: Array<{ label: string; quantity: number; unitPrice: number }> = [],
  workAccess?: WorkAccess,
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
  const transport = customPrice ?? (tier === 3 ? null : vehicle.prices[tier]);
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
  const accessDescription = workAccess
    ? ` (${accessLabel(workAccess.fromFloor, workAccess.fromLift)} → ${accessLabel(workAccess.toFloor, workAccess.toLift)})`
    : '';
  for (const [label, quantity, unitPrice] of [
    [
      `${messages.manUvre}${accessDescription}`,
      options.labour,
      labourUnitPrice(settings, workAccess),
    ],
    [messages.menuisierBureau, options.desk, settings.assemblyPrice],
    [messages.menuisierArmoire, options.wardrobe, settings.assemblyPrice],
    [messages.menuisierLit, options.bed, settings.assemblyPrice],
  ] as [string, number, number][])
    if (quantity) lines.push({ label, quantity, unitPrice, total: quantity * unitPrice });
  for (const line of extraLines) {
    requireValue(
      line.label.trim().length >= 2 &&
        Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        Number.isInteger(line.unitPrice) &&
        line.unitPrice > 0,
      messages.chargeSupplementaireInvalide,
    );
    lines.push({
      label: line.label.trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
    });
  }
  requireValue(
    lines.every((line) => Number.isSafeInteger(line.total) && line.total <= MAX_DATABASE_INTEGER),
    messages.montantDuDevisDepasseLimiteDeStockage,
  );
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  requireValue(
    Number.isSafeInteger(subtotal) && subtotal <= MAX_DATABASE_INTEGER,
    messages.montantDuDevisDepasseLimiteDeStockage,
  );
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
