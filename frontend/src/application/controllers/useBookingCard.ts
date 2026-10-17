import { useState } from 'react';
import { messages } from '../../content/fr';
import type { Booking, BookingStatus, Quote } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { quoteFromForm } from '../validation/forms';
import { quoteNotificationUrl } from '../services/quote-notification';
type ExtraLine = { id: string; label: string; quantity: number; unitPrice: number };
export function useBookingCard({
  booking: b,
  onChange,
  editInitially = false,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
  editInitially?: boolean;
}) {
  const { api, catalogue, exportQuote } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [cancelling, setCancelling] = useState(false),
    [editing, setEditing] = useState(editInitially),
    [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
  const last = b.quotes.at(-1);
  const terminal = ['completed', 'cancelled'].includes(b.status);
  async function change(status: BookingStatus): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      onChange(await api.status(b.id, status, b.version));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function requestCancellation() {
    if (busy) return;
    setError('');
    setCancelling(true);
  }
  async function confirmCancellation() {
    if (await change('cancelled')) setCancelling(false);
  }
  async function pdf(quote?: Quote) {
    if (!catalogue) return;
    setError('');
    setBusy(true);
    try {
      await exportQuote(b, quote, catalogue.settings);
    } catch {
      setError(messages.lePdfNAPasPuEtreGenere);
    } finally {
      setBusy(false);
    }
  }
  async function quote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      onChange(await api.quote(b.id, quoteFromForm(form, b.version, extraLines)));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const wa = last ? quoteNotificationUrl(b, last) : '';
  const finalQuote = b.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const finalWa = finalQuote ? quoteNotificationUrl(b, finalQuote) : '';
  async function refresh() {
    setError('');
    try {
      onChange(await api.booking(b.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return {
    refresh,
    busy,
    error,
    setError,
    cancelling,
    setCancelling,
    editing,
    setEditing,
    last,
    terminal,
    change,
    requestCancellation,
    confirmCancellation,
    pdf,
    quote,
    extraLines,
    setExtraLines,
    wa,
    finalQuote,
    finalWa,
  };
}
