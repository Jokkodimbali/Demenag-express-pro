// Reconstitution des postes enregistrés par la version autonome du devis.
// Le total d'origine reste l'autorité lorsque la sauvegarde contient un ajustement non détaillé.
const tiers = ['Moins de 15 km', '15 – 25 km', '25 – 35 km', 'Plus de 35 km'];
const vehicles = {
  sprinter: { short: 'Mercedes Sprinter', tag: 'Sprinter' },
  trafic: { short: 'Renault Trafic', tag: 'Trafic' },
  master: { short: 'Renault Master', tag: 'Master' },
};
const items = {
  salon: { name: 'salon', size: ['place', 'places', 5] },
  tablem: { name: 'table à manger', size: ['place', 'places', 6] },
  lit: { name: 'lit', size: ['place', 'places', 2] },
  matelas: { name: 'matelas', size: ['place', 'places', 2] },
  armoire: { name: 'armoire', size: ['battant', 'battants', 3] },
  bureau: { name: 'bureau' },
  frigo: { name: 'frigo' },
  meubletv: { name: 'meuble TV' },
  chaise: { name: 'chaise' },
};
const seats = new Set(['salon', 'chaise']);

function line(label, quantity, unitPrice, fixedTotal) {
  return {
    label,
    quantity: Math.max(0, Math.round(Number(quantity) || 0)),
    unitPrice: Math.round(Number(unitPrice) || 0),
    total: fixedTotal ?? Math.round(Number(quantity) * Number(unitPrice)),
  };
}

function mountPrice(key, tariffs, origin, size) {
  const saved = tariffs.montageP?.[key];
  const imported = origin === 'import';
  let base;
  if (saved && typeof saved === 'object') {
    base = Number(imported ? (saved.import ?? saved.local) : saved.local) || 0;
  } else {
    base = Number(saved ?? tariffs.montage) || 0;
    if (imported) base = Math.round(base * 1.5);
  }
  const item = items[key];
  if (item?.size && size != null && saved && typeof saved === 'object') {
    const sized = saved.sz?.[Number(size)];
    if (sized && sized[imported ? 'import' : 'local'] != null)
      return Number(sized[imported ? 'import' : 'local']) || 0;
    base +=
      Math.max(0, Number(size) - item.size[2]) *
      (Number(imported ? (saved.uI ?? saved.u) : saved.u) || 0);
  }
  return base;
}

function menuLines(quote, tariffs) {
  const inventory = quote.inv?.lines || [];
  if (!inventory.length)
    return ['bureau', 'armoire', 'lit']
      .filter((key) => Number(quote[key]) > 0)
      .map((key) =>
        line(
          `Menuisier · démontage / montage ${key}`,
          Number(quote[key]),
          mountPrice(key, tariffs),
        ),
      );

  const grouped = new Map();
  for (const source of inventory) {
    const count = Number(source.q) || 0;
    if (count <= 0 || source.k === 'clim' || !(source.dm || (seats.has(source.k) && source.mn)))
      continue;
    const item = items[source.k];
    if (!item && !tariffs.montageP?.[source.k]) continue;
    const origin = source.o === 'import' ? 'import' : 'local';
    const size = item?.size && source.s != null ? Number(source.s) : null;
    const sizeLabel = size == null ? '' : ` ${size} ${size > 1 ? item.size[1] : item.size[0]}`;
    const name = `${source.k === 'custom' ? String(source.name || 'autre objet').trim() : item?.name || source.n || source.k}${sizeLabel} (${origin === 'import' ? 'importé' : 'local'})`;
    const key = `${source.k}|${name}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      key: source.k,
      name,
      quantity: (previous?.quantity || 0) + count,
      origin,
      size,
    });
  }
  return [...grouped.values()].map((entry) =>
    line(
      `Menuisier · démontage / montage ${entry.name}`,
      entry.quantity,
      mountPrice(entry.key, tariffs, entry.origin, entry.size),
    ),
  );
}

function tierOf(value) {
  return value < 15 ? 0 : value <= 25 ? 1 : value <= 35 ? 2 : 3;
}

function floorLabel(floor, lift) {
  const value = Number(floor) || 0;
  return `${value === 0 ? 'RDC' : value === 1 ? '1er' : `${value}e`}${value > 0 ? (lift ? ' avec asc.' : ' sans asc.') : ''}`;
}

function labourSupplement(floor, lift, tariffs) {
  const value = Number(floor) || 0;
  if (value <= 0) return 0;
  return lift ? Number(tariffs.manAsc ?? 500) : value * Number(tariffs.manEtage ?? 500);
}

export function legacyQuotePrice(record) {
  const quote = record.devis;
  const tariffs = record.pz?.tarifs || {};
  if (!quote || !vehicles[quote.vehicle] || !Array.isArray(tariffs[quote.vehicle]))
    throw new Error('Devis historique sans véhicule ou grille tarifaire exploitable.');
  const tier =
    quote.km !== undefined && quote.km !== '' && quote.km !== null
      ? tierOf(Number(quote.km))
      : Number(quote.tier) || 0;
  const trips = Math.max(1, Number(quote.trips) || 1);
  const vehicle = vehicles[quote.vehicle];
  const unit = tier < 3 ? Number(tariffs[quote.vehicle][tier]) || 0 : Number(quote.custom) || 0;
  const transportLabel = `Transport ${vehicle.short} · ${tiers[tier].toLowerCase()}${tier === 3 ? (unit > 0 ? ', prix fixé' : ', prix à fixer') : ''}`;
  const nextTripRate = Math.max(10, Math.min(100, Number(tariffs.tripDeg ?? 100) || 100)) / 100;
  const lines =
    trips > 1 && nextTripRate < 1
      ? [
          line(`${transportLabel} · 1er aller-retour`, 1, unit),
          line(
            `Allers-retours suivants (${Math.round(nextTripRate * 100)} % du 1er)`,
            trips - 1,
            Math.round((unit * nextTripRate) / 500) * 500,
          ),
        ]
      : [line(`${transportLabel} (aller-retour)`, trips, unit)];

  const slowDayPercent = Number(tariffs.creux) || 0;
  if (slowDayPercent > 0 && quote.date && !quote.noDate) {
    const date = new Date(`${quote.date}T12:00:00`);
    if (date.getDay() >= 1 && date.getDay() <= 4 && date.getDate() >= 6 && date.getDate() <= 24) {
      const transportTotal = lines.reduce((sum, item) => sum + item.total, 0);
      const reduction = Math.round((transportTotal * slowDayPercent) / 100 / 500) * 500;
      if (reduction > 0)
        lines.push(
          line(`Remise jour creux (−${slowDayPercent} % sur le transport)`, 1, -reduction),
        );
    }
  }

  const rental = quote.bill === 'loc';
  if (quote.man && !rental) {
    const inv = quote.inv;
    const unitPrice =
      Number(quote.manPu) > 0
        ? Number(quote.manPu)
        : (Number(tariffs.manoeuvre) || 0) +
          (inv
            ? labourSupplement(inv.fEt, inv.fAsc, tariffs) +
              labourSupplement(inv.tEt, inv.tAsc, tariffs)
            : 0);
    lines.push(
      line(
        `Manœuvre${inv ? ` (${floorLabel(inv.fEt, inv.fAsc)} → ${floorLabel(inv.tEt, inv.tAsc)})` : ''}`,
        Number(quote.man),
        unitPrice,
      ),
    );
  }
  if ((!rental && !quote.noMenu) || (rental && quote.locMenu))
    lines.push(...menuLines(quote, tariffs));

  const tollPoints = record.pz?.peages || [];
  for (const toll of tollPoints) {
    const quantity = Number(quote.peages?.[toll.id]) || 0;
    if (quantity <= 0) continue;
    const unitPrice = Number(toll.prices?.[quote.vehicle] ?? toll.price) || 0;
    lines.push(
      line(
        `${/^péage/iu.test(toll.name) ? toll.name : `Péage · ${toll.name}`} (${vehicle.tag})`,
        quantity,
        unitPrice,
      ),
    );
  }
  const subtotal = lines.reduce((sum, item) => sum + item.total, 0);
  const discountValue = Math.max(0, Number(quote.remise) || 0);
  const percentage = quote.remiseType === 'pct';
  const discount = percentage
    ? Math.round((subtotal * Math.min(100, discountValue)) / 100)
    : Math.min(discountValue, subtotal);
  const calculatedTotal = Math.max(0, subtotal - discount);
  const savedTotal = Math.round(Number(quote.total));
  if (!Number.isFinite(savedTotal)) throw new Error('Montant historique du devis invalide.');
  const adjustment = savedTotal - calculatedTotal;
  if (adjustment !== 0)
    lines.push(line('Ajustement historique conservé depuis la sauvegarde', 1, adjustment));
  const discountReason = String(quote.remiseWhy || '').trim();
  const discountLabel = `Remise${percentage && discountValue ? ` (${Math.min(100, discountValue)} %)` : ''}${discountReason ? ` · ${discountReason}` : ''}`;
  return {
    lines,
    total: savedTotal,
    discount,
    discountLabel,
    discountType: percentage ? 'pct' : 'fcfa',
    discountValue,
    discountReason,
    tier,
    trips,
    currency: 'XOF',
    legacyAdjustment: adjustment,
  };
}
