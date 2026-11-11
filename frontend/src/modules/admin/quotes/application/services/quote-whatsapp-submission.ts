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
  draft: Pick<Draft, 'date' | 'noDate'>;
  setStageError: (message: string) => void;
  openClientSection: () => void;
  whatsappWindow: MutableReference<Window | null>;
  sendWhatsAppAfterSave: MutableReference<boolean>;
}) {
  if (!canSendQuoteWhatsApp) {
    setStageError('Numéro WhatsApp du client invalide.');
    openClientSection();
    return;
  }
  if (quoteKind === 'final' && stairs === 'balcon' && balconyPrice <= 0) {
    setStageError('Passage par le balcon : fixez le supplément avant le devis final.');
    return;
  }
  if (quoteKind === 'final' && previewTier === 3 && !(Number(customPrice) > 0)) {
    setStageError(
      `Distance au-delà de ${maximumDistance} km : fixez le prix par aller-retour avant le devis final.`,
    );
    return;
  }
  if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
    setStageError('Un devis sans date reste provisoire. Choisissez une date pour passer en final.');
    return;
  }
  const form = document.getElementById('admin-quote-form') as HTMLFormElement | null;
  if (!form?.reportValidity()) return;
  whatsappWindow.current = window.open('about:blank', '_blank');
  if (!whatsappWindow.current) {
    setStageError('Autorisez les fenêtres pour ouvrir WhatsApp après l’enregistrement du devis.');
    return;
  }
  sendWhatsAppAfterSave.current = true;
  setStageError('');
  form.requestSubmit();
}
