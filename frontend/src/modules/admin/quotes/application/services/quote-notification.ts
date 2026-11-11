import { money } from '../../../../shared/application/presentation/format';
import type { Booking, Quote } from '../../../../shared/domain/model';
import type { Settings } from '../../../../shared/domain/model';
import { whatsappUrl } from '../../../../shared/messaging/application/services/whatsapp';
import {
  defaultFinalQuoteTemplate,
  defaultLegacyFinalQuoteTemplate,
  defaultProvisionalQuoteTemplate,
  renderQuoteTemplate,
  quoteConditionsText,
  whatsappPaymentLine,
} from '../../../../shared/messaging/application/services/whatsapp-templates';

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
  const conditions = quoteConditionsText(
    booking.inventorySnapshot?.sourceInventory,
    quote.billingMode,
  );
  const date = booking.date
    ? booking.date.split('-').reverse().join('/')
    : booking.month
      ? `à fixer (${new Date(`${booking.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })})`
      : 'à fixer';
  const tripCount = Math.max(1, quote.price.trips);
  let message = renderQuoteTemplate(
    template,
    {
      nom: booking.customerName,
      ref: booking.reference,
      num: quote.reference || booking.reference,
      total: `${money(quote.price.total)}${tolls.length ? ` (+ péages à votre charge : ${money(tollTotal)})` : ''}`,
      peages: tollText,
      paiement: paymentLine,
      conditions,
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
    { tollText, paymentLine, conditions },
  );
  if (quote.billingMode === 'driver-rental') {
    const kit = quote.rentalKit ?? [];
    const hourlyRate =
      quote.pricingInput?.rentalOvertimeHourlyRate ?? settings?.rentalOvertimeHourlyRate ?? 10000;
    const plannedEnd = booking.inventorySnapshot?.endTime;
    message += `\n\nLocation avec chauffeur. Matériel fourni :\n${kit
      .filter((item) => item.quantity > 0)
      .map((item) => `- ${item.label} : ${item.quantity}`)
      .join(
        '\n',
      )}\nVous fournissez ${quote.providedCrew ?? 0} manœuvre(s).\n\nIMPORTANT : ${plannedEnd ? `fin prévue à ${plannedEnd}. ` : ''}Chaque minute au-delà est facturée ${money(Math.round(hourlyRate / 60))} (${money(hourlyRate)} par heure). Ayez vos manœuvres sur place et vos affaires prêtes à charger dès l’arrivée du véhicule.`;
  }
  return whatsappUrl(booking.phone, message, settings);
}
