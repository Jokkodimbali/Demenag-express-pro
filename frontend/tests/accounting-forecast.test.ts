import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSyscohadaEntries,
  defaultAccountingFinanceConfiguration,
  jobLabourEntries,
  simulateAccounting,
} from '../src/domain/accounting-forecast.ts';
import type { AccountingEntry, Booking } from '../src/domain/model.ts';

const configuration = {
  ...defaultAccountingFinanceConfiguration(new Date('2026-01-15T12:00:00Z')),
  regime: 'auto' as const,
  start: '2026-01',
  debt: 1_200,
  debtMonths: 2,
  fleetValue: 1_200,
  fleetYears: 1,
  newVehicleTarget: 1_200,
  profitCapPercent: 50,
  isRate: 30,
  salaries: [],
};

const journal: AccountingEntry[] = ['2026-01-15', '2026-02-15', '2026-03-15'].flatMap(
  (date, index) => [
    {
      id: `revenue-${index}`,
      type: 'revenu' as const,
      category: 'Déménagement',
      label: 'Devis final',
      amount: 10_000,
      date,
      automatic: true,
    },
    {
      id: `charge-${index}`,
      type: 'charge' as const,
      category: 'Menuisier',
      label: 'Menuisier',
      amount: 800,
      date,
      automatic: true,
    },
  ],
);

test('la projection suit le plafond, la dette, les amortissements, la réserve et le passage SUARL', () => {
  const result = simulateAccounting(configuration, journal, [], '2026-03');

  assert.equal(result.months.length, 3);
  assert.equal(result.months[0]?.profit, 9_200);
  assert.equal(result.months[0]?.budget, 4_600);
  assert.equal(result.months[0]?.debtPaid, 600);
  assert.equal(result.months[0]?.fleetPaid, 100);
  assert.equal(result.months[0]?.reservePaid, 100);
  assert.equal(result.months[0]?.tax, 0);
  assert.equal(result.months[1]?.debtLeft, 0);
  assert.equal(result.months[1]?.suarl, false);
  assert.equal(result.paidOff, '2026-02');
  assert.equal(result.months[2]?.suarl, true);
  assert.equal(result.months[2]?.tax, 2_730);
  assert.equal(result.months[2]?.cash, 6_370);
  assert.equal(result.reserve, 300);
});

test('les lignes des rapports SYSCOHADA sont équilibrées et reprennent les revenus/charges du journal', () => {
  const projection = simulateAccounting(configuration, journal, [], '2026-03');
  const ledger = buildSyscohadaEntries(configuration, projection.months, journal, '2026-03');
  const debit = ledger.reduce((sum, line) => sum + line.debit, 0);
  const credit = ledger.reduce((sum, line) => sum + line.credit, 0);

  assert.equal(debit, credit);
  assert.equal(
    ledger.filter((line) => line.account === '706').reduce((sum, line) => sum + line.credit, 0),
    30_000,
  );
  assert.equal(
    ledger.filter((line) => line.account === '637').reduce((sum, line) => sum + line.debit, 0),
    2_400,
  );
});

test('les devis finals anciens sans snapshot sont explicitement marqués comme estimés', () => {
  const booking = {
    id: 'booking-old',
    reference: 'DEM-OLD',
    date: '2026-01-15',
    estimate: { lines: [] },
    quotes: [
      {
        id: 'quote-old',
        reference: 'DV-OLD',
        kind: 'final',
        createdAt: '2026-01-15T12:00:00.000Z',
        price: {
          total: 100_000,
          lines: [{ label: 'Manœuvre', quantity: 2 }],
        },
      },
    ],
  } as unknown as Booking;

  const entries = jobLabourEntries([booking], configuration);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.amount, 10_000);
  assert.match(entries[0]?.label ?? '', /tarif actuel estimatif/u);
});

test('les coûts enregistrés avec un devis final restent figés après changement des tarifs', () => {
  const booking = {
    id: 'booking-snapshot',
    reference: 'DEM-SNAPSHOT',
    date: '2026-01-15',
    estimate: { lines: [] },
    quotes: [
      {
        id: 'quote-snapshot',
        reference: 'DV-SNAPSHOT',
        kind: 'final',
        createdAt: '2026-01-15T12:00:00.000Z',
        price: {
          total: 100_000,
          lines: [{ label: 'Manœuvre', quantity: 2 }],
        },
        accountingCosts: {
          movers: 2,
          moverAmount: 7_000,
          carpenters: 1,
          carpenterAmount: 12_000,
        },
      },
    ],
  } as unknown as Booking;

  const entries = jobLabourEntries([booking], configuration);

  assert.deepEqual(
    entries.map((entry) => entry.amount),
    [7_000, 12_000],
  );
  assert.ok(entries.every((entry) => !entry.label.includes('tarif actuel estimatif')));
});

test('le nombre de manœuvres suit les devis finals non annulés du mois de la réservation', () => {
  const finalQuote = {
    id: 'quote-final',
    kind: 'final',
    price: { lines: [{ label: 'Manœuvres', quantity: 3 }], total: 100_000 },
  };
  const bookings = [
    { id: 'confirmed', date: '2026-01-15', status: 'confirmed', quotes: [finalQuote] },
    { id: 'cancelled', date: '2026-01-16', status: 'cancelled', quotes: [finalQuote] },
    { id: 'provisional', date: '2026-01-17', status: 'completed', quotes: [] },
  ] as unknown as Booking[];

  const result = simulateAccounting(configuration, [], bookings, '2026-01');

  assert.equal(result.months[0]?.moverCount, 3);
});
