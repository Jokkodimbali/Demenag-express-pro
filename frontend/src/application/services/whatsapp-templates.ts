import type { Booking } from '../../domain/model';
import { money } from '../../domain/format';

export const defaultProvisionalQuoteTemplate =
  'Bonjour {nom},\n\nMerci pour votre demande. Voici votre devis provisoire Demenag Express n° {num} :\n- Date : {date}{heure}\n- Trajet : {trajet}\n- Véhicule : {vehicule}, {voyages}\n- Montant estimé : {total}\n\nCe montant est une estimation établie d’après votre inventaire. Il sera confirmé par le devis final.\nJe vous envoie le PDF du devis juste après ce message.\n\nPour confirmer ou modifier votre demande, répondez simplement ici.';

export const defaultFinalQuoteTemplate =
  'Bonjour {nom},\n\nVoici votre devis final Demenag Express n° {num} :\n- Date : {date}{heure}\n- Trajet : {trajet}\n- Véhicule : {vehicule}, {voyages}\n- Montant total : {total}\n\nCe montant est définitif.\nJe vous envoie le PDF du devis final juste après ce message.\n\nMerci pour votre confiance.';

export const defaultLegacyFinalQuoteTemplate =
  'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !';

export const whatsappPaymentLine = (settings?: {
  paymentWave?: boolean;
  paymentCash?: boolean;
  paymentQr?: string | null;
}) => {
  const wave = settings?.paymentWave !== false;
  const cash = settings?.paymentCash !== false;
  if (!wave && !cash) return '';
  return (
    `Mode de paiement : ${wave && cash ? 'par Wave ou en espèces, au choix.' : wave ? 'par Wave uniquement (pas d’espèces).' : 'en espèces uniquement (pas de Wave).'}` +
    (wave && settings?.paymentQr ? ' Le QR code Wave marchand figure sur le devis PDF.' : '')
  );
};

export function renderQuoteTemplate(
  template: string,
  values: Record<string, string>,
  extras: { tollText?: string; paymentLine?: string } = {},
) {
  let message = template.replace(/\{(\w+)\}/gu, (token, key: string) => values[key] ?? token);
  if (extras.tollText && !template.includes('{peages}'))
    message += `\n\nPéages à votre charge (non inclus) :\n${extras.tollText}`;
  if (extras.paymentLine && !template.includes('{paiement}'))
    message += `\n\n${extras.paymentLine}`;
  return message;
}
export function bookingConfirmationMessage(booking: Booking) {
  const date = booking.date ? booking.date.split('-').reverse().join('/') : '';
  const vehicle = booking.vehicle.shortName || booking.vehicle.name;
  return `Bonjour, réservation ${booking.reference || ''} : ${vehicle}, ${booking.fromAddress} → ${booking.toAddress}, le ${date}. Estimation : ${money(booking.estimate.total)}.`;
}
