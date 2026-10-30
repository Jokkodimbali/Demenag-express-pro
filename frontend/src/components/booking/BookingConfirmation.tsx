import { uiText } from '../../content/reference-ui-text';
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
    <section className="booking-confirmation" aria-label={uiText['demandeEnvoyee']}>
      <div className="booking-confirmation-card">
        <div className="booking-confirmation-check" aria-hidden="true">
          ✓
        </div>
        <div className="booking-confirmation-heading">
          <span>{uiText['reservationENVOYEE']}</span>
          <h2>
            {uiText['merci']}
            {firstName}
            {uiText['votreDEMANDEESTENCOURSDEXAMEN']}
          </h2>
          <p>{uiText['demenagExpressVerifieVotreDemandeEtVousRecontactePourC']}</p>
        </div>
        <div className="booking-confirmation-facts">
          <div>
            <span>{uiText['reference']}</span>
            <strong className="reference">{booking.reference}</strong>
          </div>
          <div>
            <span>{uiText['statut']}</span>
            <strong className="status">{uiText['enCoursDExamen']}</strong>
          </div>
          <div>
            <span>{uiText['date']}</span>
            <strong>{date}</strong>
          </div>
          <div>
            <span>{uiText['estimationPROVISOIRE']}</span>
            <strong>≈ {money(booking.estimate.total)}</strong>
          </div>
          <div className="route">
            <span>
              {uiText['trajet2']}
              {booking.vehicle.name}
            </span>
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
              {uiText['nousEcrireSurWhatsApp']}
            </a>
          )}
          <Link className="button secondary" to={routes.home}>
            {uiText['retourALAccueil']}
          </Link>
        </div>
      </div>
    </section>
  );
}
