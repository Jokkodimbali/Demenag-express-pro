import assert from 'node:assert/strict';
import test from 'node:test';
import { blankDraft } from '../src/modules/booking/application/booking-draft';
import { defaultAdminQuoteConfig } from '../src/modules/admin/quotes/application/services/admin-quote-config';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  type AdminQuoteDraft,
} from '../src/modules/admin/quotes/application/services/admin-quote-draft-storage';

test('le brouillon conserve les frais taxi et les heures supplémentaires après sortie et réouverture', async () => {
  const value: AdminQuoteDraft = {
    draft: blankDraft(),
    quoteConfig: {
      ...defaultAdminQuoteConfig(),
      calcMode: 'manual',
      legMinutes: 47,
      taxiFeeApplied: true,
      taxiFeeAmountOverride: 13_650,
      taxiCompanyApproachAmountOverride: 930,
      manoeuvreOvertimeEnabled: true,
      manoeuvreOvertimeHours: 2,
      manoeuvreOvertimePersonIds: ['mover-1'],
      manoeuvreOvertimeAdditionalPeople: 1,
      manoeuvreOvertimeHourlyRateOverride: 6_500,
    },
    tollLines: [],
    quoteKind: 'final',
  };
  let saved: unknown = null;
  const api = {
    adminQuoteDraft: async () => saved ?? value,
    saveAdminQuoteDraft: async (draft: unknown) => {
      saved = draft;
    },
    clearAdminQuoteDraft: async () => {
      saved = null;
    },
  };

  const beforeLeaving = await readAdminQuoteDraft(api);
  assert.ok(beforeLeaving);
  await saveAdminQuoteDraft(api, beforeLeaving);
  const reopened = await readAdminQuoteDraft(api);

  assert.equal(reopened?.quoteKind, 'final');
  assert.equal(reopened?.quoteConfig.calcMode, 'manual');
  assert.equal(reopened?.quoteConfig.legMinutes, 47);
  assert.equal(reopened?.quoteConfig.taxiFeeApplied, true);
  assert.equal(reopened?.quoteConfig.taxiFeeAmountOverride, 13_650);
  assert.equal(reopened?.quoteConfig.taxiCompanyApproachAmountOverride, 930);
  assert.equal(reopened?.quoteConfig.manoeuvreOvertimeEnabled, true);
  assert.equal(reopened?.quoteConfig.manoeuvreOvertimeHours, 2);
  assert.deepEqual(reopened?.quoteConfig.manoeuvreOvertimePersonIds, ['mover-1']);
  assert.equal(reopened?.quoteConfig.manoeuvreOvertimeAdditionalPeople, 1);
  assert.equal(reopened?.quoteConfig.manoeuvreOvertimeHourlyRateOverride, 6_500);
});
