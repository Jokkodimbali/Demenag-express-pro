import { money } from '../../domain/format';
import type { Booking, Quote } from '../../domain/model';
import type { Settings } from '../../domain/model';
import { whatsappUrl } from './whatsapp';
import {
  defaultFinalQuoteTemplate,
  defaultLegacyFinalQuoteTemplate,
  defaultProvisionalQuoteTemplate,
  renderQuoteTemplate,
  whatsappPaymentLine,
} from './whatsapp-templates';

export function quoteNotificationUrl(booking: Booking, quote: Quote, settings?: Settings) {
  const configuredTemplate =
    quote.kind === 'final'
      ? settings?.whatsappQuoteTemplate
      : settings?.whatsappProvisionalTemplate;
  const template =
    quote.kind === 'final'
      ? !configuredTemplate || configuredTemplate === defaultLegacyFinalQuoteTemplate
        ? defaultFinalQuoteTemplate
        : configuredTemplate
      : configuredTemplate || defaultProvisionalQuoteTemplate;
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
  const paymentLine = whatsappPaymentLine(settings);
  const date = booking.date
    ? booking.date.split('-').reverse().join('/')
    : booking.month
      ? `à fixer (${new Date(`${booking.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })})`
      : 'à fixer';
  const tripCount = Math.max(1, quote.price.trips);
  const message = renderQuoteTemplate(
    template,
    {
      nom: booking.customerName,
      ref: booking.reference,
      num: quote.reference || booking.reference,
      total: `${money(quote.price.total)}${tolls.length ? ` (+ péages à votre charge : ${money(tollTotal)})` : ''}`,
      peages: tollText,
      paiement: paymentLine,
      allers: String(tripCount),
      voyages: `${tripCount}${tripCount > 1 ? ' allers-retours' : ' aller-retour'}`,
      vehicule: booking.vehicle.shortName || booking.vehicle.name,
      date,
      heure:
        booking.date && booking.timeSlot && booking.timeSlot !== 'À définir'
          ? ` à ${booking.timeSlot.replace(':', 'h')}`
          : '',
      trajet: `${booking.fromAddress || '—'} → ${booking.toAddress || '—'}`,
    },
    { tollText, paymentLine },
  );
  return whatsappUrl(booking.phone, message, settings);
}
