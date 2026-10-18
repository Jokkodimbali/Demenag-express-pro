import { messages } from '../../content/fr';
import { money } from '../../domain/format';
import type { Booking, Quote } from '../../domain/model';

export function quoteNotificationUrl(booking: Booking, quote: Quote) {
  return (
    'https://wa.me/' +
    booking.phone.replace(/\D/g, '') +
    '?text=' +
    encodeURIComponent(
      `${messages.quoteNotification(
        booking.customerName,
        quote.reference,
        booking.reference,
        money(quote.price.total),
      )}\n\nLe PDF du devis a été téléchargé. Joignez le fichier à ce message avant de l’envoyer.`,
    )
  );
}
