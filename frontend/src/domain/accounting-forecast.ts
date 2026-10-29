import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  Booking,
  BookingInventorySource,
} from './model';
import { inventoryItems } from './inventory';

export const advertisingChannels = [
  'Facebook',
  'YouTube',
  'Instagram',
  'Snapchat',
  'TikTok',
  'Autre pub',
] as const;

const accountingItemAliases: Record<string, string> = {
  'table-basse': 'tbasse',
  'meuble-tv': 'meubletv',
  television: 'tv',
  'table-manger': 'tablem',
  bibliotheque: 'biblio',
  congelateur: 'congel',
  'machine-laver': 'mal',
  'micro-ondes': 'micro',
  climatiseur: 'clim',
  ventilateur: 'ventilo',
};

export const accountingItemKey = (key: string) => accountingItemAliases[key] ?? key;

export function accountingMenuPrice(
  config: AccountingFinanceConfiguration,
  itemKey: string,
  origin: 'local' | 'import',
  size?: number,
) {
  const price = config.menuPrices?.[accountingItemKey(itemKey)];
  const sized = size == null ? undefined : price?.sz?.[String(size)]?.[origin];
  if (sized != null) return asInt(sized);
  const base = price?.[origin] ?? (origin === 'import' ? 10_000 : 5_000);
  return asInt(base);
}

export function accountingMenuAmount(
  source: BookingInventorySource | undefined,
  config: AccountingFinanceConfiguration,
) {
  if (!source) return { count: 0, amount: 0 };
  const items = new Map(inventoryItems.map((item) => [item.key, item]));
  let count = 0;
  let amount = 0;
  const add = (
    key: string,
    quantity: number,
    size: number,
    origin: 'local' | 'import' | undefined,
    dismantle: boolean,
    menuisier: boolean,
  ) => {
    const normalizedKey = accountingItemKey(key);
    if (
      quantity <= 0 ||
      normalizedKey === 'clim' ||
      !(dismantle || (['salon', 'chaise'].includes(normalizedKey) && menuisier))
    )
      return;
    const item = items.get(key);
    const useSize = item?.sizeLabel ? size : undefined;
    const price = accountingMenuPrice(
      config,
      normalizedKey,
      origin === 'import' ? 'import' : 'local',
      useSize,
    );
    count += quantity;
    amount += quantity * price;
  };
  for (const [key, item] of Object.entries(source.entries)) {
    add(key, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  }
  for (const item of source.variants) {
    add(item.itemKey, item.quantity, item.size, item.origin, item.dismantle, !!item.menuisier);
  }
  for (const item of source.custom) {
    add('custom', item.quantity, 1, item.origin, !!item.dismantle, false);
  }
  return { count, amount: asInt(amount) };
}

const asInt = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);
const monthAfter = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
};

export function defaultAccountingFinanceConfiguration(
  now = new Date(),
): AccountingFinanceConfiguration {
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
  })
    .formatToParts(now)
    .reduce(
      (result, part) => ({ ...result, [part.type]: part.value }),
      {} as Record<string, string>,
    );
  const currentMonth = `${month.year}-${month.month}`;
  return {
    regime: 'auto',
    suarlFrom: '',
    isRate: 30,
    start: currentMonth,
    debt: 30_000_000,
    debtMonths: 18,
    fleetValue: 30_000_000,
    fleetYears: 7,
    newVehicleTarget: 12_000_000,
    profitCapPercent: 50,
    moverCostPerMove: 5000,
    menuPrices: {},
    salaries: [
      { id: 'default-developpeur', name: 'Développeur', amount: 250_000 },
      { id: 'default-amadou', name: 'Amadou', amount: 100_000 },
      { id: 'default-issa', name: 'Issa', amount: 100_000 },
      { id: 'default-layine', name: 'Layine', amount: 100_000 },
      { id: 'default-babacar', name: 'Babacar', amount: 150_000 },
    ],
    annexes: [],
    vehiclePurchases: [],
    advertising: {},
  };
}

export function jobLabourEntries(
  bookings: Booking[],
  config: AccountingFinanceConfiguration,
): AccountingEntry[] {
  return bookings.flatMap((booking) => {
    const final = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
    if (!final || final.price.total === null) return [];
    const calculatedMovers =
      booking.crew?.manoeuvre.length ||
      final.price.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
      booking.estimate.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
      booking.inventorySnapshot?.sourceInventory?.crew ||
      0;
    const movers = final.accountingCosts?.movers ?? calculatedMovers;
    const labourCost =
      final.accountingCosts?.moverAmount ?? asInt(movers * config.moverCostPerMove);
    const source = booking.inventorySnapshot?.sourceInventory;
    const menu = accountingMenuAmount(source, config);
    const carpenters = final.accountingCosts?.carpenters ?? menu.count;
    const assemblyCost = final.accountingCosts?.carpenterAmount ?? menu.amount;
    const date = final.createdAt.slice(0, 10) || booking.date;
    if (!date) return [];
    const estimatedRate = final.accountingCosts ? '' : ' · tarif actuel estimatif';
    const entries: AccountingEntry[] = [];
    if (labourCost > 0)
      entries.push({
        id: `auto-labour-${booking.id}`,
        type: 'charge',
        category: 'Manœuvres',
        label: `Manœuvres ${movers} · ${booking.reference}${estimatedRate}`,
        amount: labourCost,
        date,
        automatic: true,
        bookingId: booking.id,
        bookingReference: booking.reference,
      });
    if (assemblyCost > 0)
      entries.push({
        id: `auto-assembly-${booking.id}`,
        type: 'charge',
        category: 'Menuisier',
        label: `Menuisier ${carpenters} meuble(s) · ${booking.reference}${estimatedRate}`,
        amount: assemblyCost,
        date,
        automatic: true,
        bookingId: booking.id,
        bookingReference: booking.reference,
      });
    return entries;
  });
}

export type FinanceMonth = {
  key: string;
  revenue: number;
  journalCharges: number;
  salaries: number;
  movers: number;
  moverCount: number;
  carpenters: number;
  advertising: number;
  costs: number;
  profit: number;
  budget: number;
  debtDue: number;
  debtPaid: number;
  fleetDue: number;
  fleetPaid: number;
  annexDue: number;
  annexPaid: number;
  reserveDue: number;
  reservePaid: number;
  tax: number;
  cash: number;
  debtLeft: number;
  fleetAmortized: number;
  fleetBase: number;
  reserve: number;
  vehiclePurchase: number;
  carry: number;
  net: number;
  suarl: boolean;
};
export type SyscohadaLine = {
  date: string;
  account: string;
  label: string;
  debit: number;
  credit: number;
};

export function simulateAccounting(
  config: AccountingFinanceConfiguration,
  entries: AccountingEntry[],
  bookings: Booking[],
  endMonth: string,
): {
  months: FinanceMonth[];
  debtLeft: number;
  reserve: number;
  fleetAmortized: number;
  paidOff: string;
} {
  const monthKeys: string[] = [];
  let key = config.start;
  while (key <= endMonth && monthKeys.length < 240) {
    monthKeys.push(key);
    key = monthAfter(key);
  }
  let debtLeft = config.debt;
  let debtCarry = 0;
  let fleetAmortized = 0;
  let fleetCarry = 0;
  let reserve = 0;
  let reserveCarry = 0;
  let paidOff = config.debt <= 0 ? config.start : '';
  const annexState = config.annexes.map((annex) => ({ ...annex, amortized: 0, carry: 0 }));
  const debtMonthly = Math.round(config.debt / Math.max(1, config.debtMonths));
  const reserveMonthly = Math.round(config.newVehicleTarget / 12);

  const months = monthKeys.map((month) => {
    const monthEntries = entries.filter((entry) => entry.date.slice(0, 7) === month);
    const revenue = monthEntries
      .filter((entry) => entry.type === 'revenu')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const journalCharges = monthEntries
      .filter(
        (entry) => entry.type === 'charge' && !(entry.automatic && entry.category === 'Publicité'),
      )
      .reduce((sum, entry) => sum + entry.amount, 0);
    const finalBookings = bookings.filter(
      (booking) =>
        booking.status !== 'cancelled' &&
        booking.date?.slice(0, 7) === month &&
        booking.quotes.some((quote) => quote.kind === 'final'),
    );
    const moverCount = finalBookings.reduce((sum, booking) => {
      const final = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
      return (
        sum +
        (booking.crew?.manoeuvre.length ||
          final?.price.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
          booking.estimate.lines.find((line) => /man[œo]uvre/i.test(line.label))?.quantity ||
          booking.inventorySnapshot?.sourceInventory?.crew ||
          0)
      );
    }, 0);
    const movers = monthEntries
      .filter((entry) => entry.type === 'charge' && entry.category === 'Manœuvres')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const carpenters = monthEntries
      .filter((entry) => entry.type === 'charge' && entry.category === 'Menuisier')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const salaries = config.salaries.reduce((sum, salary) => sum + asInt(salary.amount), 0);
    const advertising = Object.values(config.advertising[month] ?? {}).reduce(
      (sum, amount) => sum + asInt(amount),
      0,
    );
    const vehiclePurchase = config.vehiclePurchases
      .filter((purchase) => purchase.month === month)
      .reduce((sum, purchase) => sum + asInt(purchase.price), 0);
    reserve = Math.max(0, reserve - vehiclePurchase);
    const fleetBase =
      config.fleetValue +
      config.vehiclePurchases
        .filter((purchase) => purchase.month <= month)
        .reduce((sum, purchase) => sum + asInt(purchase.price), 0);
    const costs = journalCharges + salaries + advertising;
    const profit = revenue - costs;
    const initialBudget = profit > 0 ? (profit * config.profitCapPercent) / 100 : 0;
    let budget = initialBudget;
    const pay = (due: number) => {
      const paid = Math.max(0, Math.min(due, budget));
      budget -= paid;
      return paid;
    };
    const debtDue = Math.min(debtLeft, debtMonthly + debtCarry);
    const debtPaid = pay(debtDue);
    debtLeft -= debtPaid;
    debtCarry = debtDue - debtPaid;
    const fleetDue = Math.max(
      0,
      Math.min(
        fleetBase - fleetAmortized,
        fleetBase / (Math.max(1, config.fleetYears) * 12) + fleetCarry,
      ),
    );
    const fleetPaid = pay(fleetDue);
    fleetAmortized += fleetPaid;
    fleetCarry = fleetDue - fleetPaid;
    let annexDue = 0;
    let annexPaid = 0;
    for (const annex of annexState) {
      const due = Math.max(
        0,
        Math.min(
          annex.value - annex.amortized,
          annex.value / (Math.max(1, annex.years) * 12) + annex.carry,
        ),
      );
      const paid = pay(due);
      annex.amortized += paid;
      annex.carry = due - paid;
      annexDue += due;
      annexPaid += paid;
    }
    const reserveDue = reserveMonthly + reserveCarry;
    const reservePaid = pay(reserveDue);
    reserve += reservePaid;
    reserveCarry = reserveDue - reservePaid;
    const suarl =
      config.regime === 'suarl'
        ? !config.suarlFrom || month >= config.suarlFrom
        : config.regime === 'auto'
          ? Boolean(paidOff && month > paidOff)
          : false;
    if (!paidOff && debtLeft <= 0.5) paidOff = month;
    const taxableResult = profit - fleetPaid - annexPaid;
    const tax = suarl ? (Math.max(0, taxableResult) * config.isRate) / 100 : 0;
    const cash = profit - debtPaid - reservePaid - tax;
    const carry =
      debtDue - debtPaid + fleetDue - fleetPaid + annexDue - annexPaid + reserveDue - reservePaid;
    const net = taxableResult - tax;
    return {
      key: month,
      revenue,
      journalCharges,
      salaries,
      movers,
      moverCount,
      carpenters,
      advertising,
      costs,
      profit,
      budget: initialBudget,
      debtDue,
      debtPaid,
      fleetDue,
      fleetPaid,
      annexDue,
      annexPaid,
      reserveDue,
      reservePaid,
      tax,
      cash,
      debtLeft,
      fleetAmortized,
      fleetBase,
      reserve,
      vehiclePurchase,
      carry,
      net,
      suarl,
    };
  });
  return { months, debtLeft, reserve, fleetAmortized, paidOff };
}

const accountByCategory: Record<string, string> = {
  Salaires: '661',
  Manœuvres: '637',
  Menuisier: '637',
  Carburant: '605',
  'Entretien véhicule': '624',
  Assurance: '625',
  Loyer: '622',
  'Téléphone / Internet': '628',
  Publicité: '627',
  'Péage / Parking': '618',
  'Impôts et taxes': '641',
  'Autre charge': '658',
  Déménagement: '706',
  'Location véhicule': '706',
  'Autre revenu': '758',
};

export const accountNames: Record<string, string> = {
  '571': 'Caisse',
  '521': 'Banque (réserve véhicule)',
  '245': 'Matériel de transport',
  '2845': 'Amortissements matériel de transport',
  '2848': 'Amortissements autres immobilisations',
  '168': 'Emprunt auprès du père',
  '637': 'Personnel extérieur (manœuvres)',
  '681': 'Dotations aux amortissements',
  '891': 'Impôt sur le résultat',
  '441': 'État, impôt sur les bénéfices',
  '661': 'Rémunérations du personnel',
  '605': 'Autres achats (carburant)',
  '624': 'Entretien et réparations',
  '625': 'Primes d’assurance',
  '622': 'Locations',
  '628': 'Télécommunications',
  '627': 'Publicité',
  '618': 'Autres frais de transport',
  '641': 'Impôts et taxes',
  '658': 'Charges diverses',
  '706': 'Prestations de services',
  '758': 'Produits divers',
};

export function buildSyscohadaEntries(
  config: AccountingFinanceConfiguration,
  months: FinanceMonth[],
  entries: AccountingEntry[],
  endMonth: string,
): SyscohadaLine[] {
  const result: SyscohadaLine[] = [];
  const add = (date: string, account: string, label: string, debit: number, credit: number) => {
    const d = Math.round(debit || 0);
    const c = Math.round(credit || 0);
    if (d || c) result.push({ date, account, label, debit: d, credit: c });
  };
  add(`${config.start}-01`, '245', 'Acquisition des 3 véhicules', config.fleetValue, 0);
  add(`${config.start}-01`, '168', 'Financement par le père', 0, config.debt);
  for (const entry of entries.filter(
    (item) =>
      item.date.slice(0, 7) >= config.start &&
      item.date.slice(0, 7) <= endMonth &&
      !(item.automatic && item.category === 'Publicité'),
  )) {
    const account = accountByCategory[entry.category] ?? '658';
    if (entry.type === 'charge') {
      add(entry.date, account, entry.label, entry.amount, 0);
      add(entry.date, '571', entry.label, 0, entry.amount);
    } else {
      add(entry.date, '571', entry.label, entry.amount, 0);
      add(entry.date, account, entry.label, 0, entry.amount);
    }
  }
  for (const month of months) {
    const date = `${month.key}-28`;
    const pair = (debit: string, credit: string, label: string, amount: number) => {
      add(date, debit, label, amount, 0);
      add(date, credit, label, 0, amount);
    };
    pair('661', '571', 'Salaires fixes', month.salaries);
    pair('627', '571', 'Publicité en ligne', month.advertising);
    pair('681', '2845', 'Dotation amortissement véhicules', month.fleetPaid);
    pair('681', '2848', 'Dotation amortissements annexes', month.annexPaid);
    pair('168', '571', 'Remboursement du père', month.debtPaid);
    pair('521', '571', 'Réserve nouveau véhicule', month.reservePaid);
    pair('245', '521', 'Achat nouveau véhicule', month.vehiclePurchase);
    pair('891', '441', 'Impôt sur les sociétés (estimation)', month.tax);
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account));
}
