import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  Booking,
  Catalogue,
} from '../../../shared/domain/model';
import {
  accountingMonthlyChargePlan,
  referenceFixedChargeKey,
  type FinanceMonth,
} from '../domain/accounting-forecast';
import {
  bookingRevenueAmount,
  completedBookingRevenueAmount,
} from '../application/services/revenue';
import { money } from '../../../shared/application/presentation/format';
import { accountingFinanceText as text } from '../content/accounting-finance';
import type { ClaudeCompletionInput } from '../../../shared/application/ports';

type Props = {
  config: AccountingFinanceConfiguration;
  update: (change: Partial<AccountingFinanceConfiguration>) => void;
  bookings: Booking[];
  entries: AccountingEntry[];
  current: FinanceMonth | undefined;
  endMonth: string;
  catalogue: Catalogue | null;
  forecastHistory: FinanceMonth[];
  allPeriods: boolean;
  summary: {
    revenue: number;
    charges: number;
    balance: number;
    revenueCount: number;
    chargeCount: number;
  };
  completeClaude: (input: ClaudeCompletionInput) => Promise<string>;
};

type FinanceChatMessage = AccountingFinanceConfiguration['financeChat'][number];

function nextMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

const financeQuestions = [
  text.financeChatQuestion1,
  text.financeChatQuestion2,
  text.financeChatQuestion3,
  text.financeChatQuestion4,
  text.financeChatQuestion5,
  text.financeChatQuestion6,
];

export function ReferenceAccountingOverview({
  config,
  update,
  bookings,
  entries,
  current,
  endMonth,
  catalogue,
  forecastHistory,
  allPeriods,
  summary,
  completeClaude,
}: Props) {
  const [showCalculation, setShowCalculation] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const values = useMemo(() => {
    const revenueAmount = (booking: Booking) => {
      if (booking.status !== 'completed') return bookingRevenueAmount(booking, catalogue);
      return completedBookingRevenueAmount(booking);
    };
    const priced = bookings
      .filter((booking) => booking.status !== 'cancelled')
      .map((booking) => ({ booking, amount: revenueAmount(booking) }))
      .filter(({ amount }) => amount > 0);
    const finals = priced.filter(({ booking }) => booking.status === 'completed');
    const average =
      config.averageMovingPrice > 0
        ? config.averageMovingPrice
        : (finals.length >= 3 ? finals : priced).reduce((sum, row) => sum + row.amount, 0) /
          Math.max(1, finals.length >= 3 ? finals.length : priced.length);
    const averageSampleCount = (finals.length >= 3 ? finals : priced).length;
    const variableEntries = entries.filter(
      (entry) =>
        entry.type === 'charge' && ['Manœuvres', 'Menuisier', 'Carburant'].includes(entry.category),
    );
    const variableCost = finals.length
      ? variableEntries.reduce((sum, entry) => sum + entry.amount, 0) / finals.length
      : config.moverCostPerMove * 3;
    const margin = average - variableCost;
    const monthlyPlan = accountingMonthlyChargePlan(config, endMonth, current, entries);
    const {
      oilChangeDue,
      vehicleCount: fleetCount,
      monthlyFleetAmortization,
      monthlyAnnexAmortization,
      monthlyDebt,
      monthlyVehicleReserve,
      monthlyInsurance,
      debtStillDue,
    } = monthlyPlan;
    const operationCosts =
      config.salaries.reduce((sum, salary) => sum + salary.amount, 0) +
      (oilChangeDue ? Math.round(fleetCount * config.oilChangeCost) : 0) +
      monthlyInsurance +
      Object.values(config.advertising[endMonth] ?? {}).reduce((sum, amount) => sum + amount, 0);
    const advertisingCost = Object.values(config.advertising[endMonth] ?? {}).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const obligations =
      (debtStillDue ? monthlyDebt : 0) +
      monthlyFleetAmortization +
      monthlyAnnexAmortization +
      monthlyVehicleReserve;
    const suarl = current?.suarl ?? config.regime === 'suarl';
    const taxRate = suarl ? config.isRate / 100 : 0;
    const reserveRate = config.legalReservePercent / 100;
    const legalRate = monthlyPlan.legalRoomAfterMonth ? reserveRate : 0;
    const monthlyAmortization = monthlyFleetAmortization + monthlyAnnexAmortization;
    const requiredProfit = Math.max(
      0,
      (config.monthlyProfitTarget + obligations - taxRate * monthlyAmortization) /
        Math.max(0.01, 1 - taxRate - legalRate),
    );
    const requiredMoves = margin > 0 ? Math.ceil((operationCosts + requiredProfit) / margin) : 0;
    const requiredRevenue = requiredMoves * average;
    const monthBookings = bookings.filter(
      (booking) => booking.date?.slice(0, 7) === endMonth && booking.status !== 'cancelled',
    );
    const finalRevenue = monthBookings
      .filter((booking) => booking.status === 'completed')
      .reduce((sum, booking) => sum + revenueAmount(booking), 0);
    const provisionalRevenue = monthBookings.reduce((sum, booking) => {
      if (booking.status === 'completed') return sum;
      return sum + revenueAmount(booking);
    }, 0);
    const periodStart = allPeriods ? config.start : endMonth;
    const periodMonths: string[] = [];
    for (
      let month = periodStart;
      month <= endMonth && periodMonths.length < 240;
      month = nextMonth(month)
    ) {
      periodMonths.push(month);
    }
    const fixedChargeRows: [string, number, boolean, string][] = [
      [
        text.monthlyChargeSalary,
        config.salaries.reduce((sum, salary) => sum + salary.amount, 0),
        false,
        'sal',
      ],
      [
        text.monthlyChargeOil(fleetCount, money(config.oilChangeCost)),
        oilChangeDue ? fleetCount * config.oilChangeCost : 0,
        !oilChangeDue,
        'vid',
      ],
      [text.monthlyChargeInsurance(fleetCount), monthlyInsurance, false, 'ass'],
      [text.monthlyChargeDepreciation(config.fleetYears), monthlyFleetAmortization, false, 'amo'],
      ...(config.annexes.length
        ? [
            [text.monthlyChargeAnnex, monthlyAnnexAmortization, false, 'anx'] as [
              string,
              number,
              boolean,
              string,
            ],
          ]
        : []),
      [text.monthlyChargeReserve, monthlyVehicleReserve, false, 'res'],
      ...(debtStillDue && monthlyDebt > 0
        ? [[text.monthlyChargeDebt, monthlyDebt, false, 'det'] as [string, number, boolean, string]]
        : []),
      ...(monthlyPlan.legalRoomBeforeMonth
        ? [
            [
              text.monthlyChargeLegalReserve(config.legalReservePercent),
              monthlyPlan.legalReserveDue,
              false,
              'leg',
            ] as [string, number, boolean, string],
          ]
        : []),
    ];
    const remainingFixed = periodMonths.reduce(
      (sum, month) =>
        sum +
        fixedChargeRows.reduce((monthSum, [, amount, notDue, key]) => {
          if (
            notDue ||
            entries.some(
              (entry) => entry.date.slice(0, 7) === month && referenceFixedChargeKey(entry) === key,
            )
          )
            return monthSum;
          return monthSum + amount;
        }, 0),
      0,
    );
    return {
      average,
      averageSampleCount,
      variableCost,
      margin,
      operationCosts,
      advertisingCost,
      requiredProfit,
      requiredMoves,
      requiredRevenue,
      monthBookings: monthBookings.length,
      finalCount: monthBookings.filter((booking) => booking.status === 'completed').length,
      finalRevenue,
      provisionalRevenue,
      hypotheticalMoves: bookings.filter(
        (booking) =>
          booking.date &&
          periodMonths.includes(booking.date.slice(0, 7)) &&
          booking.status !== 'cancelled',
      ).length,
      hypotheticalFinals: bookings.filter(
        (booking) =>
          booking.date &&
          periodMonths.includes(booking.date.slice(0, 7)) &&
          booking.status !== 'cancelled' &&
          booking.status === 'completed',
      ).length,
      journalRevenue: summary.revenue,
      journalCharges: summary.charges,
      hypotheticalBalance: summary.balance - remainingFixed,
      remainingFixed,
      fixedChargeRows,
    };
  }, [allPeriods, bookings, catalogue, config, current, endMonth, entries, summary]);

  async function analyze() {
    setAnalyzing(true);
    setAnalysisError('');
    const prompt = [
      'Tu es conseiller financier d’une petite entreprise de déménagement à Dakar (Sénégal), monnaie FCFA. Réponds en français, en texte brut sans markdown ni astérisques, en 12 lignes maximum, sans introduction. Base-toi uniquement sur les données ci-dessous.',
      `Mois : ${endMonth}. Régime : ${current?.suarl ? `SUARL, IS ${config.isRate} %` : 'informel sans impôt'}. Flotte : ${config.vehicleCount} véhicules.`,
      `Objectif : ${money(config.monthlyProfitTarget)} de bénéfice net en plus chaque mois.`,
      `Prix moyen ${money(values.average)}, coût variable moyen ${money(values.variableCost)}, marge ${money(values.margin)} par déménagement. Calcul : ${values.requiredMoves} déménagements et ${money(values.requiredRevenue)} de chiffre d’affaires nécessaires.`,
      `Réalisé ce mois : ${values.monthBookings} déménagements, ${money(values.finalRevenue)} en final et ${money(values.provisionalRevenue)} en provisoire.`,
      'Donne : 1) si l’objectif est réaliste, 2) trois leviers concrets chiffrés, 3) le principal risque.',
    ].join('\n');
    try {
      const result = await completeClaude({ prompt });
      setAnalysis(
        String(result ?? '')
          .replace(/\*\*|#+ ?/g, '')
          .trim(),
      );
    } catch {
      setAnalysisError(text.analysisFailed);
    } finally {
      setAnalyzing(false);
    }
  }

  async function ask(question: string) {
    const promptQuestion = question.trim().slice(0, 3000);
    if (!promptQuestion || chatBusy) return;
    const history: FinanceChatMessage[] = [
      ...(config.financeChat ?? []),
      { speaker: 'user' as const, message: promptQuestion },
    ].slice(-40);
    update({ financeChat: history });
    setChatInput('');
    setChatBusy(true);
    const conversation = history
      .slice(-12)
      .map(
        (message) => `${message.speaker === 'user' ? 'Gérant' : 'Conseiller'} : ${message.message}`,
      )
      .join('\n');
    const currentDate = new Date();
    const today = currentDate.toISOString().slice(0, 10);
    const nextMonthDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const upcomingBookings = bookings.filter(
      (booking) =>
        booking.date &&
        booking.date >= today &&
        booking.date <= nextMonthDate &&
        booking.status !== 'cancelled',
    );
    const upcomingVehicles = new Map<string, number>();
    for (const booking of upcomingBookings) {
      const vehicle = booking.vehicle.shortName || booking.vehicle.name;
      upcomingVehicles.set(vehicle, (upcomingVehicles.get(vehicle) ?? 0) + 1);
    }
    const bookingSources = new Map<string, number>();
    for (const booking of bookings.filter((row) => row.status !== 'cancelled')) {
      const source = booking.source?.trim() || 'Inconnu';
      bookingSources.set(source, (bookingSources.get(source) ?? 0) + 1);
    }
    const discounts = bookings
      .flatMap((booking) => booking.quotes.map((quote) => quote.pricingInput?.discount ?? 0))
      .filter((discount) => discount > 0);
    const settings = catalogue?.settings;
    const vehicleRates = catalogue?.vehicles
      .map((vehicle) => `${vehicle.name} : ${vehicle.prices.map(money).join(' / ')} FCFA`)
      .join(' ; ');
    const assemblyRates = Object.entries(config.menuPrices)
      .slice(0, 30)
      .map(([item, prices]) => {
        const sizes = Object.entries(prices.sz ?? {})
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(
            ([size, rates]) =>
              `${size} unité${size === '1' ? '' : 's'} local ${money(rates.local ?? prices.local ?? 0)} / importé ${money(rates.import ?? prices.import ?? 0)}`,
          )
          .join(', ');
        return `${item} local ${money(prices.local ?? 0)} / importé ${money(prices.import ?? 0)}${sizes ? ` · tailles : ${sizes}` : ''}`;
      })
      .join(' ; ');
    const prompt = [
      'Tu es conseiller financier d’une petite entreprise de déménagement à Dakar (Sénégal), monnaie FCFA. Réponds en français, en texte brut sans markdown, de façon précise et chiffrée, à partir des données ci-dessous.',
      `Mois : ${endMonth}. Régime : ${current?.suarl ? `SUARL, IS ${config.isRate} %` : 'informel sans impôt'}. Flotte : ${config.vehicleCount} véhicules. Équipe : ${config.salaries.map((salary) => `${salary.name} (${money(salary.amount)}/mois)`).join(', ') || 'non renseignée'}.`,
      `Objectif : ${money(config.monthlyProfitTarget)} de bénéfice net supplémentaire par mois. Prix moyen : ${money(values.average)} ; coût variable moyen : ${money(values.variableCost)} ; marge : ${money(values.margin)} par déménagement. Calcul : ${values.requiredMoves} déménagements et ${money(values.requiredRevenue)} de chiffre d’affaires nécessaires.`,
      `Réalisé ce mois : ${values.monthBookings} déménagements dont ${values.finalCount} finaux ; ${money(values.finalRevenue)} en final et ${money(values.provisionalRevenue)} en provisoire. Solde journal : ${money(current?.profit ?? 0)}. Trésorerie après engagements : ${money(current?.cash ?? 0)}.`,
      `Charges publicitaires : ${money(Object.values(config.advertising[endMonth] ?? {}).reduce((sum, amount) => sum + amount, 0))}. Dette restante estimée : ${money(current?.debtLeft ?? config.debt)}.`,
      `Tarifs véhicules par palier : ${vehicleRates || 'non disponibles'}. Distances : ${settings?.distanceBounds.join(' / ') ?? 'non disponibles'} km. Main-d’œuvre : ${money(settings?.labourPrice ?? 0)} ; supplément étage ${money(settings?.labourFloorPrice ?? 0)} ; supplément ascenseur ${money(settings?.labourLiftPrice ?? 0)} ; montage de base ${money(settings?.assemblyPrice ?? 0)}.`,
      `Tarifs de montage configurés : ${assemblyRates || 'non configurés'}. Paiements : ${settings?.paymentWave ? 'Wave' : ''}${settings?.paymentWave && settings.paymentCash ? ' et ' : ''}${settings?.paymentCash ? 'espèces' : ''}${settings?.paymentQr ? ' et QR' : ''}${settings?.paymentWave || settings?.paymentCash || settings?.paymentQr ? '' : 'non renseignés'}.`,
      `Planning sur 30 jours : ${upcomingBookings.length} réservations non annulées, par véhicule : ${[...upcomingVehicles].map(([vehicle, count]) => `${vehicle} ${count}`).join(', ') || 'aucune'}. Répartition des réservations par provenance : ${[...bookingSources].map(([source, count]) => `${source} ${count}`).join(', ') || 'aucune'}. Remises connues dans les devis : ${discounts.length} (total déclaré ${money(discounts.reduce((sum, amount) => sum + amount, 0))}). Les disponibilités détaillées de l’équipe ne sont pas fournies à cet écran.`,
      `Historique récent : ${
        forecastHistory
          .slice(-6)
          .map((row) => `${row.key} revenus ${money(row.revenue)}, bénéfice ${money(row.profit)}`)
          .join(' ; ') || 'aucun mois calculé'
      }.`,
      '',
      'Conversation en cours :',
      conversation,
      '',
      'Réponds à la dernière question du gérant, en français, en texte brut sans markdown, de façon précise et chiffrée. 10 lignes maximum sauf s’il demande plus de détails.',
    ].join('\n');
    try {
      const response = String((await completeClaude({ prompt })) ?? '')
        .replace(/\*\*/g, '')
        .replace(/^#+\s*/gm, '')
        .trim()
        .slice(0, 3000);
      update({
        financeChat: [
          ...history,
          { speaker: 'assistant' as const, message: response || text.financeChatRetry },
        ].slice(-40),
      });
    } catch {
      update({
        financeChat: [
          ...history,
          { speaker: 'assistant' as const, message: text.financeChatRetry },
        ].slice(-40),
      });
    } finally {
      setChatBusy(false);
    }
  }

  const completion = values.requiredMoves
    ? Math.min(100, (values.monthBookings / values.requiredMoves) * 100)
    : 0;
  const revenueCompletion = values.requiredRevenue
    ? Math.min(
        100,
        ((values.finalRevenue + values.provisionalRevenue) / values.requiredRevenue) * 100,
      )
    : 0;
  const detailRows = [
    [
      `Prix moyen d’un déménagement${text.averagePriceStatus(config.averageMovingPrice > 0, values.averageSampleCount)}`,
      money(values.average),
    ],
    [text.averageVariableCost, `− ${money(values.variableCost)}`],
    [text.averageMargin, money(values.margin)],
    ...values.fixedChargeRows.map(([label, amount, notDue]) => [
      `${label}${notDue ? text.notDueThisMonth : ''}`,
      money(amount),
    ]),
    ...(values.advertisingCost > 0
      ? [[text.monthlyAdvertisingCost, money(values.advertisingCost)]]
      : []),
    [text.profitRequired(current?.suarl ? config.isRate : 0), money(values.requiredProfit)],
    [text.profitNeededThisMonth, money(values.requiredProfit)],
  ];

  return (
    <div className="reference-accounting-overview">
      <div className="accounting-stats reference-accounting-stats">
        <article>
          <span>{text.accountingRevenue}</span>
          <strong className="accounting-positive">{money(values.journalRevenue)}</strong>
          <small>{text.accountingEntryCount(summary.revenueCount)}</small>
        </article>
        <article>
          <span>{text.accountingCharges}</span>
          <strong className="accounting-negative">{money(values.journalCharges)}</strong>
          <small>{text.accountingEntryCount(summary.chargeCount)}</small>
        </article>
        <article className="reference-accounting-balance-card">
          <span>{text.accountingBalance}</span>
          <strong className={summary.balance < 0 ? 'accounting-negative' : 'accounting-positive'}>
            {money(summary.balance)}
          </strong>
          <small>{text.accountingBalanceHint}</small>
        </article>
        <article className="reference-accounting-hypothetical">
          <span>{text.hypotheticalBalance}</span>
          <strong
            className={
              values.hypotheticalBalance < 0 ? 'accounting-negative' : 'accounting-positive'
            }
          >
            {money(values.hypotheticalBalance)}
          </strong>
          <small>{text.forecastAssumptions}</small>
          <small>
            {values.remainingFixed > 0
              ? text.fixedChargesRemaining(money(values.remainingFixed))
              : text.allFixedChargesRecorded}
          </small>
          <small>{text.finalMovesCount(values.hypotheticalMoves, values.hypotheticalFinals)}</small>
        </article>
      </div>

      <section className="accounting-panel reference-accounting-objective">
        <div className="reference-accounting-objective-heading">
          <strong>{text.objectiveLabel(endMonth)}</strong>
          <span>
            {text.monthlySurplusTarget} : <strong>{money(config.monthlyProfitTarget)}</strong>
          </span>
        </div>
        {values.requiredMoves > 0 ? (
          <>
            <div className="reference-accounting-objective-grid">
              <div>
                <span>{text.movesNeeded}</span>
                <strong>{text.movesNeededValue(values.requiredMoves)}</strong>
                <div className="reference-accounting-progress">
                  <i style={{ width: `${completion}%` }} />
                </div>
                <small>
                  {text.movesPlanned(values.monthBookings, values.finalCount)} ·{' '}
                  {text.perDayOver26((values.requiredMoves / 26).toFixed(1).replace('.', ','))}
                </small>
              </div>
              <div>
                <span>{text.turnoverNeeded}</span>
                <strong>{money(values.requiredRevenue)}</strong>
                <div className="reference-accounting-progress revenue">
                  <i style={{ width: `${revenueCompletion}%` }} />
                </div>
                <small>
                  {text.plannedFinalProvisionalRevenue(
                    money(values.finalRevenue),
                    money(values.provisionalRevenue),
                  )}
                </small>
              </div>
            </div>
            <small>{text.averagePriceAndMargin(money(values.average), money(values.margin))}</small>
          </>
        ) : values.average <= 0 ? (
          <p className="accounting-finance-rule negative">{text.noAveragePrice}</p>
        ) : values.margin <= 0 && values.requiredProfit > 0 ? (
          <p className="accounting-finance-rule negative">{text.reviseRates}</p>
        ) : (
          <p className="accounting-finance-rule">{text.noSurplusObjective}</p>
        )}
        <button
          className={`reference-accounting-details-toggle${showCalculation ? ' open' : ''}`}
          onClick={() => setShowCalculation((value) => !value)}
          aria-expanded={showCalculation}
        >
          <ChevronDown size={16} /> {text.calculationDetails}
        </button>
        {showCalculation && (
          <div className="reference-accounting-details">
            {detailRows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="reference-accounting-ai">
          <div>
            <strong>{text.analysisDiscussion}</strong>
            <button className="button primary" onClick={() => void analyze()} disabled={analyzing}>
              {analyzing
                ? text.analysisInProgress
                : analysis
                  ? text.relaunchAnalysis
                  : text.analyzeWithAI}
            </button>
          </div>
          {analysis && <p>{analysis}</p>}
          {analysisError && <p role="status">{analysisError}</p>}
          <div className="reference-accounting-chat">
            {(config.financeChat ?? []).length > 0 && (
              <div className="reference-accounting-chat-messages" aria-live="polite">
                {[...(config.financeChat ?? [])].reverse().map((message, index) => (
                  <article
                    className={`reference-accounting-chat-message ${message.speaker}`}
                    key={`${message.speaker}-${index}-${message.message.slice(0, 24)}`}
                  >
                    <span>
                      {message.speaker === 'user'
                        ? text.financeChatUser
                        : text.financeChatAssistant}
                    </span>
                    <p>{message.message}</p>
                  </article>
                ))}
                {chatBusy && (
                  <article className="reference-accounting-chat-message assistant">
                    <span>{text.financeChatAssistant}</span>
                    <p>{text.financeChatThinking}</p>
                  </article>
                )}
              </div>
            )}
            {!(config.financeChat ?? []).length && (
              <div className="reference-accounting-chat-suggestions">
                {financeQuestions.map((question) => (
                  <button
                    type="button"
                    key={question}
                    disabled={chatBusy}
                    onClick={() => void ask(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            <form
              className="reference-accounting-chat-form"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(chatInput);
              }}
            >
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={text.financeChatPlaceholder}
                aria-label={text.financeChatPlaceholder}
                disabled={chatBusy}
                maxLength={3000}
              />
              <button
                type="submit"
                className="button primary"
                disabled={chatBusy || !chatInput.trim()}
              >
                {chatBusy ? '…' : text.financeChatSend}
              </button>
            </form>
            {(config.financeChat ?? []).length > 0 && (
              <button
                type="button"
                className="reference-accounting-chat-clear"
                onClick={() => update({ financeChat: [] })}
              >
                {text.financeChatClear}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
