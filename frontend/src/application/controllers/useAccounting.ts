import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  ManualAccountingInput,
} from '../ports';
import { useAdministration } from './useAdministration';
import {
  advertisingChannels,
  defaultAccountingFinanceConfiguration,
  jobLabourEntries,
  simulateAccounting,
} from '../../domain/accounting-forecast';

const categories = {
  charge: [
    'Salaires',
    'Manœuvres',
    'Menuisier',
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

function currentDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function exportCsv(entries: AccountingEntry[], period: string) {
  const safe = (value: string | number) => {
    const raw = String(value);
    const protectedValue = /^[\s]*[=+@-]/u.test(raw) && !/^-?\d+$/u.test(raw) ? `'${raw}` : raw;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  const rows = [
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
  const blob = new Blob(['\uFEFF', rows.map((row) => row.map(safe).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `journal-${period}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useAccounting() {
  const { api } = useApp();
  const { bookings } = useAdministration();
  const requestSequence = useRef(0);
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [all, setAll] = useState(false);
  const [storedEntries, setStoredEntries] = useState<AccountingEntry[]>([]);
  const [financeConfiguration, setFinanceConfiguration] = useState<AccountingFinanceConfiguration>(
    () => defaultAccountingFinanceConfiguration(),
  );
  const financeRef = useRef(financeConfiguration);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const [financeSaving, setFinanceSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ManualAccountingInput>({
    type: 'charge',
    category: categories.charge[0],
    label: '',
    amount: 0,
    date: currentDate(),
  });
  const [pendingVoid, setPendingVoid] = useState<AccountingEntry | null>(null);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const [nextEntries, config] = await Promise.all([
        api.accountingEntries(),
        api.accountingConfiguration(),
      ]);
      if (sequence === requestSequence.current) {
        setStoredEntries(nextEntries);
        if (config) {
          const defaults = defaultAccountingFinanceConfiguration();
          const normalized = {
            ...defaults,
            ...config,
            menuPrices: config.menuPrices ?? {},
            advertising: config.advertising ?? {},
            salaries: config.salaries ?? defaults.salaries,
            annexes: config.annexes ?? defaults.annexes,
            vehiclePurchases: config.vehiclePurchases ?? defaults.vehiclePurchases,
          };
          financeRef.current = normalized;
          setFinanceConfiguration(normalized);
        } else {
          const defaults = defaultAccountingFinanceConfiguration();
          financeRef.current = defaults;
          setFinanceConfiguration(defaults);
          saveChain.current = saveChain.current
            .catch(() => undefined)
            .then(() => api.saveAccountingConfiguration(defaults));
          await saveChain.current;
        }
      }
    } catch (cause) {
      if (sequence === requestSequence.current) setError(errorMessage(cause));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateFinanceConfiguration = useCallback(
    (
      change:
        | Partial<AccountingFinanceConfiguration>
        | ((value: AccountingFinanceConfiguration) => AccountingFinanceConfiguration),
    ) => {
      const current = financeRef.current;
      const next = typeof change === 'function' ? change(current) : { ...current, ...change };
      financeRef.current = next;
      setFinanceConfiguration(next);
      setFinanceSaving(true);
      const revision = ++saveRevision.current;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveChain.current = saveChain.current
          .catch(() => undefined)
          .then(() => api.saveAccountingConfiguration(next));
        void saveChain.current.then(
          () => {
            if (revision === saveRevision.current) setFinanceSaving(false);
          },
          (cause: unknown) => {
            if (revision !== saveRevision.current) return;
            setFinanceSaving(false);
            setError(errorMessage(cause));
          },
        );
      }, 450);
    },
    [api],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const latest = financeRef.current;
        saveChain.current = saveChain.current
          .then(() => api.saveAccountingConfiguration(latest))
          .catch(() => undefined);
      }
    },
    [api],
  );

  const generatedEntries = useMemo(() => {
    const labour = jobLabourEntries(bookings, financeConfiguration);
    const advertising: AccountingEntry[] = Object.entries(financeConfiguration.advertising).flatMap(
      ([period, channels]) =>
        Object.entries(channels).flatMap(([channel, amount]) => {
          const value = Math.max(0, Math.round(amount || 0));
          if (!value) return [];
          const [year, monthNumber] = period.split('-').map(Number);
          const last = new Date(Math.min(new Date(year, monthNumber, 0).getTime(), Date.now()));
          return [
            {
              id: `auto-ad-${period}-${channel}`,
              type: 'charge' as const,
              category: 'Publicité',
              label: `Publicité ${channel} · ${last.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
              amount: value,
              date: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`,
              automatic: true,
            },
          ];
        }),
    );
    return [...labour, ...advertising];
  }, [bookings, financeConfiguration]);
  const historicalFinalQuotesWithoutSnapshot = useMemo(
    () =>
      bookings.filter((booking) => {
        const final = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
        return Boolean(final && !final.accountingCosts);
      }).length,
    [bookings],
  );
  const allEntries = useMemo(
    () => [...storedEntries, ...generatedEntries],
    [storedEntries, generatedEntries],
  );
  const entries = useMemo(
    () => allEntries.filter((entry) => all || entry.date.slice(0, 7) === month),
    [all, allEntries, month],
  );
  const totals = useMemo(() => {
    const revenue = entries
      .filter((entry) => entry.type === 'revenu')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const charges = entries
      .filter((entry) => entry.type === 'charge')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const byCategory = new Map<string, number>();
    for (const entry of entries)
      if (entry.type === 'charge')
        byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
    return {
      revenue,
      charges,
      balance: revenue - charges,
      byCategory: [...byCategory].sort((a, b) => b[1] - a[1]),
    };
  }, [entries]);

  const currentMonth = currentDate().slice(0, 7);
  const forecast = useMemo(
    () =>
      simulateAccounting(financeConfiguration, allEntries, bookings, all ? currentMonth : month),
    [financeConfiguration, allEntries, bookings, all, currentMonth, month],
  );
  const currentForecast = forecast.months.find((item) => item.key === (all ? currentMonth : month));
  const advertisingSummary = useMemo(() => {
    const monthKey = all ? currentMonth : month;
    return advertisingChannels.map((channel) => {
      const spend = all
        ? Object.values(financeConfiguration.advertising).reduce(
            (sum, values) => sum + (values[channel] ?? 0),
            0,
          )
        : (financeConfiguration.advertising[monthKey]?.[channel] ?? 0);
      const clients = bookings.filter((booking) => {
        const createdMonth = (booking.createdAt || booking.date || '').slice(0, 7);
        return (
          booking.source === channel &&
          (all || createdMonth === monthKey) &&
          booking.status !== 'cancelled'
        );
      });
      const turnover = clients
        .filter((booking) => booking.quotes.some((quote) => quote.kind === 'final'))
        .reduce((sum, booking) => {
          const final = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
          return sum + (final?.price.total ?? 0);
        }, 0);
      return {
        channel,
        spend,
        clientCount: clients.length,
        turnover,
        costPerClient: spend && clients.length ? Math.round(spend / clients.length) : null,
        ratio: spend ? turnover / spend : null,
      };
    });
  }, [all, bookings, currentMonth, financeConfiguration.advertising, month]);

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createAccountingEntry({ ...form, label: form.label.trim() || form.category });
      setForm((previous) => ({ ...previous, label: '', amount: 0 }));
      setStoredEntries(await api.accountingEntries());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function voidEntry() {
    if (!pendingVoid) return;
    setBusy(true);
    setError('');
    try {
      await api.voidAccountingEntry(pendingVoid.id);
      setPendingVoid(null);
      setStoredEntries(await api.accountingEntries());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const title = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const maxCategory = totals.byCategory[0]?.[1] ?? 1;
  return {
    month,
    setMonth,
    all,
    setAll,
    entries,
    allEntries,
    financeConfiguration,
    updateFinanceConfiguration,
    financeSaving,
    forecast,
    currentForecast,
    advertisingSummary,
    historicalFinalQuotesWithoutSnapshot,
    bookings,
    loading,
    busy,
    error,
    form,
    setForm,
    pendingVoid,
    setPendingVoid,
    totals,
    addEntry,
    voidEntry,
    title,
    maxCategory,
    categories,
    shiftMonth,
    exportCsv,
  };
}
