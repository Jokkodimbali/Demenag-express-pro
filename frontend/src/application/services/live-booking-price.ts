import type { Booking, Catalogue, Price, Quote } from '../../domain/model';
import { inventoryAssemblyLines } from '../../domain/inventory-assembly';
import {
  assemblyUnitPrice,
  labourUnitPrice,
  labourUnitPriceOverrideFromQuote,
} from '../../domain/labour-price';
import { referenceTierLabels } from '../../domain/format';

/** Reprice an open estimate against today's catalogue; completed moves remain historical. */
export function liveBookingPrice(
  booking: Booking,
  catalogue?: Catalogue | null,
  quote?: Quote,
): Price {
  const saved =
    quote ??
    (booking.status === 'completed'
      ? booking.quotes.filter((item) => item.kind === 'final').at(-1)
      : undefined) ??
    booking.quotes.at(-1);
  const price = saved?.price ?? booking.estimate;
  if (!catalogue || booking.status === 'completed') return price;
  const { settings } = catalogue;
  const vehicle =
    catalogue.vehicles.find((item) => item.id === booking.vehicle.id) ?? booking.vehicle;
  const bounds = settings.distanceBounds;
  const distance = booking.distanceKm;
  const tier = distance < bounds[0] ? 0 : distance <= bounds[1] ? 1 : distance <= bounds[2] ? 2 : 3;
  const custom =
    saved?.pricingInput?.customPrice ??
    (price.tier === 3
      ? price.lines.find((line) => line.label.startsWith('Transport'))?.unitPrice
      : 0) ??
    0;
  const labourOverride = saved?.pricingInput
    ? saved.pricingInput.labourUnitPriceOverride
    : labourUnitPriceOverrideFromQuote(price, booking.pricingSettings, booking.workAccess);
  const assembly = new Map(
    inventoryAssemblyLines(booking.inventorySnapshot?.sourceInventory, settings).map((line) => [
      line.label,
      line.unitPrice,
    ]),
  );
  const lines = price.lines.map((line) => {
    let unitPrice = line.unitPrice;
    let label = line.label;
    if (label.startsWith('Transport')) {
      unitPrice = tier === 3 ? custom : vehicle.prices[tier];
      label = `Transport ${vehicle.shortName || vehicle.name} · ${referenceTierLabels(bounds)[tier].toLocaleLowerCase('fr')} (aller-retour)`;
    } else if (label.startsWith('Manœuvre'))
      unitPrice = labourOverride ?? labourUnitPrice(settings, booking.workAccess);
    else if (assembly.has(label)) unitPrice = assembly.get(label)!;
    else {
      const key = {
        'Menuisier · bureau': 'bureau',
        'Menuisier · armoire': 'armoire',
        'Menuisier · lit': 'lit',
      }[label];
      if (key) unitPrice = assemblyUnitPrice(settings, key);
    }
    return { ...line, label, unitPrice, total: line.quantity * unitPrice };
  });
  if (!lines.some((line) => line.label.startsWith('Transport'))) {
    const unitPrice = tier === 3 ? custom : vehicle.prices[tier];
    lines.unshift({
      label: `Transport ${vehicle.shortName || vehicle.name} · ${referenceTierLabels(bounds)[tier].toLocaleLowerCase('fr')} (aller-retour)`,
      quantity: price.trips,
      unitPrice,
      total: price.trips * unitPrice,
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const value = price.discountValue ?? price.discount;
  const discount =
    price.discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, value)) / 100)
      : Math.min(subtotal, value);
  return { ...price, tier, lines, discount, total: subtotal - discount };
}
