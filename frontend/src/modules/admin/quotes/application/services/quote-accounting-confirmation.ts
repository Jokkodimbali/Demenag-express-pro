import type { AccountingEntry, Booking, Quote } from '../../../../shared/domain/model';
import { accountingCostCategories } from '../../../../shared/domain/accounting-cost-categories';
import { money } from '../../../../shared/application/presentation/format';

export function quoteAccountingConfirmation(
  booking: Booking,
  quote: Quote,
  entries: AccountingEntry[],
) {
  const journalEntries = entries.filter(
    (entry) => entry.bookingId === booking.id && entry.reference === quote.id,
  );
  const revenue = journalEntries.find((entry) => entry.type === 'revenu');
  if (!revenue) return `Devis final ${quote.reference} enregistré.`;

  const charges = journalEntries.filter((entry) => entry.type === 'charge');
  const moverCost = charges
    .filter((entry) => entry.category === accountingCostCategories.movers)
    .reduce((total, entry) => total + entry.amount, 0);
  const carpenterCost = charges
    .filter((entry) => entry.category === accountingCostCategories.carpenter)
    .reduce((total, entry) => total + entry.amount, 0);
  const otherCosts = charges.filter(
    (entry) =>
      entry.category !== accountingCostCategories.movers &&
      entry.category !== accountingCostCategories.carpenter,
  );
  const otherCostsLabel = otherCosts
    .map((entry) => `${entry.category.toLocaleLowerCase('fr')} ${money(entry.amount)}`)
    .join(' · ');

  return [
    `Devis final ${quote.reference} enregistré. Journal : revenu ${money(revenue.amount)} · manœuvres ${money(moverCost)} · menuisier ${money(carpenterCost)}`,
    otherCostsLabel,
  ]
    .filter(Boolean)
    .join(' · ')
    .concat('.');
}
