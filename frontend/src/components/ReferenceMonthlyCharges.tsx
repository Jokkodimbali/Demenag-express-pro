import { useMemo } from 'react';
import type { AccountingFinanceConfiguration, AccountingEntry } from '../domain/model';
import {
  accountingMonthlyChargePlan,
  referenceFixedChargeKey,
  type FinanceMonth,
} from '../domain/accounting-forecast';
import { money } from '../application/presentation/format';
import { accountingFinanceText as text } from '../content/accounting-finance';

type FixedKey = 'sal' | 'vid' | 'ass' | 'amo' | 'anx' | 'res' | 'det' | 'leg';
type FixedCharge = { key: FixedKey; label: string; amount: number; off?: boolean; next?: string };
type Props = {
  config: AccountingFinanceConfiguration;
  update: (change: Partial<AccountingFinanceConfiguration>) => void;
  entries: AccountingEntry[];
  current: FinanceMonth | undefined;
  month: string;
};

const monthAfter = (month: string, offset = 1) => {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });

export function ReferenceMonthlyCharges({ config, update, entries, current, month }: Props) {
  const charges = useMemo<FixedCharge[]>(() => {
    const plan = accountingMonthlyChargePlan(config, month, current, entries);
    const {
      elapsedMonths,
      oilChangeIntervalMonths: interval,
      oilChangeDue: oilDue,
      vehicleCount,
      monthlyAnnexAmortization,
      monthlyDebt,
      monthlyVehicleReserve,
      monthlyInsurance,
      debtStillDue,
      legalReserveDue: legalDue,
      legalRoomBeforeMonth,
    } = plan;
    const oilNext = oilDue
      ? month
      : monthAfter(
          month,
          elapsedMonths < 0 ? -elapsedMonths : interval - (elapsedMonths % interval),
        );
    return [
      {
        key: 'sal',
        label: text.monthlyChargeSalary,
        amount: config.salaries.reduce((sum, salary) => sum + salary.amount, 0),
      },
      {
        key: 'vid',
        label: text.monthlyChargeOil(vehicleCount, money(config.oilChangeCost)),
        amount: vehicleCount * config.oilChangeCost,
        off: !oilDue,
        next: monthLabel(oilNext),
      },
      {
        key: 'ass',
        label: text.monthlyChargeInsurance(vehicleCount),
        amount: monthlyInsurance,
      },
      {
        key: 'amo',
        label: text.monthlyChargeDepreciation(config.fleetYears),
        amount: plan.monthlyFleetAmortization,
      },
      ...(monthlyAnnexAmortization > 0
        ? [
            {
              key: 'anx' as const,
              label: text.monthlyChargeAnnex,
              amount: monthlyAnnexAmortization,
            },
          ]
        : []),
      {
        key: 'res',
        label: text.monthlyChargeReserve,
        amount: monthlyVehicleReserve,
      },
      ...(debtStillDue && monthlyDebt > 0
        ? [
            {
              key: 'det' as const,
              label: text.monthlyChargeDebt,
              amount: monthlyDebt,
            },
          ]
        : []),
      ...(legalRoomBeforeMonth
        ? [
            {
              key: 'leg' as const,
              label: text.monthlyChargeLegalReserve(config.legalReservePercent),
              amount: legalDue,
            },
          ]
        : []),
    ];
  }, [config, current, entries, month]);
  const postings = config.monthlyFixedChargePostings;
  const selected = new Set(
    postings.filter((posting) => posting.month === month).map((posting) => posting.key),
  );
  const manuallyEntered = new Set(
    entries
      .filter((entry) => entry.date.slice(0, 7) === month && !entry.referenceFixedKey)
      .map(referenceFixedChargeKey)
      .filter((key): key is FixedKey => key !== undefined),
  );
  const remaining = charges.filter(
    (charge) =>
      !charge.off &&
      charge.amount > 0 &&
      !selected.has(charge.key) &&
      !manuallyEntered.has(charge.key),
  );
  const add = (chargesToAdd: FixedCharge[]) => {
    update({
      monthlyFixedChargePostings: [
        ...postings,
        ...chargesToAdd.map(({ key, amount }) => ({ month, key, amount: Math.round(amount) })),
      ],
    });
  };
  const remove = (key: FixedKey) =>
    update({
      monthlyFixedChargePostings: postings.filter(
        (posting) => posting.month !== month || posting.key !== key,
      ),
    });
  const allLabel = remaining.length
    ? text.addAllMonthlyCharges(money(remaining.reduce((sum, row) => sum + row.amount, 0)))
    : text.monthlyChargesAdded;

  return (
    <section className="accounting-panel reference-monthly-charges">
      <div className="reference-monthly-charges-heading">
        <strong>{text.monthlyChargesTitle(monthLabel(month))}</strong>
        <button
          type="button"
          className="button primary"
          disabled={!remaining.length}
          onClick={() => add(remaining)}
        >
          {allLabel}
        </button>
      </div>
      <div className="reference-monthly-charges-grid">
        {charges.map((charge) => {
          const isSelected = selected.has(charge.key);
          const isManual = manuallyEntered.has(charge.key);
          const disabled = charge.off || charge.amount <= 0;
          const status = isSelected
            ? text.monthlyChargeAdded
            : isManual
              ? text.monthlyChargeManual
              : charge.off
                ? text.monthlyChargeNext(charge.next ?? '')
                : charge.amount <= 0
                  ? text.monthlyChargeNegativeBalance
                  : text.monthlyChargeAdd;
          return (
            <button
              type="button"
              key={charge.key}
              className={`reference-monthly-charge${isSelected || isManual ? ' is-selected' : ''}`}
              disabled={disabled || isManual}
              onClick={() => (isSelected ? remove(charge.key) : add([charge]))}
              aria-pressed={isSelected || isManual}
            >
              <span>{charge.label}</span>
              <span>
                <strong>{money(charge.amount)}</strong>
                <b>{status}</b>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
