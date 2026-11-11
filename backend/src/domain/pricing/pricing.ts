import { requireValue } from '../shared/errors.js';
import { messages } from '../shared/messages/fr.js';
import type { Options, Price, QuotePricingSettings, Vehicle, WorkAccess } from '../shared/model.js';
import { referenceLowDemandDiscount, referenceTransportLines } from './reference-pricing.js';
import { referenceAssemblyPriceDefaults } from '../../../../shared/reference-assembly-price-defaults.js';

const MAX_DATABASE_INTEGER = 2_147_483_647;

const accessLabel = (floor: number, lift: boolean) =>
  `${floor === 0 ? 'RDC' : floor === 1 ? '1er' : `${floor}e`}${floor > 0 ? (lift ? ' avec asc.' : ' sans asc.') : ''}`;

export function assemblyUnitPrice(
  settings: QuotePricingSettings,
  key: string,
  origin: 'local' | 'import' = 'local',
  size?: number,
  defaultSize = 1,
) {
  const legacyKey =
    key === 'tablem'
      ? 'table-manger'
      : key === 'biblio'
        ? 'bibliotheque'
        : key === 'congel'
          ? 'congelateur'
          : key === 'mal'
            ? 'machine-laver'
            : key === 'micro'
              ? 'micro-ondes'
              : key === 'clim'
                ? 'climatiseur'
                : key === 'ventilo'
                  ? 'ventilateur'
                  : key;
  const configuredValue =
    settings.montageP?.[key] ??
    settings.montageP?.[legacyKey] ??
    referenceAssemblyPriceDefaults[key as keyof typeof referenceAssemblyPriceDefaults];
  const configured = configuredValue as
    | number
    | {
        local?: number;
        import?: number;
        u?: number;
        uI?: number;
        sz?: Record<string, { local?: number; import?: number }>;
      }
    | undefined;
  if (configured == null)
    return origin === 'import' ? Math.round(settings.assemblyPrice * 1.5) : settings.assemblyPrice;
  if (typeof configured === 'number')
    return origin === 'import' ? Math.round(configured * 1.5) : configured;
  const sized = size == null ? undefined : configured.sz?.[String(size)]?.[origin];
  if (Number.isInteger(sized) && sized! >= 0) return sized!;
  const base = origin === 'import' ? (configured.import ?? configured.local) : configured.local;
  const fallback = Number.isInteger(base) && base! >= 0 ? base! : 0;
  const increment = origin === 'import' ? (configured.uI ?? configured.u) : configured.u;
  return size != null && increment
    ? Math.round(fallback + Math.max(0, size - defaultSize) * increment)
    : fallback;
}

export function labourUnitPrice(settings: QuotePricingSettings, access?: WorkAccess) {
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
  requireValue(Number.isFinite(distance) && distance >= 0, 'Distance invalide.');
  return distance < bounds[0] ? 0 : distance <= bounds[1] ? 1 : distance <= bounds[2] ? 2 : 3;
}
export function calculatePrice(
  vehicle: Vehicle,
  settings: QuotePricingSettings,
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
  workDate?: string | null,
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
      (Number.isInteger(customPrice) && customPrice >= 0 && customPrice <= 10000000),
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
  const transport = tier === 3 ? (customPrice ?? 0) : vehicle.prices[tier];
  const [firstBound, secondBound, thirdBound] = settings.distanceBounds;
  const transportTier = [
    `moins de ${firstBound} km`,
    `${firstBound} – ${secondBound} km`,
    `${secondBound} – ${thirdBound} km`,
    `plus de ${thirdBound} km`,
  ][tier];
  const transportLabel = `Transport ${vehicle.name || vehicle.shortName || ''} · ${transportTier}${tier === 3 ? (transport > 0 ? ', prix fixé' : ', prix à fixer') : ''}`;
  const lines = referenceTransportLines(
    transportLabel,
    transport,
    trips,
    settings.movingLaborPlanning?.followingTripDiscountPercent ?? 100,
  );
  const transportTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const lowDemandDiscount = referenceLowDemandDiscount(
    transportTotal,
    workDate,
    settings.movingLaborPlanning?.lowDemandDiscountPercent ?? 0,
  );
  if (lowDemandDiscount > 0)
    lines.push({
      label: `Remise jour creux (−${settings.movingLaborPlanning?.lowDemandDiscountPercent ?? 0} % sur le transport)`,
      quantity: 1,
      unitPrice: -lowDemandDiscount,
      total: -lowDemandDiscount,
    });
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
        (Number.isInteger(line.quantity) ||
          (line.label.startsWith('Manœuvres · heures au-delà') &&
            line.quantity >= 0.5 &&
            (line.quantity * 2) % 1 === 0)) &&
        line.quantity >= 0.5 &&
        Number.isInteger(line.unitPrice) &&
        (line.unitPrice >= 0 || line.label.startsWith('Remise jour creux')),
      messages.chargeSupplementaireInvalide,
    );
    lines.push({
      label: line.label.trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: Math.round(line.quantity * line.unitPrice),
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
    total: subtotal - effectiveDiscount,
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
