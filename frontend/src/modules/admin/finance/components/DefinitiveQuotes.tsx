import { FilePenLine, MessageCircle } from 'lucide-react';
import { liveBookingPrice } from '../../../moving/application/services/live-booking-price';
import { quoteNotificationUrl } from '../../quotes/application/services/quote-notification';
import { messages } from '../../../shared/content/fr';
import { money } from '../../../shared/application/presentation/format';
import { useApp } from '../../../shared/application/context';
import type { Booking } from '../../../shared/domain/model';

type DefinitiveQuotesProps = {
  bookings: Booking[];
  onSelect: (booking: Booking) => void;
  onEdit: (booking: Booking) => void;
};

export function DefinitiveQuotes({ bookings, onSelect, onEdit }: DefinitiveQuotesProps) {
  const { catalogue } = useApp();
  const rows = bookings.filter(
    (booking) =>
      booking.status === 'in_progress' || booking.quotes.some((quote) => quote.kind === 'final'),
  );
  return (
    <div className="booking-list">
      {rows.length ? (
        rows.map((booking) => {
          const finalQuote = booking.quotes.filter((quote) => quote.kind === 'final').at(-1);
          const lastQuote = booking.quotes.at(-1);
          return (
            <article className="finance-row panel" key={booking.id}>
              <button className="finance-row-summary" onClick={() => onSelect(booking)}>
                <span>
                  <strong>{booking.reference}</strong> · {booking.customerName}
                </span>
                <small>{booking.vehicle.name}</small>
                <strong>{money(liveBookingPrice(booking, catalogue).total)}</strong>
              </button>
              <div className="finance-row-actions">
                {booking.status === 'in_progress' && (
                  <button className="button secondary small" onClick={() => onEdit(booking)}>
                    <FilePenLine size={16} />
                    {lastQuote ? messages.modifierLeDevis : messages.creerUnDevis}
                  </button>
                )}
                {finalQuote && (
                  <a
                    className="button primary small"
                    target="_blank"
                    rel="noreferrer"
                    href={quoteNotificationUrl(booking, finalQuote, catalogue?.settings)}
                  >
                    <MessageCircle size={16} />
                    {messages.envoyerLeDevisDefinitif}
                  </a>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="empty-state panel">{messages.aucunDevisDefinitifAProduire}</p>
      )}
    </div>
  );
}
