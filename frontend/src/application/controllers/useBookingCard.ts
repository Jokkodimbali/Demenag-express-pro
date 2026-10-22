import { useEffect, useState } from 'react';
import { messages } from '../../content/fr';
import type { Booking, BookingStatus, Quote, TollPoint } from '../../domain/model';
import { tollPointForLine } from '../../domain/toll-selection';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { quoteFromForm } from '../validation/forms';
import { quoteNotificationUrl } from '../services/quote-notification';
import { useMemo } from 'react';
import { quoteTotal } from '../services/quote-total';
import { quotedServiceOptions } from '../services/quote-service-options';
type ExtraLine = { id: string; label: string; quantity: number; unitPrice: number };
export function useBookingCard({
  booking: b,
  onChange,
  editInitially = false,
  onDeleted,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
  editInitially?: boolean;
  onDeleted?: () => void;
}) {
  const { api, catalogue, exportQuote, tollPoints } = useApp();
  const last = b.quotes.at(-1);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [cancelling, setCancelling] = useState(false),
    [editing, setEditing] = useState(editInitially),
    [deleting, setDeleting] = useState(false),
    [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState(''),
    [extraLines, setExtraLines] = useState<ExtraLine[]>(() => extrasFromLast(b, last, tollPoints)),
    [quoteNotes, setQuoteNotes] = useState(() => last?.notes || b.notes || '');
  const [quoteDraft, setQuoteDraft] = useState(() => ({
    kind: b.driverFinishedAt ? ('final' as const) : (last?.kind ?? ('provisional' as const)),
    trips: b.driverFinishedAt ? (b.trips?.length ?? 1) : (last?.price.trips ?? 1),
    customPrice:
      last?.price.lines.find((line) => line.label.includes(b.vehicle.name))?.unitPrice ?? null,
    discount: last?.price.discount ?? 0,
    options: quotedServiceOptions(b, last),
  }));
  const quoteSettings = b.pricingSettings ?? catalogue?.settings;
  const quotePreviewTotal = useMemo(
    () => (quoteSettings ? quoteTotal(b, quoteSettings, quoteDraft, extraLines) : null),
    [b, extraLines, quoteDraft, quoteSettings],
  );
  useEffect(() => {
    setQuoteDraft({
      kind: b.driverFinishedAt ? 'final' : (last?.kind ?? 'provisional'),
      trips: b.driverFinishedAt ? (b.trips?.length ?? 1) : (last?.price.trips ?? 1),
      customPrice:
        last?.price.lines.find((line) => line.label.includes(b.vehicle.name))?.unitPrice ?? null,
      discount: last?.price.discount ?? 0,
      options: quotedServiceOptions(b, last),
    });
    setExtraLines(extrasFromLast(b, last, tollPoints));
    setQuoteNotes(last?.notes || b.notes || '');
  }, [b, last, tollPoints]);
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
  async function saveSchedule(date: string, timeSlot: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      onChange(await api.schedule(b.id, date || null, date ? timeSlot : '', b.version));
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveBookingNotes(notes: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      onChange(await api.updateBookingNotes(b.id, notes, b.version));
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
  async function confirmDelete() {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.deleteBooking(b.id);
      setDeleting(false);
      onDeleted?.();
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }
  async function pdf(quote?: Quote): Promise<Blob | null> {
    if (!catalogue) return null;
    setError('');
    setBusy(true);
    try {
      return await exportQuote(b, quote, catalogue.settings);
    } catch {
      setError(messages.lePdfNAPasPuEtreGenere);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function shareQuote(quote: Quote, whatsappUrl: string) {
    const whatsappTab = window.open('about:blank', '_blank');
    setError('');
    const blob = await pdf(quote);
    if (!blob) {
      whatsappTab?.close();
      return;
    }
    const file = new File([blob], `${quote.reference}.pdf`, { type: 'application/pdf' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: quote.reference,
          text: decodeURIComponent(new URL(whatsappUrl).searchParams.get('text') || ''),
        });
        whatsappTab?.close();
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        whatsappTab?.close();
        return;
      }
    }
    if (whatsappTab) whatsappTab.location.href = whatsappUrl;
    else
      setError(
        'Autorisez l’ouverture des fenêtres pour préparer WhatsApp. Le PDF a été téléchargé.',
      );
  }
  async function quote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(e.currentTarget);
    form.set('notes', quoteNotes);
    try {
      onChange(
        await api.quote(b.id, quoteFromForm(form, b.version, extraLines, quoteDraft.options)),
      );
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
    saveSchedule,
    saveBookingNotes,
    requestCancellation,
    confirmCancellation,
    deleting,
    setDeleting,
    deleteBusy,
    deleteError,
    confirmDelete,
    pdf,
    shareQuote,
    quote,
    extraLines,
    setExtraLines,
    wa,
    finalQuote,
    finalWa,
    quoteDraft,
    quoteNotes,
    setQuoteNotes,
    setQuoteDraft,
    quotePreviewTotal,
    quoteSettings,
    enabledSlots: catalogue?.settings.enabledSlots ?? [],
  };
}

function extrasFromLast(
  booking: Booking,
  quote: Quote | undefined,
  tollPoints: TollPoint[],
): ExtraLine[] {
  if (!quote) return [];
  const serviceLabels = [
    'Manœuvre',
    'Menuisier · bureau',
    'Menuisier · armoire',
    'Menuisier · lit',
  ];
  return quote.price.lines
    .filter(
      (line) => !serviceLabels.includes(line.label) && !line.label.includes(booking.vehicle.name),
    )
    .map((line) => ({
      id: tollPointForLine(line.label, tollPoints)?.id ?? crypto.randomUUID(),
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));
}
