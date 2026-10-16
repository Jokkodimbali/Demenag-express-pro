import { useState } from 'react';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
export function usePasswordForm() {
  const { api, setUser } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      setUser(await api.changePassword(String(data.get('current')), String(data.get('next'))));
      form.reset();
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { open, setOpen, busy, error, saved, submit };
}
