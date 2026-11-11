import type {
  AccountingEntry,
  AccountingFixedChargeKey,
  AccountingFinanceConfiguration,
  Booking,
} from '../../../shared/domain/model';
import {
  createReferenceAccountingConfiguration,
  referenceAssemblyPayrollDefaults,
} from '../../../../../../shared/reference-tariff-defaults.js';

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
  const key = accountingItemKey(itemKey);
  const price = config.menuPrices?.[key] ?? referenceAssemblyPayrollDefaults[key];
  const sized = size == null ? undefined : price?.sz?.[String(size)]?.[origin];
  if (sized != null) return asInt(sized);
  const base = price?.[origin] ?? (origin === 'import' ? 10_000 : 5_000);
  return asInt(base);
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
  return createReferenceAccountingConfiguration(now);
}

const referenceFixedChargeDetails: Record<AccountingFixedChargeKey, readonly [string, string]> = {
  sal: ['Salaires', 'Salaires fixes'],
  vid: ['Entretien véhicule', 'Vidange véhicules'],
  ass: ['Assurance', 'Assurance véhicules'],
  amo: ['Amortissement', 'Amortissement véhicules'],
  anx: ['Amortissement', 'Amortissements annexes'],
  res: ['Réserve nouveau véhicule', 'Réserve nouveau véhicule'],
  det: ['Remboursement dette', 'Remboursement du père'],
  leg: ['Réserve légale', 'Réserve légale'],
} as const;

export function referenceFixedChargeKey(
  entry: AccountingEntry,
): AccountingFixedChargeKey | undefined {
  if (entry.referenceFixedKey) return entry.referenceFixedKey;
  const categoryKeys: Record<string, AccountingFixedChargeKey> = {
    'Remboursement dette': 'det',
    'Réserve nouveau véhicule': 'res',
    Amortissement: 'amo',
    'Réserve légale': 'leg',
  };
  return categoryKeys[entry.category];
}

export function referenceFixedChargeEntries(
  config: AccountingFinanceConfiguration,
): AccountingEntry[] {
  return config.monthlyFixedChargePostings.flatMap(({ month, key, amount }) => {
    const [category, label] = referenceFixedChargeDetails[key];
    if (amount <= 0) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDate = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const entryDay =
      month === currentMonth
        ? String(today.getDate()).padStart(2, '0')
        : month < currentMonth
          ? String(lastDate).padStart(2, '0')
          : '01';
    return [
      {
        id: `auto-fixed-${month}-${key}`,
        type: 'charge' as const,
        category,
        label: `${label} · ${month}`,
        amount: asInt(amount),
        date: `${month}-${entryDay}`,
        automatic: true,
        referenceFixedKey: key,
      },
    ];
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
  legalReserveDue: number;
  legalReservePaid: number;
  legalReserveBalance: number;
  legalReserveCap: number;
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

export type AccountingMonthlyChargePlan = {
  elapsedMonths: number;
  oilChangeIntervalMonths: number;
  oilChangeDue: boolean;
  vehicleCount: number;
  fleetBase: number;
  monthlyFleetAmortization: number;
  monthlyAnnexAmortization: number;
  monthlyDebt: number;
  monthlyVehicleReserve: number;
  monthlyInsurance: number;
  debtStillDue: boolean;
  legalReserveDue: number;
  legalRoomBeforeMonth: boolean;
  legalRoomAfterMonth: boolean;
};

/** Single source for the recurring charge amounts shown by accounting views. */
export function accountingMonthlyChargePlan(
  config: AccountingFinanceConfiguration,
  month: string,
  current: FinanceMonth | undefined,
  entries: AccountingEntry[],
): AccountingMonthlyChargePlan {
  const elapsedMonths =
    (Number(month.slice(0, 4)) - Number(config.start.slice(0, 4))) * 12 +
    Number(month.slice(5, 7)) -
    Number(config.start.slice(5, 7));
  const interval = Math.max(1, config.oilChangeIntervalMonths);
  const vehiclePurchases = config.vehiclePurchases.filter((purchase) => purchase.month <= month);
  const vehicleCount = config.vehicleCount + vehiclePurchases.length;
  const fleetBase =
    config.fleetValue + vehiclePurchases.reduce((sum, purchase) => sum + purchase.price, 0);
  const annexCapital = config.annexes.reduce((sum, annex) => sum + annex.value, 0);
  const legalReserveCap = (fleetBase + annexCapital) * (config.legalReserveCapitalPercent / 100);
  const legalAlreadyPosted = current
    ? current.legalReserveBalance - current.legalReservePaid
    : entries
        .filter(
          (entry) =>
            referenceFixedChargeKey(entry) === 'leg' &&
            entry.date.slice(0, 7) >= config.start &&
            entry.date.slice(0, 7) <= month,
        )
        .reduce((sum, entry) => sum + entry.amount, 0);
  const ledgerBalance = entries
    .filter((entry) => entry.date.slice(0, 7) === month && referenceFixedChargeKey(entry) !== 'leg')
    .reduce((sum, entry) => sum + (entry.type === 'revenu' ? entry.amount : -entry.amount), 0);
  const legalReserveDue = Math.round(
    current?.legalReserveDue ??
      Math.max(
        0,
        Math.min(
          Math.max(0, ledgerBalance) * (config.legalReservePercent / 100),
          legalReserveCap - legalAlreadyPosted,
        ),
      ),
  );
  return {
    elapsedMonths,
    oilChangeIntervalMonths: interval,
    oilChangeDue: elapsedMonths >= 0 && elapsedMonths % interval === 0,
    vehicleCount,
    fleetBase,
    monthlyFleetAmortization: Math.round(fleetBase / (Math.max(1, config.fleetYears) * 12)),
    monthlyAnnexAmortization: Math.round(
      config.annexes.reduce((sum, annex) => sum + annex.value / (Math.max(1, annex.years) * 12), 0),
    ),
    monthlyDebt: Math.round(config.debt / Math.max(1, config.debtMonths)),
    monthlyVehicleReserve: Math.round(config.newVehicleTarget / 12),
    monthlyInsurance: Math.round((vehicleCount * config.vehicleInsuranceAnnual) / 12),
    debtStillDue: current ? current.debtLeft > 0.5 || current.debtPaid > 0 : config.debt > 0.5,
    legalReserveDue,
    legalRoomBeforeMonth: current
      ? current.legalReserveBalance - current.legalReservePaid < current.legalReserveCap - 1
      : legalReserveCap - legalAlreadyPosted > 0.5,
    legalRoomAfterMonth: current
      ? current.legalReserveBalance < current.legalReserveCap - 1
      : legalAlreadyPosted < legalReserveCap - 1,
  };
}

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
  let legalReserveBalance = 0;
  let paidOff = config.debt <= 0 ? config.start : '';
  const annexState = config.annexes.map((annex) => ({ ...annex, amortized: 0, carry: 0 }));
  const debtMonthly = Math.round(config.debt / Math.max(1, config.debtMonths));
  const reserveMonthly = Math.round(config.newVehicleTarget / 12);

  const months = monthKeys.map((month) => {
    const monthEntries = entries.filter((entry) => entry.date.slice(0, 7) === month);
    const fixedCharge = (fixedKey: AccountingFixedChargeKey) =>
      monthEntries
        .filter((entry) => referenceFixedChargeKey(entry) === fixedKey)
        .reduce((sum, entry) => sum + entry.amount, 0);
    const revenue = monthEntries
      .filter((entry) => entry.type === 'revenu')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const journalCharges = monthEntries
      .filter(
        (entry) =>
          entry.type === 'charge' &&
          !(
            (entry.automatic && entry.category === 'Publicité') ||
            ['sal', 'amo', 'anx', 'res', 'det', 'leg'].includes(
              referenceFixedChargeKey(entry) ?? '',
            )
          ),
      )
      .reduce((sum, entry) => sum + entry.amount, 0);
    const finalBookings = bookings.filter(
      (booking) => booking.status === 'completed' && booking.date?.slice(0, 7) === month,
    );
    const labourEntries = monthEntries.filter(
      (entry) => entry.type === 'charge' && entry.category === 'Manœuvres' && entry.automatic,
    );
    const journalMoverCount = labourEntries.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
    const representedBookings = new Set(
      labourEntries.flatMap((entry) => (entry.bookingId ? [entry.bookingId] : [])),
    );
    const unrepresentedMoverCount = finalBookings
      .filter((booking) => !representedBookings.has(booking.id))
      .reduce((sum, booking) => {
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
    const moverCount = journalMoverCount + unrepresentedMoverCount;
    const movers = monthEntries
      .filter((entry) => entry.type === 'charge' && entry.category === 'Manœuvres')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const carpenters = monthEntries
      .filter((entry) => entry.type === 'charge' && entry.category === 'Menuisier')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const salaries = monthEntries.some((entry) => referenceFixedChargeKey(entry) === 'sal')
      ? fixedCharge('sal')
      : config.salaries.reduce((sum, salary) => sum + asInt(salary.amount), 0);
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
    const debtDue = Math.min(debtLeft, debtMonthly + debtCarry);
    // The reference accepts early repayments up to the remaining debt, even
    // when the payment is larger than this month's nominal installment.
    const debtPaid = Math.min(debtLeft, asInt(fixedCharge('det') ?? 0));
    debtLeft -= debtPaid;
    // La référence reporte uniquement le solde impayé, jamais un crédit
    // créé par un remboursement anticipé.
    debtCarry = Math.max(0, debtDue - debtPaid);
    const fleetDue = Math.max(
      0,
      Math.min(
        fleetBase - fleetAmortized,
        fleetBase / (Math.max(1, config.fleetYears) * 12) + fleetCarry,
      ),
    );
    // Like the reference, an entered amortization posting can catch up past
    // due months, but cannot exceed the asset's remaining value.
    const fleetPaid = Math.min(
      Math.max(0, fleetBase - fleetAmortized),
      asInt(fixedCharge('amo') ?? 0),
    );
    fleetAmortized += fleetPaid;
    fleetCarry = Math.max(0, fleetDue - fleetPaid);
    let annexDue = 0;
    let annexPaid = 0;
    let annexPosted = asInt(fixedCharge('anx') ?? 0);
    for (const annex of annexState) {
      const due = Math.max(
        0,
        Math.min(
          annex.value - annex.amortized,
          annex.value / (Math.max(1, annex.years) * 12) + annex.carry,
        ),
      );
      const paid = Math.min(Math.max(0, annex.value - annex.amortized), annexPosted);
      annexPosted -= paid;
      annex.amortized += paid;
      annex.carry = Math.max(0, due - paid);
      annexDue += due;
      annexPaid += paid;
    }
    const reserveDue = reserveMonthly + reserveCarry;
    // Reference reserve postings are applied as entered; the scheduled amount
    // remains a minimum target and the saved balance can grow faster.
    const reservePaid = asInt(fixedCharge('res') ?? 0);
    reserve += reservePaid;
    reserveCarry = Math.max(0, reserveDue - reservePaid);
    const journalBalance = monthEntries
      .filter((entry) => referenceFixedChargeKey(entry) !== 'leg')
      .reduce((sum, entry) => sum + (entry.type === 'revenu' ? entry.amount : -entry.amount), 0);
    const legalReserveCap =
      (fleetBase + config.annexes.reduce((sum, annex) => sum + asInt(annex.value), 0)) *
      (config.legalReserveCapitalPercent / 100);
    const legalReserveDue =
      journalBalance > 0
        ? Math.max(
            0,
            Math.min(
              (journalBalance * config.legalReservePercent) / 100,
              legalReserveCap - legalReserveBalance,
            ),
          )
        : 0;
    const legalReservePaid = Math.max(
      0,
      Math.min(asInt(fixedCharge('leg') ?? 0), legalReserveCap - legalReserveBalance),
    );
    legalReserveBalance += legalReservePaid;
    const suarl =
      config.regime === 'suarl'
        ? !config.suarlFrom || month >= config.suarlFrom
        : config.regime === 'auto'
          ? Boolean(paidOff && month > paidOff)
          : false;
    if (!paidOff && debtLeft <= 0.5) paidOff = month;
    const taxableResult = profit - fleetPaid - annexPaid;
    const tax = suarl ? (Math.max(0, taxableResult) * config.isRate) / 100 : 0;
    const cash = profit - debtPaid - reservePaid - legalReservePaid - tax;
    const carry =
      Math.max(0, debtDue - debtPaid) +
      Math.max(0, fleetDue - fleetPaid) +
      Math.max(0, annexDue - annexPaid) +
      Math.max(0, reserveDue - reservePaid);
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
      legalReserveDue,
      legalReservePaid,
      legalReserveBalance,
      legalReserveCap,
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
  '104': 'Compte de l’exploitant',
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
  add(
    `${config.start}-01`,
    '245',
    `Acquisition des ${config.vehicleCount} véhicules`,
    config.fleetValue,
    0,
  );
  add(`${config.start}-01`, '168', 'Financement par le père', 0, config.debt);
  const openingEquity = config.fleetValue - config.debt;
  if (openingEquity > 0)
    add(`${config.start}-01`, '104', 'Écart d’ouverture à justifier', 0, openingEquity);
  else if (openingEquity < 0)
    add(`${config.start}-01`, '104', 'Écart d’ouverture à justifier', -openingEquity, 0);
  for (const entry of entries.filter(
    (item) =>
      item.date.slice(0, 7) >= config.start &&
      item.date.slice(0, 7) <= endMonth &&
      !['sal', 'amo', 'anx', 'res', 'det', 'leg'].includes(referenceFixedChargeKey(item) ?? '') &&
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
    pair('521', '571', 'Réserve légale', month.legalReservePaid);
    pair('245', '521', 'Achat nouveau véhicule', month.vehiclePurchase);
    pair('891', '441', 'Impôt sur les sociétés (estimation)', month.tax);
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.account.localeCompare(b.account));
}
