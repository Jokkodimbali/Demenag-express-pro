import {
  blankInventory,
  inventoryItems,
} from '../../frontend/src/modules/moving/domain/inventory/inventory.js';
import { referenceInventoryAliases } from '../../frontend/src/modules/moving/domain/inventory/inventory-assembly.js';
import {
  bookingInventorySnapshot,
  estimateMovingWork,
} from '../../frontend/src/modules/moving/domain/estimate/moving-estimate.js';
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
const number = (value, fallback = 0) =>
  value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
const aliases = new Map(
  Object.entries(referenceInventoryAliases).map(([key, alias]) => [alias, key]),
);
const formats = { p: 'small', m: 'medium', g: 'large' };
function legacyInventorySource(record) {
  const saved = object(record);
  const inv = object(saved.inv ?? object(saved.devis).inv);
  if (!Array.isArray(inv.lines)) return null;
  const inventory = {
    ...blankInventory(),
    dwellingType: String(inv.logement ?? ''),
    fromFloor: number(inv.fEt),
    toFloor: number(inv.tEt),
    fromLift: inv.fAsc === true,
    toLift: inv.tAsc === true,
    flags: Object.fromEntries(
      Object.entries(object(inv.opts)).map(([key, value]) => [key, value === true]),
    ),
    ready: inv.ready === 'oui' || inv.ready === 'non' ? inv.ready : '',
    stairs: ['oui', 'non', 'balcon', 'verif'].includes(String(inv.stairs)) ? inv.stairs : '',
    ...(typeof inv.annexOn === 'boolean' ? { annexOn: inv.annexOn } : {}),
    ...(inv.crew != null ? { crew: number(inv.crew) } : {}),
    ...(inv.balcPx != null ? { balcPx: number(inv.balcPx) } : {}),
  };
  inv.lines.forEach((raw, index) => {
    const line = object(raw);
    const legacyKey = String(line.k);
    const key = aliases.get(legacyKey) ?? legacyKey;
    const definition = inventoryItems.find((item) => item.key === key);
    const format = formats[String(line.g)] ?? 'medium';
    const entry = {
      quantity: number(line.q),
      size: number(line.s, definition?.defaultSize ?? 1),
      dismantle: line.dm === true,
      menuisier: line.mn === true,
      origin: line.o === 'import' ? 'import' : 'local',
      format,
    };
    const id = `legacy-${String(line.u ?? index)}-${index}`;
    if (key === 'custom') {
      const custom = {
        id,
        label: String(line.n ?? line.name ?? ''),
        quantity: entry.quantity,
        format,
        dismantle: entry.dismantle,
        origin: entry.origin,
      };
      for (const field of ['cL', 'cW', 'cH', 'kg', 'mp', 'menuPriceLocal', 'menuPriceImport']) {
        if (line[field] != null) custom[field] = number(line[field]);
      }
      for (const field of ['up', 'frag', 'notop']) {
        if (typeof line[field] === 'boolean') custom[field] = line[field];
      }
      if (typeof line.like === 'string') custom.like = aliases.get(line.like) ?? line.like;
      inventory.custom.push(custom);
    } else {
      if (!definition) throw new Error(`Type d'inventaire inconnu : ${legacyKey}`);
      if (!inventory.entries[key]) inventory.entries[key] = entry;
      else inventory.variants.push({ id, itemKey: key, ...entry });
    }
  });
  return inventory;
}
function legacyInventorySnapshot(record, vehicle) {
  const inventory = legacyInventorySource(record);
  if (!inventory) return null;
  const row = object(record);
  const quote = { ...row, ...object(row.devis) };
  const estimate = estimateMovingWork(
    inventory,
    vehicle,
    {
      distanceKm: number(quote.km),
      durationMinutes: number(quote.dur),
    },
    {
      trips: number(quote.trips, 1),
      crew: inventory.crew,
      startTime: String(quote.start ?? row.time ?? '08:00'),
      date: String(quote.date ?? ''),
      month: String(quote.month ?? ''),
      ignoreTraffic: quote.trafOff === true,
      heatOff: quote.heatOff === true,
      heatRest: number(quote.heatRest),
      manualLegMinutes: quote.calcMode === 'manual' ? number(quote.legMan) : void 0,
      ignoreDismantling: quote.noMenu === true || (quote.bill === 'loc' && quote.locMenu !== true),
    },
  );
  return bookingInventorySnapshot(inventory, estimate);
}
function missingLegacyInventoryPatch(booking) {
  if (!booking.legacyDesktopRecord || booking.inventorySnapshot) return null;
  const snapshot = legacyInventorySnapshot(booking.legacyDesktopRecord, booking.vehicle);
  if (!snapshot) return null;
  return { inventorySnapshot: snapshot };
}
export { legacyInventorySnapshot, legacyInventorySource, missingLegacyInventoryPatch, object };
