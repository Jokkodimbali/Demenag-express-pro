import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { catalogueFromForm } from '../validation/forms';
import type { SettingsSection } from '../../pages/Settings';
export function useSettings(section: SettingsSection) {
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
        const updated = await api.updateCatalogue(
          await catalogueFromForm(formData, current, section),
        );
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
    if (section === 'pricing') queueSave(event.currentTarget);
  }

  function onBlur(event: React.FocusEvent<HTMLFormElement>) {
    if (
      section === 'pricing' &&
      event.target instanceof HTMLElement &&
      'name' in event.target &&
      event.target.name
    ) {
      void flushPending(event.currentTarget);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (section === 'pricing') {
      setSaved(false);
      await flushPending(e.currentTarget);
      return;
    }
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.updateCatalogue(await catalogueFromForm(form, catalogue, section));
      catalogueRef.current = updated;
      setCatalogue(updated);
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return { catalogue, busy, error, saved, submit, onChange, onBlur };
}
