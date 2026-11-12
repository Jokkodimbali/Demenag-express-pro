import type { AccountingEntry } from '../../../../shared/application/ports';

export function currentAccountingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftAccountingMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function accountingMonthTitle(value: string) {
  return new Date(`${value}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function largestAccountingCategoryAmount(byCategory: readonly [string, number][]) {
  return byCategory[0]?.[1] ?? 1;
}

export function accountingEntryForSubmission<T extends { label: string; category: string }>(
  input: T,
): T {
  return { ...input, label: input.label.trim() || input.category };
}

function safeCsvCell(value: string | number) {
  const raw = String(value);
  const protectedValue = /^[\s]*[=+@-]/u.test(raw) && !/^-?\d+$/u.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function accountingCsvContent(entries: readonly AccountingEntry[]) {
  const rows: (string | number)[][] = [
    ['Date', 'Type', 'Catégorie', 'Libellé', 'Référence devis', 'Montant FCFA'],
    ...entries.map((entry) => [
      entry.date,
      entry.type === 'charge' ? 'Charge' : 'Revenu',
      entry.category,
      entry.label,
      entry.reference ?? '',
      entry.type === 'charge' ? -entry.amount : entry.amount,
    ]),
  ];
  return rows.map((row) => row.map(safeCsvCell).join(';')).join('\r\n');
}
