import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';
import { catalogueFromForm } from '../catalogue-from-form';
import type { Catalogue, Settings } from '../../../../shared/domain/model';
import { defaultAccountingFinanceConfiguration } from '../../../accounting/domain/accounting-forecast';
import {
  resetAccountingChargesToReference,
  resetCatalogueTariffsToReference,
} from '../../domain/reference-tariff-defaults';
export function useSettings() {
  const { api, catalogue, setCatalogue } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFormData = useRef<FormData | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(false);
  const enqueueSaveRef = useRef<(formData: FormData) => Promise<void>>(async () => {});

  function enqueueSave(formData: FormData) {
    const persist = async () => {
      const current = catalogueRef.current;
      if (!current) return;
      if (mounted.current) {
        setBusy(true);
        setError('');
      }
      try {
        const updated = await api.updateCatalogue(await catalogueFromForm(formData, current));
        catalogueRef.current = updated;
        setCatalogue(updated);
        if (mounted.current) setSaved(true);
      } catch (cause) {
        if (mounted.current) setError(errorMessage(cause));
      } finally {
        if (mounted.current) setBusy(false);
      }
    };
    saveQueue.current = saveQueue.current.then(persist, persist);
    return saveQueue.current;
  }

  function flushPending(form?: HTMLFormElement) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (form) pendingFormData.current = new FormData(form);
    const formData = pendingFormData.current;
    pendingFormData.current = null;
    return formData ? enqueueSave(formData) : saveQueue.current;
  }

  enqueueSaveRef.current = enqueueSave;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const formData = pendingFormData.current;
      pendingFormData.current = null;
      if (formData) void enqueueSaveRef.current(formData);
    };
  }, []);

  function queueSave(form: HTMLFormElement) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingFormData.current = new FormData(form);
    setSaved(false);
    saveTimer.current = setTimeout(() => {
      void flushPending();
    }, 650);
  }

  function onChange(event: React.ChangeEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLInputElement && !event.target.name) return;
    queueSave(event.currentTarget);
  }

  function onBlur(event: React.FocusEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLElement && 'name' in event.target && event.target.name) {
      void flushPending(event.currentTarget);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue) return;
    setSaved(false);
    setError('');
    await flushPending(e.currentTarget);
  }
  async function updateSettings(patch: Partial<Settings>) {
    await flushPending();
    const persist = async () => {
      const current = catalogueRef.current;
      if (!current) return;
      const updated = await api.updateCatalogue({
        ...current,
        settings: { ...current.settings, ...patch },
      });
      catalogueRef.current = updated;
      setCatalogue(updated);
    };
    saveQueue.current = saveQueue.current.then(persist, persist);
    return saveQueue.current;
  }

  async function replaceCatalogue(transform: (current: Catalogue) => Catalogue) {
    await flushPending();
    let succeeded = false;
    const persist = async () => {
      const current = catalogueRef.current;
      if (!current) return;
      if (mounted.current) {
        setBusy(true);
        setSaved(false);
        setError('');
      }
      try {
        const updated = await api.updateCatalogue(transform(current));
        catalogueRef.current = updated;
        setCatalogue(updated);
        succeeded = true;
        if (mounted.current) setSaved(true);
      } catch (cause) {
        if (mounted.current) setError(errorMessage(cause));
      } finally {
        if (mounted.current) setBusy(false);
      }
    };
    saveQueue.current = saveQueue.current.then(persist, persist);
    await saveQueue.current;
    return succeeded;
  }
  async function resetReferenceDefaults() {
    const updated = await replaceCatalogue(resetCatalogueTariffsToReference);
    if (!updated) return false;
    const currentFinance = {
      ...defaultAccountingFinanceConfiguration(),
      ...(await api.accountingConfiguration()),
    };
    await api.saveAccountingConfiguration(resetAccountingChargesToReference(currentFinance));
    return true;
  }
  return {
    catalogue,
    busy,
    error,
    saved,
    submit,
    onChange,
    onBlur,
    updateSettings,
    replaceCatalogue,
    resetReferenceDefaults,
  };
}
