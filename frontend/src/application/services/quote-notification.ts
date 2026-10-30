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
        .map(
          (toll) =>
            `- ${toll.label.replace(/^Péage · /i, '')} : ${toll.quantity} × ${money(toll.unitPrice)}`,
        )
        .join('\n') + `\nTotal péages : ${money(tollTotal)}`
    : '';
  const paymentModes = [
    settings?.paymentWave !== false ? 'Wave' : '',
    settings?.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const paymentLine = paymentModes.length
    ? `Mode de paiement : ${paymentModes.join(' ou ')}${paymentModes.length > 1 ? ' (au choix)' : ''}.${settings?.paymentWave !== false && settings?.paymentQr ? ' Le QR code marchand Wave figure sur le devis PDF.' : ''}`
    : '';
  const message =
    (template
      ? (() => {
          let rendered = template.replace(
            /\{(nom|ref|num|total|peages|paiement|allers|vehicule|date|trajet)\}/g,
            (token) => {
              const values: Record<string, string> = {
                '{nom}': booking.customerName,
                '{ref}': booking.reference,
                '{num}': quote.reference,
                '{total}': `${money(quote.price.total)}${tolls.length ? ` (+ péages à votre charge : ${money(tollTotal)})` : ''}`,
                '{peages}': tollText,
                '{paiement}': paymentLine,
                '{allers}': String(quote.price.trips),
                '{vehicule}': booking.vehicle.shortName || booking.vehicle.name,
                '{date}': booking.date ? booking.date.split('-').reverse().join('/') : '',
                '{trajet}': `${booking.fromAddress} → ${booking.toAddress}`,
              };
              return values[token] ?? token;
            },
          );
          if (tollText && !template.includes('{peages}'))
            rendered += `\n\nPéages à votre charge (non inclus) :\n${tollText}`;
          return rendered;
        })()
      : defaultMessage) +
    (paymentLine && !template?.includes('{paiement}') ? `\n\n${paymentLine}` : '');
  return whatsappUrl(booking.phone, message, settings);
}
