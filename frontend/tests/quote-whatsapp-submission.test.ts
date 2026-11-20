import assert from 'node:assert/strict';
import test from 'node:test';
import { startQuoteWhatsAppSubmission } from '../src/modules/admin/quotes/application/services/quote-whatsapp-submission';

test('WhatsApp refuse un devis sans trajet avant d’ouvrir un onglet', () => {
  let toast: { message: string; options?: { persistent?: boolean; toastKey?: string } } | null =
    null;
  let routeOpened = false;
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
    draft: {
      customerName: 'Test client',
      customerPhone: '+221770000000',
      date: '',
      noDate: true,
      route: null,
      fromAddress: '',
      toAddress: '',
    },
    setStageError: () => {},
    showErrorToast: (message, options) => {
      toast = { message, options };
    },
    openClientSection: () => {},
    openRouteSection: () => {
      routeOpened = true;
    },
    whatsappWindow,
    sendWhatsAppAfterSave,
  });
  assert.match(toast?.message ?? '', /Complétez les adresses/);
  assert.equal(toast?.options?.persistent, true);
  assert.equal(toast?.options?.toastKey, 'admin-quote-validation-route');
  assert.equal(routeOpened, true);
  assert.equal(whatsappWindow.current, null);
  assert.equal(sendWhatsAppAfterSave.current, false);
});

test('WhatsApp affiche une erreur persistante si le nom du client est absent', () => {
  let toast: { message: string; options?: { persistent?: boolean; toastKey?: string } } | null =
    null;
  let clientOpened = false;
  startQuoteWhatsAppSubmission({
    canSendQuoteWhatsApp: true,
    quoteKind: 'provisional',
    stairs: '',
    balconyPrice: 0,
    previewTier: 0,
    customPrice: null,
    maximumDistance: 35,
    draft: {
      customerName: '',
      customerPhone: '+221770000000',
      date: '',
      noDate: true,
      route: null,
      fromAddress: '',
      toAddress: '',
    },
    setStageError: () => {},
    showErrorToast: (message, options) => {
      toast = { message, options };
    },
    openClientSection: () => {
      clientOpened = true;
    },
    openRouteSection: () => {},
    whatsappWindow: { current: null },
    sendWhatsAppAfterSave: { current: false },
  });

  assert.match(toast?.message ?? '', /Saisissez le nom du client/);
  assert.equal(toast?.options?.persistent, true);
  assert.equal(toast?.options?.toastKey, 'admin-quote-validation-client-name');
  assert.equal(clientOpened, true);
});
