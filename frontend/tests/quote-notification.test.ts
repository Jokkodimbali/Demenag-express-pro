import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteNotificationUrl } from '../src/application/services/quote-notification.ts';
import { bookingReminder } from '../src/application/services/booking-reminder.ts';
import { bookingConfirmationMessage } from '../src/application/services/whatsapp-templates.ts';
import type { Booking, Quote, Settings } from '../src/domain/model.ts';

const settings = {
  whatsappCountryCode: '221',
  whatsappMode: 'api',
  whatsappPhone: '+221775105104',
  businessPhone: '+221775105104',
  paymentWave: true,
  paymentCash: true,
  paymentQr: '/assets/wave-qr.png',
} as Settings;

const booking = {
  id: 'booking-1',
  reference: 'DEM-2026-0108',
  userId: 'client-1',
  customerName: 'Awa Ndiaye',
  phone: '771234567',
  vehicle: { id: 'master', name: 'Renault Master', shortName: 'Renault Master' },
  fromAddress: 'Ouakam',
  toAddress: 'Almadies',
  distanceKm: 12,
  date: '2026-11-10',
  timeSlot: '08:00',
  options: { labour: 2, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  status: 'pending',
  estimate: { total: 125000 },
  quotes: [],
  createdAt: '2026-11-03T00:00:00.000Z',
  version: 1,
} as unknown as Booking;

const quote = (kind: Quote['kind']): Quote =>
  ({
    id: `quote-${kind}`,
    reference: 'DV-2026-0108',
    kind,
    createdAt: '2026-11-03T00:00:00.000Z',
    price: { total: 125000, trips: 3 },
    notes: '',
    tolls: [
      { tollPointId: 'rufisque', label: 'Péage · Rufisque (Master)', quantity: 2, unitPrice: 1000 },
    ],
  }) as Quote;

function decodeMessage(url: string) {
  return new URL(url).searchParams.get('text') ?? '';
}

test('les modèles WhatsApp par défaut reprennent les textes provisoire et final de la référence', () => {
  const provisional = decodeMessage(quoteNotificationUrl(booking, quote('provisional'), settings));
  const final = decodeMessage(quoteNotificationUrl(booking, quote('final'), settings));

  assert.match(
    provisional,
    /Merci pour votre demande\. Voici votre devis provisoire Demenag Express n° DV-2026-0108/u,
  );
  assert.match(provisional, /- Date : 10\/11\/2026 à 08h00/u);
  assert.match(provisional, /- Véhicule : Renault Master, 3 allers-retours/u);
  assert.match(provisional, /Ce montant est une estimation établie d’après votre inventaire\./u);
  assert.match(final, /Voici votre devis final Demenag Express n° DV-2026-0108/u);
  assert.match(final, /Ce montant est définitif\./u);
  for (const message of [provisional, final]) {
    assert.match(message, /Ouakam → Almadies/u);
    assert.match(message, /Péages à votre charge \(non inclus\)/u);
    assert.match(message, /Mode de paiement : par Wave ou en espèces, au choix\./u);
    assert.match(message, /QR code Wave marchand figure sur le devis PDF/u);
  }
});

test('le modèle personnalisé remplace les variables et conserve péages et paiement', () => {
  const message = decodeMessage(
    quoteNotificationUrl(booking, quote('provisional'), {
      ...settings,
      whatsappProvisionalTemplate:
        '{nom}|{ref}|{num}|{date}{heure}|{trajet}|{vehicule}|{voyages}|{total}',
    }),
  );

  assert.match(
    message,
    /^Awa Ndiaye\|DEM-2026-0108\|DV-2026-0108\|10\/11\/2026 à 08h00\|Ouakam → Almadies\|Renault Master\|3 allers-retours\|125/u,
  );
  assert.match(message, /Péages à votre charge/u);
  assert.match(message, /Mode de paiement :/u);
});

test('le rappel automatique reprend les moyens de paiement, le QR et le numéro WhatsApp de référence', () => {
  const reminder = bookingReminder(booking, settings, false);
  const message = decodeMessage(reminder.reminderHref);

  assert.equal(reminder.canSendReminder, true);
  assert.match(message, /Mode de paiement : par Wave ou en espèces, au choix\./u);
  assert.match(message, /QR code Wave marchand figure sur le devis PDF/u);
  assert.match(message, /contactez-nous au \+221775105104/u);
});

test('la confirmation WhatsApp de réservation récapitule le trajet, le véhicule, la date et le prix', () => {
  assert.equal(
    bookingConfirmationMessage(booking),
    'Bonjour, réservation DEM-2026-0108 : Renault Master, Ouakam → Almadies, le 10/11/2026. Estimation : 125 000 FCFA.',
  );
});
