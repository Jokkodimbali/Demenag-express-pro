import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  Booking,
} from '../../../../shared/domain/model';
import { accountingCostCategories } from '../../../../shared/domain/accounting-cost-categories';
import { completedBookingRevenueAmount } from './revenue';
import {
  advertisingChannels,
  defaultAccountingFinanceConfiguration,
  referenceFixedChargeEntries,
  simulateAccounting,
} from '../../domain/accounting-forecast';

export { advertisingChannels };

export const accountingCategories = {
  charge: [
    'Salaires',
    accountingCostCategories.movers,
    accountingCostCategories.carpenter,
    'Carburant',
    'Entretien véhicule',
    'Assurance',
    'Loyer',
    'Téléphone / Internet',
    'Publicité',
    'Péage / Parking',
    'Impôts et taxes',
    'Autre charge',
  ],
  revenu: ['Déménagement', 'Location véhicule', 'Autre revenu'],
} as const;

export function normalizeAccountingConfiguration(
  config: AccountingFinanceConfiguration | null,
): AccountingFinanceConfiguration {
  const defaults = defaultAccountingFinanceConfiguration();
  if (!config) return defaults;
  return {
    ...defaults,
    ...config,
    menuPrices: { ...defaults.menuPrices, ...(config.menuPrices ?? {}) },
    advertising: config.advertising ?? {},
    salaries: config.salaries ?? defaults.salaries,
    annexes: config.annexes ?? defaults.annexes,
    vehiclePurchases: config.vehiclePurchases ?? defaults.vehiclePurchases,
    monthlyFixedChargePostings: config.monthlyFixedChargePostings ?? [],
    financeChat: config.financeChat ?? [],
  };
}

export function generatedAccountingEntries(
  configuration: AccountingFinanceConfiguration,
): AccountingEntry[] {
  const advertising: AccountingEntry[] = Object.entries(configuration.advertising).flatMap(
    ([period, channels]) =>
      Object.entries(channels).flatMap(([channel, amount]) => {
        const value = Math.max(0, Math.round(amount || 0));
        if (!value) return [];
        const [year, monthNumber] = period.split('-').map(Number);
        const last = new Date(Math.min(new Date(year, monthNumber, 0).getTime(), Date.now()));
        return [
          {
            id: `auto-ad-${period}-${channel}`,
            type: 'charge',
            category: 'Publicité',
            label: `Publicité ${channel} · ${last.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
            amount: value,
            date: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`,
            automatic: true,
          },
        ];
      }),
  );
  return [...advertising, ...referenceFixedChargeEntries(configuration)];
}

export function countFinalBookingsWithoutCostSnapshot(bookings: readonly Booking[]): number {
  return bookings.filter((booking) => {
    const finalQuote = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
    return Boolean(finalQuote && !finalQuote.accountingCosts);
  }).length;
}

export function selectAccountingEntries(
  entries: readonly AccountingEntry[],
  input: { all: boolean; month: string; startMonth: string; currentMonth: string },
): AccountingEntry[] {
  return entries.filter((entry) => {
    const entryMonth = entry.date.slice(0, 7);
    return input.all
      ? entryMonth >= input.startMonth && entryMonth <= input.currentMonth
      : entryMonth === input.month;
  });
}

export function summarizeAccountingEntries(entries: readonly AccountingEntry[]) {
  const revenue = entries
    .filter((entry) => entry.type === 'revenu')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const charges = entries
    .filter((entry) => entry.type === 'charge')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const categoryTotals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type === 'charge') {
      categoryTotals.set(entry.category, (categoryTotals.get(entry.category) ?? 0) + entry.amount);
    }
  }
  return {
    revenue,
    charges,
    balance: revenue - charges,
    byCategory: [...categoryTotals].sort((left, right) => right[1] - left[1]),
  };
}

export function summarizeAdvertising(
  configuration: AccountingFinanceConfiguration,
  bookings: readonly Booking[],
  channels: readonly string[],
  input: { all: boolean; month: string; currentMonth: string },
) {
  const month = input.all ? input.currentMonth : input.month;
  return channels.map((channel) => {
    const spend = input.all
      ? Object.values(configuration.advertising).reduce(
          (sum, values) => sum + (values[channel] ?? 0),
          0,
        )
      : (configuration.advertising[month]?.[channel] ?? 0);
    const matchingBookings = bookings.filter((booking) => {
      const createdMonth = (booking.createdAt || booking.date || '').slice(0, 7);
      return (
        booking.source === channel &&
        (input.all || createdMonth === month) &&
        booking.status !== 'cancelled'
      );
    });
    const turnover = matchingBookings.reduce(
      (sum, booking) => sum + completedBookingRevenueAmount(booking),
      0,
    );
    return {
      channel,
      spend,
      clientCount: matchingBookings.length,
      turnover,
      costPerClient:
        spend && matchingBookings.length ? Math.round(spend / matchingBookings.length) : null,
      ratio: spend ? turnover / spend : null,
    };
  });
}

export function createAccountingForecast(
  configuration: AccountingFinanceConfiguration,
  entries: readonly AccountingEntry[],
  bookings: readonly Booking[],
  month: string,
) {
  return simulateAccounting(configuration, [...entries], [...bookings], month);
}
