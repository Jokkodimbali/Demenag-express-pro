import assert from 'node:assert/strict';
import test from 'node:test';
import { startQuoteWhatsAppSubmission } from '../src/modules/admin/quotes/application/services/quote-whatsapp-submission';

test('WhatsApp refuse un devis sans trajet avant d’ouvrir un onglet', () => {
  let error = '';
  const whatsappWindow = { current: null };
  const sendWhatsAppAfterSave = { current: false };
  startQuoteWhatsAppSubmission({
    canSendQuoteWhatsApp: true,
    quoteKind: 'provisional',
    stairs: '',
    balconyPrice: 0,
    previewTier: 0,
    customPrice: null,
    maximumDistance: 35,
    draft: { date: '', noDate: true, route: null },
    setStageError: (message) => {
      error = message;
    },
    showErrorToast: () => {},
    openClientSection: () => {},
    whatsappWindow,
    sendWhatsAppAfterSave,
  });
  assert.match(error, /Calculez le trajet/);
  assert.equal(whatsappWindow.current, null);
  assert.equal(sendWhatsAppAfterSave.current, false);
});
