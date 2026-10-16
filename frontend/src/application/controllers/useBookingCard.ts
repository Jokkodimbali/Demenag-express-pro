import { useState } from 'react';
import { messages } from '../../content/fr';
import { money } from '../../domain/format';
import type { Booking, BookingStatus, Quote } from '../../domain/model';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { quoteFromForm } from '../validation/forms';
export function useBookingCard({
  booking: b,
  onChange,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
}) {
  const { api, exportQuote } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false);
  const last = b.quotes.at(-1);
  const terminal = ['completed', 'cancelled'].includes(b.status);
  async function change(status: BookingStatus) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api.status(b.id, status, b.version));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function pdf(quote?: Quote) {
    setError('');
    setBusy(true);
    try {
      await exportQuote(b, quote);
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
      onChange(await api.quote(b.id, quoteFromForm(form, b.version)));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const wa = last
    ? 'https://wa.me/' +
      b.phone.replace(/\D/g, '') +
      '?text=' +
      encodeURIComponent(
        messages.quoteNotification(
          b.customerName,
          last.reference,
          b.reference,
          money(last.price.total),
        ),
      )
    : '';
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
    open,
    setOpen,
    busy,
    error,
    setError,
    editing,
    setEditing,
    last,
    terminal,
    change,
    pdf,
    quote,
    wa,
  };
}
