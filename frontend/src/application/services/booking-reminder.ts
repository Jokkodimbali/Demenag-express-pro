import type { Booking, Settings } from '../../domain/model';
import { whatsappNumber, whatsappUrl } from './whatsapp';

export function bookingReminder(
  booking: Booking,
  settings: Settings | undefined,
  terminal: boolean,
) {
  const clientPhoneLink = booking.phone.replace(/[^\d+]/g, '');
  const reminderToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
  }).format(new Date());
  const daysUntilMove = booking.date
    ? Math.round(
        (+new Date(`${booking.date}T12:00:00Z`) - +new Date(`${reminderToday}T12:00:00Z`)) /
          86400000,
      )
    : -1;
  const validNumber =
    whatsappNumber(booking.phone, settings?.whatsappCountryCode ?? '221').length >= 10;
  const canSendReminder = daysUntilMove >= 0 && !terminal && validNumber;
  const reminderWhen =
    daysUntilMove === 0
      ? 'aujourd’hui'
      : daysUntilMove === 1
        ? 'demain'
        : daysUntilMove % 7 === 0
          ? `dans ${daysUntilMove / 7} semaine${daysUntilMove > 7 ? 's' : ''}`
          : `dans ${daysUntilMove} jours`;
  const reminderDate = booking.date
    ? new Date(`${booking.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Dakar',
      })
    : '';
  const paymentMethods = [
    settings?.paymentWave !== false ? 'Wave' : '',
    settings?.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const reminderReason = !booking.date
    ? 'Ajoutez une date au rendez-vous.'
    : daysUntilMove < 0
      ? 'La date du rendez-vous est passée.'
      : terminal
        ? 'La réservation est clôturée.'
        : !validNumber
          ? 'Le numéro WhatsApp du client est manquant ou invalide.'
          : '';
  const reminderMessage = `Bonjour ${booking.customerName}, petit rappel de Demenag Express : votre déménagement (${booking.reference}) est prévu ${reminderWhen}, le ${reminderDate}${booking.timeSlot && booking.timeSlot !== 'À définir' ? ` à ${booking.timeSlot}` : ''}.\n${booking.fromAddress ? `Départ : ${booking.fromAddress}\n` : ''}${booking.toAddress ? `Arrivée : ${booking.toAddress}\n` : ''}Merci de préparer vos affaires pour le chargement.${paymentMethods.length ? `\nMode de paiement : ${paymentMethods.join(' ou ')}${paymentMethods.length > 1 ? ' (au choix)' : ''}.` : ''} Pour toute question, contactez-nous au ${settings?.businessPhone ?? ''}. À bientôt !`;
  const lastReminder = booking.reminders?.at(-1);
  const lastReminderLabel = lastReminder
    ? `Dernier rappel : ${new Date(lastReminder.at).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Dakar',
      })}`
    : '';
  return {
    clientPhoneLink,
    canSendReminder,
    daysUntilMove,
    reminderWhen,
    reminderReason,
    reminderHref: whatsappUrl(booking.phone, reminderMessage, settings),
    lastReminderLabel,
  };
}
