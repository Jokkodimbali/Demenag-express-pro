import { messages } from '../../content/fr';
import { dateLabel, money } from '../../domain/format';
import type { Booking, Quote } from '../../domain/model';
import type { Settings } from '../../domain/model';
import { whatsappUrl } from './whatsapp';

export function quoteNotificationUrl(booking: Booking, quote: Quote, settings?: Settings) {
  const defaultMessage = messages.quoteNotification(
    booking.customerName,
    quote.reference,
    booking.reference,
    money(quote.price.total),
  );
  const template = settings?.whatsappQuoteTemplate;
  const message =
    quote.kind === 'final' && template
      ? template.replace(/\{(nom|ref|num|total|allers|vehicule|date|trajet)\}/g, (token) => {
          const values: Record<string, string> = {
            '{nom}': booking.customerName,
            '{ref}': booking.reference,
            '{num}': quote.reference,
            '{total}': money(quote.price.total),
            '{allers}': String(quote.price.trips),
            '{vehicule}': booking.vehicle.name,
            '{date}': booking.date ? dateLabel(booking.date) : '',
            '{trajet}': `${booking.fromAddress} → ${booking.toAddress}`,
          };
          return values[token] ?? token;
        })
      : defaultMessage;
  return whatsappUrl(booking.phone, message, settings);
}
