import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountingMonthlyChargePlan,
  buildSyscohadaEntries,
  defaultAccountingFinanceConfiguration,
  referenceFixedChargeEntries,
  simulateAccounting,
} from '../src/modules/admin/accounting/domain/accounting-forecast.ts';
import type { AccountingEntry, Booking } from '../src/modules/shared/domain/model.ts';

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

test('le plan de charges mensuelles centralise les mêmes montants que la prévision', () => {
  const entries: AccountingEntry[] = [
    {
      id: 'plan-revenue',
      type: 'revenu',
      category: 'Déménagement',
      label: 'Facture',
      amount: 10_000,
      date: '2026-01-15',
      automatic: true,
    },
  ];
  const plan = accountingMonthlyChargePlan(configuration, '2026-01', undefined, entries);
  const forecast = simulateAccounting(configuration, entries, [], '2026-01').months[0];

  assert.equal(plan.oilChangeDue, true);
  assert.equal(plan.vehicleCount, configuration.vehicleCount);
  assert.equal(plan.monthlyDebt, forecast?.debtDue);
  assert.equal(plan.monthlyFleetAmortization, Math.round(configuration.fleetValue / 12));
  assert.equal(plan.monthlyVehicleReserve, forecast?.reserveDue);
  assert.equal(plan.legalReserveDue, forecast?.legalReserveDue);
  assert.equal(plan.legalRoomAfterMonth, true);
});

test('les engagements restent à payer tant qu’ils ne sont pas inscrits au journal', () => {
  const result = simulateAccounting(configuration, journal, [], '2026-03');

  assert.equal(result.months.length, 3);
  assert.equal(result.months[0]?.profit, 9_200);
  assert.equal(result.months[0]?.budget, 4_600);
  assert.equal(result.months[0]?.debtPaid, 0);
  assert.equal(result.months[0]?.fleetPaid, 0);
  assert.equal(result.months[0]?.reservePaid, 0);
  assert.equal(result.months[0]?.debtLeft, 1_200);
  assert.equal(result.months[0]?.legalReserveDue, 240);
  assert.equal(result.months[0]?.legalReservePaid, 0);
  assert.equal(result.months[0]?.tax, 0);
  assert.equal(result.months[1]?.debtLeft, 1_200);
  assert.equal(result.months[1]?.suarl, false);
  assert.equal(result.paidOff, '');
  assert.equal(result.months[2]?.suarl, false);
  assert.equal(result.months[2]?.tax, 0);
  assert.equal(result.months[2]?.cash, 9_200);
  assert.equal(result.reserve, 0);
});

test('les salaires configurés restent inclus dans les charges prévisionnelles jusqu’à leur inscription', () => {
  const config = { ...configuration, salaries: [{ id: 'salary', name: 'Employé', amount: 500 }] };
  const entries = [
    {
      id: 'salary-revenue',
      type: 'revenu' as const,
      category: 'Déménagement',
      label: 'Recette',
      amount: 1_000,
      date: '2026-01-15',
      automatic: false,
    },
  ];

  assert.equal(simulateAccounting(config, entries, [], '2026-01').months[0]?.salaries, 500);
  assert.equal(
    simulateAccounting(
      {
        ...config,
        monthlyFixedChargePostings: [{ month: '2026-01', key: 'sal', amount: 300 }],
      },
      [
        ...entries,
        ...referenceFixedChargeEntries({
          ...config,
          monthlyFixedChargePostings: [{ month: '2026-01', key: 'sal', amount: 300 }],
        }),
      ],
      [],
      '2026-01',
    ).months[0]?.salaries,
    300,
  );
});

test('les charges fixes ajoutées au journal sont prises en compte dans la simulation et le passage SUARL', () => {
  const config = {
    ...configuration,
    monthlyFixedChargePostings: [
      { month: '2026-01', key: 'det' as const, amount: 600 },
      { month: '2026-01', key: 'amo' as const, amount: 100 },
      { month: '2026-01', key: 'res' as const, amount: 100 },
      { month: '2026-01', key: 'leg' as const, amount: 240 },
      { month: '2026-02', key: 'det' as const, amount: 600 },
      { month: '2026-02', key: 'amo' as const, amount: 100 },
      { month: '2026-02', key: 'res' as const, amount: 100 },
      { month: '2026-03', key: 'amo' as const, amount: 100 },
      { month: '2026-03', key: 'res' as const, amount: 100 },
    ],
  };
  const entries = [...journal, ...referenceFixedChargeEntries(config)];
  const result = simulateAccounting(config, entries, [], '2026-03');

  assert.equal(result.months[0]?.debtPaid, 600);
  assert.equal(result.months[0]?.fleetPaid, 100);
  assert.equal(result.months[0]?.reservePaid, 100);
  assert.equal(result.months[0]?.legalReserveDue, 240);
  assert.equal(result.months[0]?.legalReservePaid, 240);
  assert.equal(result.months[1]?.debtLeft, 0);
  assert.equal(result.paidOff, '2026-02');
  assert.equal(result.months[2]?.suarl, true);
  assert.equal(result.months[2]?.tax, 2_730);
  assert.equal(result.months[2]?.cash, 6_370);
  assert.equal(result.reserve, 300);
});

test('la simulation accepte les remboursements anticipés et les versements supérieurs au nominal', () => {
  const config = {
    ...configuration,
    monthlyFixedChargePostings: [
      { month: '2026-01', key: 'det' as const, amount: 1_200 },
      { month: '2026-01', key: 'amo' as const, amount: 1_200 },
      { month: '2026-01', key: 'res' as const, amount: 300 },
    ],
  };
  const result = simulateAccounting(config, referenceFixedChargeEntries(config), [], '2026-01');

  assert.equal(result.months[0]?.debtPaid, 1_200);
  assert.equal(result.months[0]?.debtLeft, 0);
  assert.equal(result.months[0]?.fleetPaid, 1_200);
  assert.equal(result.months[0]?.fleetAmortized, 1_200);
  assert.equal(result.months[0]?.reservePaid, 300);
  assert.equal(result.reserve, 300);
});

test('un versement supérieur à l’échéance ne crée pas de report négatif', () => {
  const config = {
    ...configuration,
    debt: 24_000,
    debtMonths: 3,
    fleetValue: 12_000,
    fleetYears: 1,
    annexes: [{ id: 'annex', name: 'Annexe', value: 12_000, years: 1 }],
    newVehicleTarget: 12_000,
    monthlyFixedChargePostings: [
      { month: '2026-01', key: 'det' as const, amount: 12_000 },
      { month: '2026-01', key: 'amo' as const, amount: 2_000 },
      { month: '2026-01', key: 'anx' as const, amount: 2_000 },
      { month: '2026-01', key: 'res' as const, amount: 2_000 },
    ],
  };
  const result = simulateAccounting(config, referenceFixedChargeEntries(config), [], '2026-02');

  assert.equal(result.months[0]?.debtDue, 8_000);
  assert.equal(result.months[0]?.debtPaid, 12_000);
  assert.equal(result.months[0]?.debtLeft, 12_000);
  assert.equal(result.months[1]?.debtDue, 8_000);
  assert.equal(result.months[0]?.fleetDue, 1_000);
  assert.equal(result.months[0]?.fleetPaid, 2_000);
  assert.equal(result.months[1]?.fleetDue, 1_000);
  assert.equal(result.months[0]?.annexDue, 1_000);
  assert.equal(result.months[0]?.annexPaid, 2_000);
  assert.equal(result.months[1]?.annexDue, 1_000);
  assert.equal(result.months[0]?.reserveDue, 1_000);
  assert.equal(result.months[0]?.reservePaid, 2_000);
  assert.equal(result.months[1]?.reserveDue, 1_000);
  assert.equal(result.months[0]?.carry, 0);
  assert.equal(result.months[1]?.carry, 11_000);
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

test('les écritures d’ouverture restent équilibrées si dette et valeur des véhicules diffèrent', () => {
  for (const [fleetValue, debt] of [
    [25_000, 30_000],
    [30_000, 25_000],
    [25_000, 25_000],
  ]) {
    const config = { ...configuration, fleetValue, debt };
    const ledger = buildSyscohadaEntries(config, [], [], config.start);
    assert.equal(
      ledger.reduce((sum, line) => sum + line.debit, 0),
      ledger.reduce((sum, line) => sum + line.credit, 0),
    );
    assert.equal(
      ledger
        .filter((line) => line.account === '104')
        .reduce((sum, line) => sum + line.credit - line.debit, 0),
      fleetValue - debt,
    );
  }
});

test('les anciennes catégories de remboursement ne sont pas comptées deux fois dans le grand livre', () => {
  const legacyEntry: AccountingEntry = {
    id: 'legacy-debt-payment',
    type: 'charge',
    category: 'Remboursement dette',
    label: 'Remboursement saisi avant le champ de référence',
    amount: 600,
    date: '2026-01-15',
    automatic: false,
  };
  const projection = simulateAccounting(configuration, [legacyEntry], [], '2026-01');
  const ledger = buildSyscohadaEntries(configuration, projection.months, [legacyEntry], '2026-01');

  assert.equal(projection.months[0]?.debtPaid, 600);
  assert.equal(
    ledger.filter((line) => line.account === '658').reduce((sum, line) => sum + line.debit, 0),
    0,
  );
  assert.equal(
    ledger.filter((line) => line.account === '168').reduce((sum, line) => sum + line.debit, 0),
    600,
  );
});

test('le nombre de manœuvres suit uniquement les déménagements terminés du mois', () => {
  const finalQuote = {
    id: 'quote-final',
    kind: 'final',
    price: { lines: [{ label: 'Manœuvres', quantity: 3 }], total: 100_000 },
  };
  const bookings = [
    {
      id: 'confirmed',
      date: '2026-01-15',
      status: 'confirmed',
      estimate: { lines: [] },
      quotes: [finalQuote],
    },
    {
      id: 'cancelled',
      date: '2026-01-16',
      status: 'cancelled',
      estimate: { lines: [] },
      quotes: [finalQuote],
    },
    {
      id: 'completed',
      date: '2026-01-17',
      status: 'completed',
      estimate: { lines: [] },
      quotes: [finalQuote],
    },
  ] as unknown as Booking[];

  const result = simulateAccounting(configuration, [], bookings, '2026-01');

  assert.equal(result.months[0]?.moverCount, 3);
});

test('le nombre de manœuvres reste compté dans le journal après purge de la réservation', () => {
  const archivedLabour: AccountingEntry = {
    id: 'archived-movers',
    type: 'charge',
    category: 'Manœuvres',
    label: 'Manœuvres 3 · DEM-ARCHIVED',
    amount: 15_000,
    date: '2026-01-15',
    automatic: true,
    quantity: 3,
  };

  const projection = simulateAccounting(configuration, [archivedLabour], [], '2026-01');

  assert.equal(projection.months[0]?.moverCount, 3);
  assert.equal(projection.months[0]?.movers, 15_000);
});
