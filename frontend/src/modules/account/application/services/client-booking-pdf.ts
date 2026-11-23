import { liveBookingPrice } from '../../../moving/application/services/live-booking-price';
import type { Booking, Catalogue, Quote } from '../../../shared/domain/model';

export function clientBookingPdfDocument(
  booking: Booking,
  catalogue: Catalogue | null,
  quote: Quote | undefined,
) {
  const price = quote ? quote.price : liveBookingPrice(booking, catalogue);
  return {
    booking: { ...booking, estimate: price },
    quote: quote ? { ...quote, price } : undefined,
    filename: `Devis-${quote?.kind === 'final' ? 'final' : 'provisoire'}-${quote?.reference || booking.reference}.pdf`,
  };
}
