import { useState } from 'react';
import { messages } from '../../../shared/content/fr';
import type { Booking, Quote } from '../../../shared/domain/model';
import { useApp } from '../../../shared/application/context';
import { clientBookingPdfDocument } from '../services/client-booking-pdf';

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
      const pdfDocument = clientBookingPdfDocument(booking, catalogue, quote);
      const blob = await exportQuote(pdfDocument.booking, pdfDocument.quote, settings);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfDocument.filename;
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
