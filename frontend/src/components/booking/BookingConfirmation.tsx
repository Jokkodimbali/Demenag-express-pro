import { Link } from 'react-router-dom';
import type { Booking, Settings } from '../../domain/model';
import { money } from '../../domain/format';
import { routes } from '../../routing/routes';
import { whatsappUrl } from '../../application/services/whatsapp';

export function BookingConfirmation({
  booking,
  settings,
  isClient,
}: {
  booking: Booking;
  settings: Settings;
  isClient: boolean;
}) {
  const firstName = booking.customerName.split(' ')[0] ?? '';
  const date = booking.date
    ? booking.date.split('-').reverse().join('/') +
      (booking.timeSlot ? ' · ' + booking.timeSlot : '')
    : 'Date à confirmer';
  const businessWhatsapp = settings.whatsappPhone || settings.businessPhone;
  const contactWhatsappUrl = whatsappUrl(
    businessWhatsapp,
    'Bonjour Demenag Express, je viens d’envoyer ma demande ' + booking.reference + '.',
    settings,
  );

  return (
    <section className="booking-confirmation" aria-label="Demande envoyée">
      <div className="booking-confirmation-card">
        <div className="booking-confirmation-check" aria-hidden="true">
          ✓
        </div>
        <div className="booking-confirmation-heading">
          <span>RÉSERVATION ENVOYÉE</span>
          <h2>MERCI {firstName}, VOTRE DEMANDE EST EN COURS D’EXAMEN</h2>
          <p>
            Demenag Express vérifie votre demande et vous recontacte pour confirmer le devis. Le
            montant affiché est une estimation provisoire.
          </p>
        </div>
        <div className="booking-confirmation-facts">
          <div>
            <span>RÉFÉRENCE</span>
            <strong className="reference">{booking.reference}</strong>
          </div>
          <div>
            <span>STATUT</span>
            <strong className="status">En cours d’examen</strong>
          </div>
          <div>
            <span>DATE</span>
            <strong>{date}</strong>
          </div>
          <div>
            <span>ESTIMATION PROVISOIRE</span>
            <strong>≈ {money(booking.estimate.total)}</strong>
          </div>
          <div className="route">
            <span>TRAJET · {booking.vehicle.name}</span>
            <strong>
              {booking.fromAddress || '—'} → {booking.toAddress || '—'}
            </strong>
          </div>
        </div>
        <div className="booking-confirmation-actions">
          <Link className="button primary" to={isClient ? routes.account : routes.administration}>
            {isClient ? 'Voir mon espace client' : 'Suivre ma demande (Mon compte)'}
          </Link>
          {businessWhatsapp && (
            <a
              className="button whatsapp"
              href={contactWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Nous écrire sur WhatsApp
            </a>
          )}
          <Link className="button secondary" to={routes.home}>
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
