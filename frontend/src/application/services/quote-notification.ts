import { messages } from '../../content/fr';
import { money } from '../../domain/format';
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
  const tolls = quote.tolls ?? [];
  const tollTotal = tolls.reduce((total, toll) => total + toll.quantity * toll.unitPrice, 0);
  const tollText = tolls.length
    ? tolls
        .map((toll) => `- ${toll.label.replace(/^Péage · /i, '')} : ${toll.quantity} × ${money(toll.unitPrice)}`)
        .join('\n') + `\nTotal péages : ${money(tollTotal)}`
    : '';
  const message =
    quote.kind === 'final' && template
      ? (() => {
          let rendered = template.replace(/\{(nom|ref|num|total|peages|allers|vehicule|date|trajet)\}/g, (token) => {
          const values: Record<string, string> = {
            '{nom}': booking.customerName,
            '{ref}': booking.reference,
            '{num}': quote.reference,
            '{total}': `${money(quote.price.total)}${tolls.length ? ` (+ péages à votre charge : ${money(tollTotal)})` : ''}`,
            '{peages}': tollText,
            '{allers}': String(quote.price.trips),
            '{vehicule}': booking.vehicle.shortName || booking.vehicle.name,
            '{date}': booking.date ? booking.date.split('-').reverse().join('/') : '',
            '{trajet}': `${booking.fromAddress} → ${booking.toAddress}`,
          };
          return values[token] ?? token;
          });
          if (tollText && !template.includes('{peages}'))
            rendered += `\n\nPéages à votre charge (non inclus) :\n${tollText}`;
          return rendered;
        })()
      : defaultMessage;
  return whatsappUrl(booking.phone, message, settings);
}
