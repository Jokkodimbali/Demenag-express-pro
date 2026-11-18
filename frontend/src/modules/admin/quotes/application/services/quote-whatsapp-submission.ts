import type { Draft } from '../../../../booking/application/booking-draft';
import type { Quote } from '../../../../shared/domain/model';

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
  draft: Pick<Draft, 'date' | 'noDate' | 'route'>;
  setStageError: (message: string) => void;
  showErrorToast: (message: string) => void;
  openClientSection: () => void;
  whatsappWindow: MutableReference<Window | null>;
  sendWhatsAppAfterSave: MutableReference<boolean>;
}) {
  if (!canSendQuoteWhatsApp) {
    const message = 'Numéro WhatsApp du client invalide.';
    setStageError(message);
    showErrorToast(message);
    openClientSection();
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
  if (!draft.route) {
    const message = 'Calculez le trajet avant d’enregistrer et d’envoyer le devis.';
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
