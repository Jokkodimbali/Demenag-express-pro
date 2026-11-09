import type { Booking, BookingInventorySource } from '../../domain/model';
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

export function quoteConditionsText(
  inventory: Pick<BookingInventorySource, 'ready' | 'stairs' | 'balcPx'> | undefined,
  billingMode: 'complete' | 'driver-rental' = 'complete',
) {
  if (!inventory) return '';
  const lines: string[] = [];
  if (inventory.ready === 'oui')
    lines.push(
      `- Matériel : tout doit être emballé et prêt à charger à l’arrivée ${billingMode === 'driver-rental' ? 'du véhicule' : 'de l’équipe'}.`,
    );
  else if (inventory.ready === 'non')
    lines.push(
      `- Matériel : emballage sur place par ${billingMode === 'driver-rental' ? 'vos manœuvres' : 'notre équipe'}.`,
    );
  if (inventory.stairs === 'oui') lines.push('- Passage : tout le matériel passe par l’escalier.');
  else if (inventory.stairs === 'balcon')
    lines.push(
      `- Passage : par le balcon${Number(inventory.balcPx) > 0 ? ` (supplément de ${money(inventory.balcPx!)} inclus).` : '.'}`,
    );
  else if (inventory.stairs === 'non') lines.push('- Passage : démontage ou monte-meuble prévu.');
  else if (inventory.stairs === 'verif')
    lines.push('- Passage par l’escalier : à confirmer avec nous avant le jour J.');
  return lines.length
    ? `CONDITIONS DE CHARGEMENT\n${lines.join('\n')}\nCes conditions doivent être respectées le jour du déménagement. Sinon, le déménagement n’aura pas lieu.`
    : '';
}

export function renderQuoteTemplate(
  template: string,
  values: Record<string, string>,
  extras: { tollText?: string; paymentLine?: string; conditions?: string } = {},
) {
  let message = template.replace(/\{(\w+)\}/gu, (token, key: string) => values[key] ?? token);
  if (extras.tollText && !template.includes('{peages}'))
    message += `\n\nPéages à votre charge (non inclus) :\n${extras.tollText}`;
  if (extras.paymentLine && !template.includes('{paiement}'))
    message += `\n\n${extras.paymentLine}`;
  if (extras.conditions && !template.includes('{conditions}'))
    message += `\n\n${extras.conditions}`;
  return message;
}
export function bookingConfirmationMessage(booking: Booking) {
  const date = booking.date ? booking.date.split('-').reverse().join('/') : '';
  const vehicle = booking.vehicle.shortName || booking.vehicle.name;
  return `Bonjour, réservation ${booking.reference || ''} : ${vehicle}, ${booking.fromAddress} → ${booking.toAddress}, le ${date}. Estimation : ${money(booking.estimate.total)}.`;
}
