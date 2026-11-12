import { liveBookingPrice } from '../../../moving/application/services/live-booking-price';
import { whatsappPaymentLine } from '../../../shared/messaging/application/services/whatsapp-templates';
import { referenceTierLabels } from '../../../shared/application/presentation/format';
import type { Booking, Catalogue } from '../../../shared/domain/model';

export function clientBookingCardModel(booking: Booking, catalogue: Catalogue | null) {
  const provisionalQuote = booking.quotes.filter((quote) => quote.kind === 'provisional').at(-1);
  const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
  const distanceBounds = catalogue?.settings.distanceBounds ??
    booking.pricingSettings?.distanceBounds ?? [15, 25, 35];
  const tierIndex =
    booking.distanceKm < distanceBounds[0]
      ? 0
      : booking.distanceKm <= distanceBounds[1]
        ? 1
        : booking.distanceKm <= distanceBounds[2]
          ? 2
          : 3;
  const mapsUrl = new URL('https://www.google.com/maps/dir/');
  mapsUrl.searchParams.set('api', '1');
  mapsUrl.searchParams.set('origin', booking.from.join(','));
  mapsUrl.searchParams.set('destination', booking.to.join(','));
  mapsUrl.searchParams.set('travelmode', 'driving');
  const tolls = finalQuote?.tolls ?? [];

  return {
    provisionalQuote,
    finalQuote,
    displayedEstimate: liveBookingPrice(booking, catalogue).total,
    referenceDate: booking.date ? booking.date.split('-').reverse().join('/') : '—',
    distanceTier: referenceTierLabels(distanceBounds)[tierIndex],
    isFinal: booking.status === 'completed',
    canEdit: ['pending', 'confirmed', 'cancelled'].includes(booking.status) && !finalQuote,
    paymentText: whatsappPaymentLine(catalogue?.settings).split(' Le QR code')[0],
    tolls,
    tollTotal: tolls.reduce((total, toll) => total + toll.unitPrice * toll.quantity, 0),
    mapsUrl: mapsUrl.toString(),
  };
}
