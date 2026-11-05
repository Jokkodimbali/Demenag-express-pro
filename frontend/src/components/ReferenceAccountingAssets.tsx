import { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { AccountingFinanceConfiguration } from '../domain/model';
import type { FinanceMonth } from '../domain/accounting-forecast';
import { money } from '../domain/format';
import { accountingFinanceText as text } from '../content/accounting-finance';

type Props = {
  config: AccountingFinanceConfiguration;
  update: (change: Partial<AccountingFinanceConfiguration>) => void;
  current: FinanceMonth | undefined;
  debtLeft: number;
  reserve: number;
  fleetAmortized: number;
  month: string;
};

function Section({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="accounting-finance-accordion">
      <button
        className="accounting-finance-accordion-head"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronDown className={open ? 'open' : ''} size={17} aria-hidden="true" />
        <strong>{title}</strong>
        <span>{summary}</span>
      </button>
      {open && <div className="accounting-finance-accordion-body">{children}</div>}
    </section>
  );
}

function Progress({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const percentage = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="accounting-finance-progress">
      <div>
        <span>{label}</span>
        <strong>
          {money(value)} / {money(target)}
        </strong>
      </div>
      <div className="accounting-finance-track">
        <span style={{ width: `${percentage.toFixed(1)}%`, background: color }} />
      </div>
    </div>
  );
}

export function ReferenceAccountingAssets({
  config,
  update,
  current,
  debtLeft,
  reserve,
  fleetAmortized,
  month,
}: Props) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpened((value) => ({ ...value, [key]: !value[key] }));
  const capital =
    (current?.fleetBase ?? config.fleetValue) +
    config.annexes.reduce((sum, annex) => sum + annex.value, 0);
  const monthlyDebt = Math.round(config.debt / Math.max(1, config.debtMonths));
  const debtMonthsLeft = monthlyDebt > 0 ? Math.ceil(debtLeft / monthlyDebt) : 0;
  const debtEnd = debtMonthsLeft ? new Date(`${month}-15T12:00:00Z`) : undefined;
  debtEnd?.setUTCMonth(debtEnd.getUTCMonth() + debtMonthsLeft);
  const debtEndLabel = debtEnd?.toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
  const purchasedVehicles = config.vehiclePurchases.filter((purchase) => purchase.month <= month);
  const annexMonthly = config.annexes.reduce(
    (sum, annex) => sum + annex.value / (Math.max(1, annex.years) * 12),
    0,
  );
  const monthlyFleetBase =
    config.fleetValue + purchasedVehicles.reduce((sum, purchase) => sum + purchase.price, 0);
  const totalMonthlyAmortization =
    monthlyFleetBase / (Math.max(1, config.fleetYears) * 12) + annexMonthly;
  const reserveCap =
    current?.legalReserveCap ?? capital * (config.legalReserveCapitalPercent / 100);
  const updateNumber = (
    key:
      'debt' | 'debtMonths' | 'fleetValue' | 'fleetYears' | 'newVehicleTarget' | 'profitCapPercent',
    raw: string,
  ) => {
    const parsed = Number(raw);
    update({
      [key]: Math.max(
        key === 'debtMonths' || key === 'fleetYears' ? 1 : 0,
        Math.round(Number.isFinite(parsed) ? parsed : 0),
      ),
    });
  };

  return (
    <>
      <Section
        title={text.accountingDebtTitle}
        summary={debtLeft > 0.5 ? `Reste ${money(debtLeft)}` : 'Remboursée'}
        open={!!opened.debt}
        onToggle={() => toggle('debt')}
      >
        <Progress
          label="Dette remboursée"
          value={config.debt - debtLeft}
          target={config.debt}
          color="#3ddc84"
        />
        <p className="accounting-finance-note">
          {debtLeft > 0.5
            ? `Mensualité théorique ${money(monthlyDebt)} · fin prévue ${debtEndLabel ?? '—'} si chaque mois est payé.`
            : 'Dette entièrement remboursée.'}
        </p>
        <span className="accounting-finance-subheading">{text.parameters}</span>
        <div className="accounting-finance-fields">
          <label>
            <span>{text.accountingDebtTotalLabel}</span>
            <input
              type="number"
              min="0"
              value={config.debt}
              onChange={(event) => updateNumber('debt', event.target.value)}
            />
            <small>{text.debtTotalHint}</small>
          </label>
          <label>
            <span>{text.accountingDebtDurationLabel}</span>
            <input
              type="number"
              min="1"
              value={config.debtMonths}
              onChange={(event) => updateNumber('debtMonths', event.target.value)}
            />
            <small>{text.debtDurationHint}</small>
          </label>
        </div>
      </Section>

      <Section
        title={text.accountingAssetsTitle}
        summary={`Capital ${money(capital)}`}
        open={!!opened.assets}
        onToggle={() => toggle('assets')}
      >
        <p className="accounting-finance-note">{text.accountingAssetsRule}</p>
        <div className="reference-accounting-assets-table">
          <div className="reference-accounting-assets-row head">
            <span>{text.accountingAssetName}</span>
            <span>{text.accountingAssetValue}</span>
            <span>{text.accountingAssetDuration}</span>
            <span>{text.accountingAssetAmortization}</span>
            <span />
          </div>
          <div className="reference-accounting-assets-row">
            <span>{text.accountingOpeningVehicles}</span>
            <input
              aria-label={text.accountingOpeningVehiclesValue}
              type="number"
              min="0"
              value={config.fleetValue}
              onChange={(event) => updateNumber('fleetValue', event.target.value)}
            />
            <input
              aria-label={text.accountingOpeningVehiclesDuration}
              type="number"
              min="1"
              value={config.fleetYears}
              onChange={(event) => updateNumber('fleetYears', event.target.value)}
            />
            <strong>{money(config.fleetValue / (Math.max(1, config.fleetYears) * 12))}</strong>
            <span />
          </div>
          {purchasedVehicles.map((purchase) => (
            <div className="reference-accounting-assets-row" key={purchase.id}>
              <span>{text.accountingPurchasedVehicle(purchase.month)}</span>
              <input
                aria-label={`Valeur du véhicule acheté ${purchase.month}`}
                readOnly
                value={purchase.price}
              />
              <input
                aria-label={`Durée du véhicule acheté ${purchase.month}`}
                readOnly
                value={config.fleetYears}
              />
              <strong>{money(purchase.price / (Math.max(1, config.fleetYears) * 12))}</strong>
              <span />
            </div>
          ))}
          {config.annexes.map((annex) => (
            <div className="reference-accounting-assets-row" key={annex.id}>
              <input
                aria-label={text.annexLabel}
                value={annex.label}
                placeholder={text.annexLabelPlaceholder}
                onChange={(event) =>
                  update({
                    annexes: config.annexes.map((row) =>
                      row.id === annex.id ? { ...row, label: event.target.value } : row,
                    ),
                  })
                }
              />
              <input
                aria-label={text.annexValue}
                type="number"
                min="0"
                value={annex.value}
                onChange={(event) =>
                  update({
                    annexes: config.annexes.map((row) =>
                      row.id === annex.id
                        ? { ...row, value: Math.max(0, Number(event.target.value) || 0) }
                        : row,
                    ),
                  })
                }
              />
              <input
                aria-label={text.annexDuration}
                type="number"
                min="1"
                value={annex.years}
                onChange={(event) =>
                  update({
                    annexes: config.annexes.map((row) =>
                      row.id === annex.id
                        ? { ...row, years: Math.max(1, Number(event.target.value) || 1) }
                        : row,
                    ),
                  })
                }
              />
              <strong>{money(annex.value / (Math.max(1, annex.years) * 12))}</strong>
              <button
                className="accounting-finance-remove"
                type="button"
                aria-label={`Retirer ${annex.label || 'cet amortissement'}`}
                onClick={() =>
                  update({ annexes: config.annexes.filter((row) => row.id !== annex.id) })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="reference-accounting-capital">
          <span>{text.accountingCapitalTotal}</span>
          <strong>{money(capital)}</strong>
        </div>
        <button
          className="accounting-finance-add"
          type="button"
          onClick={() =>
            update({
              annexes: [
                ...config.annexes,
                { id: `annex-${Date.now()}`, label: '', value: 0, years: 3 },
              ],
            })
          }
        >
          <Plus size={16} /> {text.addDepreciation}
        </button>
      </Section>

      <Section
        title={text.accountingAmortizationTitle}
        summary={
          current
            ? current.fleetPaid + current.annexPaid > 0
              ? 'Ajouté ce mois'
              : 'À ajouter au journal'
            : 'Suivi mensuel'
        }
        open={!!opened.amortization}
        onToggle={() => toggle('amortization')}
      >
        <Progress
          label="Véhicules amortis"
          value={fleetAmortized}
          target={current?.fleetBase ?? config.fleetValue}
          color="#f6d73c"
        />
        <div className="reference-accounting-amortization-total">
          <span>{text.accountingMonthlyAmortization}</span>
          <strong>{money(totalMonthlyAmortization)}</strong>
        </div>
        <p className="accounting-finance-note">{text.accountingAmortizationNote}</p>
      </Section>

      <Section
        title={text.accountingReservesTitle}
        summary={`Légale ${money(current?.legalReserveBalance ?? 0)} / ${money(reserveCap)}`}
        open={!!opened.reserves}
        onToggle={() => toggle('reserves')}
      >
        <Progress
          label="Réserve nouveau véhicule"
          value={reserve}
          target={config.newVehicleTarget}
          color="#5ab0ff"
        />
        <Progress
          label={`Réserve légale (plafond ${config.legalReserveCapitalPercent} % du capital)`}
          value={current?.legalReserveBalance ?? 0}
          target={reserveCap}
          color="#3ddc84"
        />
        {reserve >= config.newVehicleTarget - 1 && config.newVehicleTarget > 0 && (
          <button
            className="accounting-finance-buy"
            type="button"
            onClick={() =>
              update({
                vehiclePurchases: [
                  ...config.vehiclePurchases,
                  { id: `vehicle-${Date.now()}`, month, price: config.newVehicleTarget },
                ],
              })
            }
          >
            {text.buyVehicle(money(config.newVehicleTarget))}
          </button>
        )}
        <span className="accounting-finance-subheading">{text.parameters}</span>
        <div className="accounting-finance-fields">
          <label>
            <span>{text.accountingVehicleReserve}</span>
            <input
              type="number"
              min="0"
              value={config.newVehicleTarget}
              onChange={(event) => updateNumber('newVehicleTarget', event.target.value)}
            />
          </label>
          <label>
            <span>{text.accountingProfitCeiling}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={config.profitCapPercent}
              onChange={(event) => updateNumber('profitCapPercent', event.target.value)}
            />
          </label>
          <label>
            <span>{text.accountingLegalReserve}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={config.legalReservePercent}
              onChange={(event) =>
                update({
                  legalReservePercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                })
              }
            />
          </label>
          <label>
            <span>{text.accountingCapitalCeiling}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={config.legalReserveCapitalPercent}
              onChange={(event) =>
                update({
                  legalReserveCapitalPercent: Math.min(
                    100,
                    Math.max(0, Number(event.target.value) || 0),
                  ),
                })
              }
            />
          </label>
        </div>
      </Section>
    </>
  );
}
