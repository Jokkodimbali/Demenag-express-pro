import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBookingSubmission } from '../src/modules/booking/application/services/booking-submission.ts';
import { blankDraft } from '../src/modules/booking/application/booking-draft.ts';

const existingBooking = {
  customerName: 'Client existant',
  phone: '+221771234567',
};

function administrativeSubmission(customerName: string, customerPhone: string) {
  const draft = blankDraft();
  draft.customerName = customerName;
  draft.customerPhone = customerPhone;
  return buildBookingSubmission({
    draft,
    existingBooking,
    routeId: 'route-test',
    administrativeQuote: true,
    quoteTrips: 2,
    notes: '',
    questionnaireAnswers: [],
    workPlan: [],
  });
}

test('une modification de devis conserve le nom et le téléphone enregistrés si les champs sont invalides', () => {
  const submission = administrativeSubmission('', 'numéro incomplet');

  assert.equal(submission.customerName, existingBooking.customerName);
  assert.equal(submission.customerPhone, existingBooking.phone);
});

test('une modification de devis conserve les nouvelles coordonnées valides saisies', () => {
  const submission = administrativeSubmission('Nouveau client', '+221 78 123 45 67');

  assert.equal(submission.customerName, 'Nouveau client');
  assert.equal(submission.customerPhone, '+221 78 123 45 67');
});
