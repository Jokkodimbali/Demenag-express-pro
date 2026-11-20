import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bookingDraftFromExisting,
  preserveExistingAdminQuoteDate,
} from '../src/modules/booking/application/services/booking-edit-policy.ts';
import { blankDraft } from '../src/modules/booking/application/booking-draft.ts';
import { referenceInventoryNote } from '../src/modules/moving/domain/estimate/reference-inventory-note.ts';
import { blankInventory } from '../src/modules/moving/domain/inventory/inventory.ts';
import { quoteConditionsText } from '../src/modules/shared/messaging/application/services/whatsapp-templates.ts';
import type { Booking, Quote, RouteTicket } from '../src/modules/shared/domain/model.ts';

test('la réédition d’un devis retire son ancien résumé généré sans supprimer les notes client', () => {
  const inventory = blankInventory();
  inventory.dwellingType = 'Studio';
  inventory.ready = 'oui';
  inventory.stairs = 'oui';
  inventory.entries.salon = {
    quantity: 8,
    size: 5,
    format: 'medium',
    origin: 'import',
    dismantle: false,
  };
  const fromAddress = 'Rue PL-109 / au rez-de-chaussée';
  const toAddress = 'Colobane, Dakar';
  const inventoryText = referenceInventoryNote(inventory, fromAddress, toAddress);
  const conditions = quoteConditionsText(inventory, 'complete');
  const question = { question: 'Le client a-t-il un ascenseur ?', answer: 'Non' };
  const generated = [
    inventoryText,
    'Estimation : volume ≈ 31,5 m³, soit 4 chargements et déchargements en Master III.',
    "Main-d'œuvre : 6 manœuvres (≈ 965 kg, objet le plus lourd ≈ 56 kg), chargement + déchargement ≈ 5 h 30 · trajet ≈ 25 min · durée ≈ 9 h 55 (13:15 à 23:10) · journée de plus de 8 h.",
    `${question.question} : ${question.answer}`,
    conditions,
  ].join('\n');
  const booking = {
    id: 'booking-1',
    reference: 'DV-TEST',
    customerName: 'Client test',
    phone: '+221700000000',
    fromAddress,
    toAddress,
    from: [0, 0],
    to: [0, 0],
    vehicle: { id: 'master', name: 'Renault Master III' },
    date: null,
    month: '2026-11',
    timeSlot: '',
    options: { labour: 6, desk: 0, wardrobe: 0, bed: 0 },
    notes: `${generated}\n${generated}\nClient demande un appel avant le départ.`,
    status: 'pending',
    estimate: { trips: 4 },
    quotes: [{ billingMode: 'complete' } as Quote],
    createdAt: '2026-11-16T00:00:00.000Z',
    version: 1,
    workAccess: { fromFloor: 0, toFloor: 0, fromLift: false, toLift: false },
    inventorySnapshot: {
      sourceInventory: inventory,
      fromFloor: 0,
      toFloor: 0,
      fromLift: false,
      toLift: false,
    },
    questionnaireAnswers: [question],
  } as unknown as Booking;
  const route = { id: 'route-1', distanceKm: 25 } as RouteTicket;

  const draft = bookingDraftFromExisting(booking, route, true);
  assert.equal(draft.notes, 'Client demande un appel avant le départ.');
});

test('la réédition restaure une date enregistrée si le formulaire est vide sans choix « date à définir »', () => {
  const draft = { ...blankDraft(), date: '', noDate: false, month: '2026-11', timeSlot: '' };
  const restored = preserveExistingAdminQuoteDate(draft, {
    date: '2026-12-15',
    month: '2026-12',
    timeSlot: '15:00',
  });

  assert.equal(restored.date, '2026-12-15');
  assert.equal(restored.month, '2026-12');
  assert.equal(restored.timeSlot, '15:00');
  assert.equal(restored.noDate, false);
});

test('le choix explicite « date à définir » conserve la date vide', () => {
  const draft = { ...blankDraft(), date: '', noDate: true, month: '2026-12', timeSlot: '' };
  const restored = preserveExistingAdminQuoteDate(draft, {
    date: '2026-12-15',
    month: '2026-12',
    timeSlot: '15:00',
  });

  assert.equal(restored, draft);
  assert.equal(restored.date, '');
  assert.equal(restored.noDate, true);
});
