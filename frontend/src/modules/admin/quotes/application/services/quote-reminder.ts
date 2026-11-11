import type { Draft } from '../../../../booking/application/booking-draft';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import { today } from '../../../../shared/domain/date';
import type { Booking, Settings } from '../../../../shared/domain/model';
import {
  whatsappNumber,
  whatsappUrl,
} from '../../../../shared/messaging/application/services/whatsapp';
import {
  quoteConditionsText,
  whatsappPaymentLine,
} from '../../../../shared/messaging/application/services/whatsapp-templates';

type ReminderInventory = Pick<Inventory, 'ready' | 'stairs' | 'balcPx'>;

export function quoteReminder({
  draft,
  booking,
  settings,
  inventory,
  billingMode,
}: {
  draft: Draft;
  booking: Booking | null;
  settings?: Settings;
  inventory: ReminderInventory;
  billingMode: 'complete' | 'standard' | 'driver-rental';
}) {
  const canSendQuoteWhatsApp =
    whatsappNumber(draft.customerPhone, settings?.whatsappCountryCode ?? '221').length >= 10;
  const reminderDays = draft.date
    ? Math.round(
        (+new Date(`${draft.date}T12:00:00Z`) - +new Date(`${today()}T12:00:00Z`)) / 86400000,
      )
    : -1;
  const reminderCanSend = Boolean(
    booking && draft.date && reminderDays >= 0 && canSendQuoteWhatsApp,
  );
  const reminderDisabledReason = !booking
    ? 'Enregistrez le devis pour envoyer un rappel'
    : !canSendQuoteWhatsApp
      ? 'Ajoutez le numéro du client'
      : !draft.date
        ? 'Choisissez la date du rendez-vous'
        : reminderDays < 0
          ? 'La date du rendez-vous est passée'
          : '';
  const reminderWhen =
    reminderDays === 0
      ? 'aujourd’hui'
      : reminderDays === 1
        ? 'demain'
        : reminderDays % 7 === 0
          ? `dans ${reminderDays / 7} semaine${reminderDays > 7 ? 's' : ''}`
          : `dans ${reminderDays} jours`;
  const reminderDateLabel = draft.date
    ? new Date(`${draft.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Dakar',
      })
    : '';
  const reminderPayment = whatsappPaymentLine(settings);
  const reminderConditions = quoteConditionsText(inventory, billingMode);
  const balconyPrice = Math.max(0, Math.round(Number(inventory.balcPx) || 0));
  const reminderHref = booking
    ? whatsappUrl(
        draft.customerPhone,
        `Bonjour ${draft.customerName}, petit rappel de Demenag Express : votre déménagement (${booking.reference}) est prévu ${reminderWhen}, le ${reminderDateLabel}${draft.timeSlot && draft.timeSlot !== 'À définir' ? ` à ${draft.timeSlot}` : ''}.\n${draft.fromAddress ? `Départ : ${draft.fromAddress}\n` : ''}${draft.toAddress ? `Arrivée : ${draft.toAddress}\n` : ''}${reminderConditions || 'Merci de préparer vos affaires pour le chargement.'}${reminderPayment ? `\n${reminderPayment}` : ''}\nPour toute question, contactez-nous au ${settings?.whatsappPhone || settings?.businessPhone || ''}. À bientôt !`,
        settings,
      )
    : '';

  return {
    canSendQuoteWhatsApp,
    reminderDays,
    reminderWhen,
    reminderCanSend,
    reminderDisabledReason,
    reminderDateLabel,
    reminderHref,
    balconyPrice,
  };
}
