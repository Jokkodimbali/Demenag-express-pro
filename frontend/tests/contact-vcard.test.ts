import assert from 'node:assert/strict';
import test from 'node:test';
import { contactVcard } from '../src/modules/shared/domain/contact-vcard';
import type { Booking, Settings } from '../src/modules/shared/domain/model';

test('le contact exporté reprend le modèle enregistré et les réservations du client', () => {
  const card = contactVcard(
    {
      name: 'Moussa Diop',
      phone: '77 123 45 67',
      bookings: [
        {
          reference: 'DEM-4861',
          date: '2026-11-06',
          timeSlot: '08:00',
          fromAddress: 'Dakar, Mermoz',
          toAddress: 'Almadies',
          status: 'pending',
          vehicle: { shortName: 'Sprinter' },
        },
      ] as Booking[],
    },
    {
      contactFirstTemplate: '{ref} {prenom}',
      contactLastTemplate: '{nom} · {date}',
    } as Settings,
  );

  assert.equal(card.name, 'DEM-4861 Moussa Diop · 06/11');
  assert.match(card.vcard, /N:Diop · 06\/11;DEM-4861 Moussa;;;/u);
  assert.match(card.vcard, /TEL;TYPE=CELL:\+221771234567/u);
  assert.match(card.vcard, /DEM-4861 · 06\/11\/2026 08:00 · Dakar\\, Mermoz → Almadies/u);
});

test('le contact exporté conserve l’indicatif international au lieu de le remplacer par +221', () => {
  const card = contactVcard(
    { name: 'Client test', phone: '+33 6 12 34 56 78', bookings: [] },
    {} as Settings,
  );
  assert.equal(card.valid, true);
  assert.match(card.vcard, /TEL;TYPE=CELL:\+33612345678/u);
});
