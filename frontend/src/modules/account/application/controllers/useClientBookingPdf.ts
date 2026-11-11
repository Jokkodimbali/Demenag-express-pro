import { useState } from 'react';
import { liveBookingPrice } from '../../../moving/application/services/live-booking-price';
import { messages } from '../../../shared/content/fr';
import type { Booking, Quote } from '../../../shared/domain/model';
import { useApp } from '../../../shared/application/context';

export function useClientBookingPdf(booking: Booking) {
  const { catalogue, exportQuote } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pdf(quote?: Quote): Promise<void> {
    const settings = catalogue?.settings ?? booking.pricingSettings;
    if (!settings) return;

    setError('');
    setBusy(true);
    try {
      const price =
        quote?.kind === 'final' ? quote.price : liveBookingPrice(booking, catalogue, quote);
      const blob = await exportQuote(
        { ...booking, estimate: price },
        quote ? { ...quote, price } : undefined,
        settings,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Devis-${quote?.kind === 'final' ? 'final' : 'provisoire'}-${quote?.reference || booking.reference}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError(messages.lePdfNAPasPuEtreGenere);
    } finally {
      setBusy(false);
    }
  }

  return { pdf, busy, error };
}
