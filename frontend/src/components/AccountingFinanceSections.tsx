import { useEffect, useState } from 'react';
import { ChevronDown, Download, Plus, Trash2 } from 'lucide-react';
import type { AccountingFinanceConfiguration, Booking } from '../domain/model';
import { inventoryItems } from '../domain/inventory';
import { money } from '../application/presentation/format';
import {
  accountingItemKey,
  accountingMenuPrice,
  type FinanceMonth,
} from '../domain/accounting-forecast';
import { accountingFinanceText } from '../content/accounting-finance';
import { ReferenceAccountingAssets } from './ReferenceAccountingAssets';

type DocumentKey = 'journal' | 'gl' | 'bal' | 'cr' | 'bilan' | 'amort' | 'dette' | 'smt' | 'all';
type AdvertisingRow = {
  channel: string;
  spend: number;
  clientCount: number;
  turnover: number;
  costPerClient: number | null;
  ratio: number | null;
};
type UpdateConfiguration = {
  (change: Partial<AccountingFinanceConfiguration>): void;
  (change: (value: AccountingFinanceConfiguration) => AccountingFinanceConfiguration): void;
};

function PriceInput({
  value,
  label,
  onSave,
}: {
  value: number;
  label: string;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      min="0"
      step="1"
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = Number(draft);
        if (Number.isFinite(next) && next >= 0 && next !== value) onSave(Math.round(next));
        else setDraft(String(value));
      }}
    />
  );
}

function Accordion({
  title,
  summary,
  summaryColor,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  summaryColor: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="accounting-finance-accordion">
      <button
        type="button"
        className="accounting-finance-accordion-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <ChevronDown className={open ? 'open' : ''} size={17} aria-hidden="true" />
        <strong>{title}</strong>
        <span style={{ color: summaryColor }}>{summary}</span>
      </button>
      {open ? <div className="accounting-finance-accordion-body">{children}</div> : null}
    </section>
  );
}

function monthAfter(value: string) {
  const [year, month] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function AccountingFinanceSections({
  config,
  update,
  forecast,
  current,
  period,
  advertising,
  bookings,
  onDownload,
}: {
  config: AccountingFinanceConfiguration;
  update: UpdateConfiguration;
  forecast: {
    months: FinanceMonth[];
    debtLeft: number;
    reserve: number;
    fleetAmortized: number;
    paidOff: string;
  };
  current?: FinanceMonth;
  period: string;
  advertising: AdvertisingRow[];
  bookings: Booking[];
  onDownload: (document: DocumentKey) => void;
}) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpened((old) => ({ ...old, [key]: !old[key] }));
  const month = current?.key ?? period;
  const advertisingSpend = advertising.reduce((sum, row) => sum + row.spend, 0);
  const advertisingClients = advertising.reduce((sum, row) => sum + row.clientCount, 0);
  const advertisingRevenue = advertising.reduce((sum, row) => sum + row.turnover, 0);
  const financialStatus = current
    ? current.profit <= 0
      ? 'Pas de bénéfice ce mois'
      : `Bénéfice ${money(current.profit)}`
    : '';
  const paidOffText = forecast.paidOff
    ? new Date(`${forecast.paidOff}-15T12:00:00`).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      })
    : '';
  const regimeDescription =
    config.regime === 'informel'
      ? 'Aucun impôt calculé. La comptabilité est tenue selon SYSCOHADA (système minimal de trésorerie).'
      : config.regime === 'auto'
        ? forecast.paidOff
          ? `Dette remboursée en ${paidOffText} : passage en SUARL et impôt sur les sociétés estimé à ${config.isRate} % à partir du mois suivant.`
          : `Régime informel sans impôt jusqu’au remboursement complet du père, puis passage automatique en SUARL (IS estimé à ${config.isRate} %).`
        : `SUARL : impôt sur les sociétés estimé à ${config.isRate} % du résultat mensuel. Estimation à faire valider par un expert-comptable.`;
  const accountingRows = current
    ? ([
        ['Revenus', current.revenue, '#3DDC84'],
        ['Charges (journal, salaires, manœuvres, pub)', current.costs, '#FF5A5F'],
        ['Bénéfice', current.profit, current.profit > 0 ? '#3DDC84' : '#FF5A5F'],
        ['Impôt SUARL estimé', current.tax, current.tax ? '#FFD23F' : '#AEB4BB'],
        ['Trésorerie après engagements', current.cash, current.cash >= 0 ? '#3DDC84' : '#FF5A5F'],
      ] as const)
    : [];
  const sizeRanges: Record<string, [number, number]> = {
    salon: [1, 10],
    tablem: [2, 12],
    lit: [1, 4],
    matelas: [1, 4],
    armoire: [1, 8],
  };
  const observedSizes = new Map<string, number>();
  for (const booking of bookings) {
    const source = booking.inventorySnapshot?.sourceInventory;
    if (!source) continue;
    for (const [key, item] of Object.entries(source.entries))
      observedSizes.set(
        accountingItemKey(key),
        Math.max(observedSizes.get(accountingItemKey(key)) ?? 0, item.size),
      );
    for (const item of source.variants)
      observedSizes.set(
        accountingItemKey(item.itemKey),
        Math.max(observedSizes.get(accountingItemKey(item.itemKey)) ?? 0, item.size),
      );
  }
  const assemblyRows = inventoryItems
    .filter((item) => item.key !== 'climatiseur')
    .map((item) => {
      const key = accountingItemKey(item.key);
      const baseRange = sizeRanges[key] ?? [1, (item.defaultSize ?? 1) + 3];
      const range = item.sizeLabel
        ? ([baseRange[0], Math.max(baseRange[1], observedSizes.get(key) ?? 0)] as [number, number])
        : null;
      return { item, key, range };
    });
  const assemblyItems = [
    ...assemblyRows,
    {
      item: {
        key: 'custom',
        label: 'Autre objet',
        plural: 'Autres objets',
        section: 'Autres objets',
      },
      key: 'custom',
      range: null,
    },
  ];
  const fullAssemblyGroups = Array.from(
    new Map(
      assemblyItems.map((row) => [
        row.item.section,
        assemblyItems.filter((entry) => entry.item.section === row.item.section),
      ]),
    ).values(),
  );

  return (
    <div className="accounting-finance-sections">
      <Accordion
        title={accountingFinanceText.regimeTitle}
        summaryColor="#F6D73C"
        summary={
          config.regime === 'suarl'
            ? 'SUARL'
            : config.regime === 'auto'
              ? forecast.paidOff
                ? `SUARL après ${paidOffText}`
                : 'SUARL après remboursement'
              : 'Informel'
        }
        open={!!opened.regime}
        onToggle={() => toggle('regime')}
      >
        <div
          className="accounting-finance-regimes"
          role="group"
          aria-label={accountingFinanceText.regimeGroup}
        >
          {(
            [
              ['auto', 'SUARL après remboursement'],
              ['informel', 'Informel'],
              ['suarl', 'SUARL maintenant'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={config.regime === value ? 'active' : ''}
              onClick={() =>
                update({
                  regime: value,
                  ...(value === 'suarl' && !config.suarlFrom ? { suarlFrom: month } : {}),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {config.regime !== 'informel' ? (
          <div className="accounting-finance-fields">
            <label>
              <span>{accountingFinanceText.suarlFrom}</span>
              <input
                type="month"
                value={
                  config.regime === 'suarl'
                    ? config.suarlFrom
                    : forecast.paidOff
                      ? monthAfter(forecast.paidOff)
                      : ''
                }
                onChange={(event) => update({ regime: 'suarl', suarlFrom: event.target.value })}
              />
            </label>
            <label>
              <span>{accountingFinanceText.isRate}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={config.isRate}
                onChange={(event) =>
                  update({ isRate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })
                }
              />
            </label>
          </div>
        ) : null}
        <p className="accounting-finance-note">{regimeDescription}</p>
        <div className="accounting-finance-documents">
          <span>
            {accountingFinanceText.documents} {config.start} → {month}
          </span>
          <div>
            {(
              [
                ['journal', 'Journal général'],
                ['gl', 'Grand livre'],
                ['bal', 'Balance générale'],
                ['cr', 'Compte de résultat'],
                ['bilan', 'Bilan simplifié'],
                ['amort', 'Tableau des amortissements'],
                ['dette', 'Échéancier de la dette'],
                ['smt', 'Système minimal de trésorerie'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} onClick={() => onDownload(key)}>
                <Download size={16} />
                {label}
              </button>
            ))}
          </div>
          <button className="accounting-finance-download-all" onClick={() => onDownload('all')}>
            {accountingFinanceText.downloadAll}
          </button>
        </div>
      </Accordion>

      <Accordion
        title={accountingFinanceText.accountingMonthReview}
        summary={financialStatus}
        summaryColor={current ? (current.profit <= 0 ? '#FF5A5F' : '#3DDC84') : '#AEB4BB'}
        open={!!opened.monthReview}
        onToggle={() => toggle('monthReview')}
      >
        {current ? (
          <>
            <p className="accounting-finance-rule">{accountingFinanceText.accountingMonthRule}</p>
            <div className="accounting-finance-kpis">
              {accountingRows.map(([label, value, color]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong style={{ color }}>{money(value)}</strong>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="accounting-finance-note">
            {accountingFinanceText.trackingStarts(config.start)}
          </p>
        )}
        <div className="accounting-finance-history-scroll">
          <table className="accounting-finance-history">
            <thead>
              <tr>
                {['Mois', 'Bénéfice', 'Dette payée', 'Amortis', 'Rés. véhicule', 'Rés. légale'].map(
                  (label) => (
                    <th key={label}>{label}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...forecast.months]
                .slice(-18)
                .reverse()
                .map((row) => (
                  <tr key={row.key}>
                    <td>
                      {new Date(`${row.key}-15T12:00:00Z`).toLocaleDateString('fr-FR', {
                        month: 'short',
                        year: '2-digit',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td>{money(row.profit)}</td>
                    <td>{money(row.debtPaid)}</td>
                    <td>{money(row.fleetPaid + row.annexPaid)}</td>
                    <td>{money(row.reservePaid)}</td>
                    <td>{row.legalReservePaid > 1 ? money(row.legalReservePaid) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <span className="accounting-finance-subheading">
          {accountingFinanceText.accountingParameters}
        </span>
        <div className="accounting-finance-fields accounting-finance-params">
          <label>
            <span>{accountingFinanceText.accountingTrackingStartLabel}</span>
            <input
              type="month"
              min="2000-01"
              value={config.start}
              onChange={(event) => event.target.value && update({ start: event.target.value })}
            />
            <small>{accountingFinanceText.accountingTrackingStartHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingSurplusTargetLabel}</span>
            <input
              type="number"
              min="0"
              value={config.monthlyProfitTarget}
              onChange={(event) =>
                update({ monthlyProfitTarget: Math.max(0, Number(event.target.value) || 0) })
              }
            />
            <small>{accountingFinanceText.accountingSurplusTargetHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingAveragePriceLabel}</span>
            <input
              type="number"
              min="0"
              value={config.averageMovingPrice}
              onChange={(event) =>
                update({ averageMovingPrice: Math.max(0, Number(event.target.value) || 0) })
              }
            />
            <small>{accountingFinanceText.accountingAveragePriceHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingVehicleCountLabel}</span>
            <input
              type="number"
              min="0"
              value={config.vehicleCount}
              onChange={(event) =>
                update({ vehicleCount: Math.max(0, Math.round(Number(event.target.value) || 0)) })
              }
            />
            <small>{accountingFinanceText.accountingVehicleCountHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingOilCostLabel}</span>
            <input
              type="number"
              min="0"
              value={config.oilChangeCost}
              onChange={(event) =>
                update({ oilChangeCost: Math.max(0, Number(event.target.value) || 0) })
              }
            />
            <small>{accountingFinanceText.accountingOilCostHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingOilIntervalLabel}</span>
            <input
              type="number"
              min="1"
              value={config.oilChangeIntervalMonths}
              onChange={(event) =>
                update({
                  oilChangeIntervalMonths: Math.max(1, Math.round(Number(event.target.value) || 1)),
                })
              }
            />
            <small>{accountingFinanceText.accountingOilIntervalHint}</small>
          </label>
          <label>
            <span>{accountingFinanceText.accountingInsuranceLabel}</span>
            <input
              type="number"
              min="0"
              value={config.vehicleInsuranceAnnual}
              onChange={(event) =>
                update({ vehicleInsuranceAnnual: Math.max(0, Number(event.target.value) || 0) })
              }
            />
            <small>{accountingFinanceText.accountingInsuranceHint}</small>
          </label>
        </div>
      </Accordion>

      <ReferenceAccountingAssets
        config={config}
        update={update}
        current={current}
        debtLeft={forecast.debtLeft}
        reserve={forecast.reserve}
        fleetAmortized={forecast.fleetAmortized}
        month={month}
      />

      <Accordion
        title={accountingFinanceText.salaryTitle}
        summary={`${money(current ? current.salaries + current.movers + current.carpenters : config.salaries.reduce((sum, salary) => sum + salary.amount, 0))} ce mois`}
        summaryColor="#3DDC84"
        open={!!opened.salaries}
        onToggle={() => toggle('salaries')}
      >
        {config.salaries.map((salary) => (
          <div className="accounting-finance-edit-row salary" key={salary.id}>
            <input
              aria-label={accountingFinanceText.salaryName}
              value={salary.name}
              placeholder={accountingFinanceText.namePlaceholder}
              onChange={(event) =>
                update((old) => ({
                  ...old,
                  salaries: old.salaries.map((row) =>
                    row.id === salary.id ? { ...row, name: event.target.value } : row,
                  ),
                }))
              }
            />
            <input
              aria-label={accountingFinanceText.monthlySalary}
              type="number"
              min="0"
              value={salary.amount}
              onChange={(event) =>
                update((old) => ({
                  ...old,
                  salaries: old.salaries.map((row) =>
                    row.id === salary.id
                      ? { ...row, amount: Math.max(0, Number(event.target.value) || 0) }
                      : row,
                  ),
                }))
              }
            />
            <button
              className="accounting-finance-remove"
              aria-label={`Retirer ${salary.name || 'ce salaire'}`}
              onClick={() =>
                update((old) => ({
                  ...old,
                  salaries: old.salaries.filter((row) => row.id !== salary.id),
                }))
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="accounting-finance-add"
          onClick={() =>
            update((old) => ({
              ...old,
              salaries: [...old.salaries, { id: `salary-${Date.now()}`, name: '', amount: 0 }],
            }))
          }
        >
          <Plus size={16} /> {accountingFinanceText.addSalary}
        </button>
        <div className="accounting-finance-fields">
          <label>
            <span>{accountingFinanceText.moverPerMove}</span>
            <input
              type="number"
              min="0"
              value={config.moverCostPerMove}
              onChange={(event) =>
                update({ moverCostPerMove: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </label>
        </div>
        <span className="accounting-finance-subheading">{accountingFinanceText.menuPrices}</span>
        {
          <div className="accounting-assembly-scroll">
            <div className="accounting-assembly-table">
              <div className="assembly-head">
                <span>{accountingFinanceText.furniture}</span>
                <span>{accountingFinanceText.local}</span>
                <span>{accountingFinanceText.imported}</span>
              </div>
              {fullAssemblyGroups.map((group) => (
                <div key={group[0]?.item.section}>
                  <strong className="assembly-section">
                    {group[0]?.item.section.toLocaleUpperCase('fr-FR')}
                  </strong>
                  {group.map(({ item, key, range }) => (
                    <div className="assembly-row" key={key}>
                      <span>{item.label}</span>
                      {(['local', 'import'] as const).map((origin) => (
                        <div key={origin}>
                          <PriceInput
                            value={accountingMenuPrice(config, key, origin)}
                            label={`${item.label}, ${origin}`}
                            onSave={(value) =>
                              update((old) => ({
                                ...old,
                                menuPrices: {
                                  ...old.menuPrices,
                                  [key]: { ...(old.menuPrices[key] ?? {}), [origin]: value },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                      {range ? (
                        <div className="assembly-sizes">
                          <span>
                            {item.label} {accountingFinanceText.ratesBy} {item.sizeLabel}
                          </span>
                          {Array.from(
                            { length: range[1] - range[0] + 1 },
                            (_, index) => range[0] + index,
                          ).map((size) => (
                            <article key={size}>
                              <strong>
                                {size}{' '}
                                {size === 1 ? item.sizeLabel?.replace(/s$/u, '') : item.sizeLabel}
                              </strong>
                              {(['local', 'import'] as const).map((origin) => (
                                <label key={origin}>
                                  <small>
                                    {origin === 'local'
                                      ? accountingFinanceText.local
                                      : accountingFinanceText.imported}
                                  </small>
                                  <PriceInput
                                    value={accountingMenuPrice(config, key, origin, size)}
                                    label={`${item.label} ${size}, ${origin}`}
                                    onSave={(value) =>
                                      update((old) => ({
                                        ...old,
                                        menuPrices: {
                                          ...old.menuPrices,
                                          [key]: {
                                            ...(old.menuPrices[key] ?? {}),
                                            sz: {
                                              ...(old.menuPrices[key]?.sz ?? {}),
                                              [String(size)]: {
                                                ...(old.menuPrices[key]?.sz?.[String(size)] ?? {}),
                                                [origin]: value,
                                              },
                                            },
                                          },
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              ))}
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        }
        <div className="accounting-finance-summary">
          <span>
            {accountingFinanceText.fixedSalaries}{' '}
            <strong>
              {money(config.salaries.reduce((sum, salary) => sum + salary.amount, 0))}{' '}
              {accountingFinanceText.perMonth}
            </strong>
          </span>
          <span>
            {current
              ? `Ce mois, inscrit au journal : manœuvres ${money(current.movers)} · menuisier ${money(current.carpenters)}`
              : ''}
          </span>
        </div>
      </Accordion>

      <Accordion
        title={accountingFinanceText.advertisingTitle}
        summary={`${money(advertisingSpend)} investis · ${accountingFinanceText.clientCount(advertisingClients)}`}
        summaryColor="#3DDC84"
        open={!!opened.advertising}
        onToggle={() => toggle('advertising')}
      >
        <div className="accounting-advertising-scroll">
          <table className="accounting-advertising-table">
            <thead>
              <tr>
                {['Canal', 'Investi (FCFA)', 'Clients', 'CA final', 'Coût / client', 'Rapport'].map(
                  (label) => (
                    <th key={label}>{label}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {advertising.map((row) => (
                <tr key={row.channel}>
                  <th>{row.channel}</th>
                  <td>
                    <input
                      aria-label={`Budget publicitaire ${row.channel}`}
                      type="number"
                      min="0"
                      value={config.advertising[month]?.[row.channel] ?? 0}
                      onChange={(event) =>
                        update((old) => ({
                          ...old,
                          advertising: {
                            ...old.advertising,
                            [month]: {
                              ...(old.advertising[month] ?? {}),
                              [row.channel]: Math.max(0, Number(event.target.value) || 0),
                            },
                          },
                        }))
                      }
                    />
                  </td>
                  <td>{row.clientCount}</td>
                  <td>{money(row.turnover)}</td>
                  <td>{row.costPerClient == null ? '—' : money(row.costPerClient)}</td>
                  <td
                    style={{
                      color: row.ratio == null ? '#AEB4BB' : row.ratio >= 1 ? '#3DDC84' : '#FF5A5F',
                    }}
                  >
                    {row.ratio == null ? '—' : `× ${row.ratio.toFixed(1).replace('.', ',')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="accounting-finance-summary">
          {accountingFinanceText.total} {money(advertisingSpend)} {accountingFinanceText.invested}{' '}
          {accountingFinanceText.clientCount(advertisingClients)} · {money(advertisingRevenue)}{' '}
          {accountingFinanceText.finalRevenue}
          {advertisingSpend > 0
            ? accountingFinanceText.advertisingRatio(advertisingRevenue / advertisingSpend)
            : ''}
        </p>
      </Accordion>
    </div>
  );
}
