import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';
import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  ManualAccountingInput,
} from '../../../../shared/application/ports';
import { useAdministration } from '../../../application/controllers/useAdministration';
import {
  accountingCategories,
  advertisingChannels,
  countFinalBookingsWithoutCostSnapshot,
  createAccountingForecast,
  generatedAccountingEntries,
  normalizeAccountingConfiguration,
  selectAccountingEntries,
  summarizeAccountingEntries,
  summarizeAdvertising,
} from '../services/accounting-dashboard';
import {
  accountingCsvContent,
  accountingEntryForSubmission,
  accountingMonthTitle,
  currentAccountingDate,
  largestAccountingCategoryAmount,
  shiftAccountingMonth,
} from '../services/accounting-presentation';

function downloadCsv(entries: AccountingEntry[], period: string) {
  const blob = new Blob(['\uFEFF', accountingCsvContent(entries)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `journal-${period}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useAccounting() {
  const { api } = useApp();
  const { bookings } = useAdministration();
  const requestSequence = useRef(0);
  const [month, setMonth] = useState(() => currentAccountingDate().slice(0, 7));
  const [all, setAll] = useState(false);
  const [storedEntries, setStoredEntries] = useState<AccountingEntry[]>([]);
  const [financeConfiguration, setFinanceConfiguration] = useState<AccountingFinanceConfiguration>(
    () => normalizeAccountingConfiguration(null),
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
    category: accountingCategories.charge[0],
    label: '',
    amount: 0,
    date: currentAccountingDate(),
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
        const normalized = normalizeAccountingConfiguration(config);
        financeRef.current = normalized;
        setFinanceConfiguration(normalized);
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
      const next = {
        ...(typeof change === 'function' ? change(current) : { ...current, ...change }),
      };
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

  const generatedEntries = useMemo(
    () => generatedAccountingEntries(financeConfiguration),
    [financeConfiguration],
  );
  const historicalFinalQuotesWithoutSnapshot = useMemo(
    () => countFinalBookingsWithoutCostSnapshot(bookings),
    [bookings],
  );
  const allEntries = useMemo(
    () => [...storedEntries, ...generatedEntries],
    [storedEntries, generatedEntries],
  );
  const currentMonth = currentAccountingDate().slice(0, 7);
  const entries = useMemo(
    () =>
      selectAccountingEntries(allEntries, {
        all,
        month,
        startMonth: financeConfiguration.start,
        currentMonth,
      }),
    [all, allEntries, currentMonth, financeConfiguration.start, month],
  );
  const totals = useMemo(() => summarizeAccountingEntries(entries), [entries]);

  const forecast = useMemo(
    () =>
      createAccountingForecast(
        financeConfiguration,
        allEntries,
        bookings,
        all ? currentMonth : month,
      ),
    [financeConfiguration, allEntries, bookings, all, currentMonth, month],
  );
  const currentForecast = forecast.months.find((item) => item.key === (all ? currentMonth : month));
  const advertisingSummary = useMemo(
    () =>
      summarizeAdvertising(financeConfiguration, bookings, advertisingChannels, {
        all,
        month,
        currentMonth,
      }),
    [all, bookings, currentMonth, financeConfiguration, month],
  );

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createAccountingEntry(accountingEntryForSubmission(form));
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

  const title = accountingMonthTitle(month);
  const maxCategory = largestAccountingCategoryAmount(totals.byCategory);
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
    categories: accountingCategories,
    shiftMonth: shiftAccountingMonth,
    exportCsv: downloadCsv,
  };
}
