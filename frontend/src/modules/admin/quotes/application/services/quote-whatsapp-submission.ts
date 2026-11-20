import type { Draft } from '../../../../booking/application/booking-draft';
import type { Quote } from '../../../../shared/domain/model';
import { normalizePhoneNumber } from '../../../../shared/domain/phone-number';
import { adminQuoteValidationToastKeys } from './admin-quote-form-policy';

type MutableReference<Value> = { current: Value };

export function startQuoteWhatsAppSubmission({
  canSendQuoteWhatsApp,
  quoteKind,
  stairs,
  balconyPrice,
  previewTier,
  customPrice,
  maximumDistance,
  draft,
  setStageError,
  showErrorToast,
  openClientSection,
  openRouteSection,
  whatsappWindow,
  sendWhatsAppAfterSave,
}: {
  canSendQuoteWhatsApp: boolean;
  quoteKind: Quote['kind'];
  stairs: string | undefined;
  balconyPrice: number;
  previewTier: number;
  customPrice: number | null;
  maximumDistance: number;
  draft: Pick<
    Draft,
    'customerName' | 'customerPhone' | 'date' | 'noDate' | 'route' | 'fromAddress' | 'toAddress'
  >;
  setStageError: (message: string) => void;
  showErrorToast: (message: string, options?: { persistent?: boolean; toastKey?: string }) => void;
  openClientSection: () => void;
  openRouteSection: () => void;
  whatsappWindow: MutableReference<Window | null>;
  sendWhatsAppAfterSave: MutableReference<boolean>;
}) {
  if (draft.customerName.trim().length < 2) {
    showErrorToast('Saisissez le nom du client (au moins 2 caractères).', {
      persistent: true,
      toastKey: adminQuoteValidationToastKeys.clientName,
    });
    openClientSection();
    return;
  }
  const phoneMessage = !draft.customerPhone.trim()
    ? 'Saisissez le numéro de téléphone du client.'
    : !normalizePhoneNumber(draft.customerPhone)
      ? 'Saisissez un numéro valide avec son indicatif international.'
      : '';
  if (phoneMessage || !canSendQuoteWhatsApp) {
    showErrorToast(phoneMessage || 'Saisissez un numéro valide avec son indicatif international.', {
      persistent: true,
      toastKey: adminQuoteValidationToastKeys.clientPhone,
    });
    openClientSection();
    return;
  }
  if (!draft.fromAddress.trim() || !draft.toAddress.trim() || !draft.route) {
    const message =
      !draft.fromAddress.trim() || !draft.toAddress.trim()
        ? 'Complétez les adresses de départ et d’arrivée, puis calculez le trajet.'
        : 'Calculez le trajet avant d’enregistrer le devis.';
    showErrorToast(message, {
      persistent: true,
      toastKey: adminQuoteValidationToastKeys.route,
    });
    openRouteSection();
    return;
  }
  if (quoteKind === 'final' && stairs === 'balcon' && balconyPrice <= 0) {
    const message = 'Passage par le balcon : fixez le supplément avant le devis final.';
    setStageError(message);
    showErrorToast(message);
    return;
  }
  if (quoteKind === 'final' && previewTier === 3 && !(Number(customPrice) > 0)) {
    const message = `Distance au-delà de ${maximumDistance} km : fixez le prix par chargement et déchargement avant le devis final.`;
    setStageError(message);
    showErrorToast(message);
    return;
  }
  if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
    const message =
      'Un devis sans date reste provisoire. Choisissez une date pour passer en final.';
    setStageError(message);
    showErrorToast(message);
    return;
  }
  const form = document.getElementById('admin-quote-form') as HTMLFormElement | null;
  if (!form?.reportValidity()) return;
  whatsappWindow.current = window.open('about:blank', '_blank');
  if (!whatsappWindow.current) {
    const message = 'Autorisez les fenêtres pour ouvrir WhatsApp après l’enregistrement du devis.';
    setStageError(message);
    showErrorToast(message);
    return;
  }
  sendWhatsAppAfterSave.current = true;
  setStageError('');
  form.requestSubmit();
}
