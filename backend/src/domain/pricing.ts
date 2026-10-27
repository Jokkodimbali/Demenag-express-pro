import { requireValue } from './errors.js';
import { messages } from './messages/fr.js';
import type { Options, Price, Settings, Vehicle, WorkAccess } from './model.js';

const MAX_DATABASE_INTEGER = 2_147_483_647;

const accessLabel = (floor: number, lift: boolean) =>
  `${floor === 0 ? 'RDC' : floor === 1 ? '1er étage' : `${floor}e étage`}${floor > 0 ? (lift ? ' avec ascenseur' : ' sans ascenseur') : ''}`;

export function assemblyUnitPrice(
  settings: Settings,
  key: string,
  origin: 'local' | 'import' = 'local',
  size?: number,
) {
  const configured = settings.montageP?.[key];
  if (!configured) return settings.assemblyPrice;
  const sized = size == null ? undefined : configured.sz?.[String(size)]?.[origin];
  if (Number.isInteger(sized) && sized! >= 0) return sized!;
  const base = configured[origin];
  const fallback =
    Number.isInteger(base) && base! >= 0
      ? base!
      : settings.assemblyPrice * (origin === 'import' ? 1.5 : 1);
  const increment = origin === 'import' ? (configured.uI ?? configured.u) : configured.u;
  return size != null && increment
    ? Math.round(fallback + Math.max(0, size - 1) * increment)
    : fallback;
}

export function labourUnitPrice(settings: Settings, access?: WorkAccess) {
  if (!access) return settings.labourPrice;
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
  labourUnitPriceOverride?: number | null,
  discountType: 'fcfa' | 'pct' = 'fcfa',
  discountReason = '',
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
  requireValue(
    labourUnitPriceOverride == null ||
      (Number.isInteger(labourUnitPriceOverride) &&
        labourUnitPriceOverride > 0 &&
        labourUnitPriceOverride <= 10000000),
    'Prix par manœuvre invalide.',
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
      labourUnitPriceOverride && labourUnitPriceOverride > 0
        ? labourUnitPriceOverride
        : labourUnitPrice(settings, workAccess),
    ],
    [messages.menuisierBureau, options.desk, assemblyUnitPrice(settings, 'bureau')],
    [messages.menuisierArmoire, options.wardrobe, assemblyUnitPrice(settings, 'armoire')],
    [messages.menuisierLit, options.bed, assemblyUnitPrice(settings, 'lit')],
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
  requireValue(discountType === 'fcfa' || discountType === 'pct', messages.remiseInvalide);
  const effectiveDiscount =
    discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, discount)) / 100)
      : Math.min(discount, subtotal);
  const reason = discountReason.trim();
  return {
    lines,
    total: transport === null ? null : subtotal - effectiveDiscount,
    discount: effectiveDiscount,
    discountLabel: `Remise${discountType === 'pct' && discount ? ` (${Math.min(100, discount)} %)` : ''}${reason ? ` · ${reason}` : ''}`,
    discountType,
    discountValue: discount,
    discountReason: reason,
    tier,
    trips,
    currency: 'XOF',
  };
}
