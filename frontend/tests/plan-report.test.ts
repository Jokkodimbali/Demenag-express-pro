import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlanReport } from '../src/components/PlanQhseReport.tsx';
import type { Booking, WorkPlanStep } from '../src/domain/model';

const booking = (id: string) =>
  ({
    id,
    reference: `DEM-${id}`,
    date: '2026-10-27',
  }) as Booking;
const step = (
  status: WorkPlanStep['review']['status'],
  extras: Partial<WorkPlanStep['review']> = {},
): WorkPlanStep => ({
  id: 'step-1',
  time: '08:00',
  title: 'Arrivée au départ',
  detail: '',
  minutes: 15,
  review: { status, reason: '', checkedAt: null, checkedBy: null, ...extras },
});

test('QHSE report counts statuses, causes, gravity and corrective actions from saved reviews', () => {
  const entries = [booking('one'), booking('two')];
  const plans: Record<string, WorkPlanStep[]> = {
    one: [step('respected')],
    two: [
      step('late', {
        reason: 'Embouteillage',
        cause: 'Circulation',
        severity: 'maj',
        correctiveAction: 'Départ plus tôt',
        actualTime: '08:30',
      }),
    ],
  };
  const report = buildPlanReport(entries, (item) => plans[item.id], '27 octobre 2026');
  assert.equal(report.bookingCount, 2);
  assert.equal(report.respected, 1);
  assert.equal(report.justified, 1);
  assert.equal(report.kpi[0].value, '50 %');
  assert.deepEqual(report.causes, [['Circulation', 1]]);
  assert.equal(report.gravity.maj, 1);
  assert.equal(report.nonConformities[0].action, 'Départ plus tôt');
  assert.equal(report.nonConformities[0].real, '08:30');
});
