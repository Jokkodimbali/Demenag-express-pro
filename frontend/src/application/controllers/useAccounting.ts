import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import type { AccountingEntry, ManualAccountingInput } from '../ports';

const categories = {
  charge: [
    'Salaires',
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
  const requestSequence = useRef(0);
  const [month, setMonth] = useState(() => currentDate().slice(0, 7));
  const [all, setAll] = useState(false);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
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
      const nextEntries = await api.accountingEntries(all ? undefined : month);
      if (sequence === requestSequence.current) setEntries(nextEntries);
    } catch (cause) {
      if (sequence === requestSequence.current) setError(errorMessage(cause));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api, all, month]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createAccountingEntry({ ...form, label: form.label.trim() || form.category });
      setForm((previous) => ({ ...previous, label: '', amount: 0 }));
      await load();
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
      await load();
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
