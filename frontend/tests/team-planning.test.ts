import assert from 'node:assert/strict';
import test from 'node:test';
import type { Booking } from '../src/domain/model';
import { mergeTeamChanges } from '../src/application/services/team-planning';
import { queueTeamSave, type CrewUpdateInput } from '../src/application/services/team-save-queue';

function booking(values: Partial<Booking> = {}) {
  return {
    id: 'booking-1',
    version: 1,
    crew: { chauffeur: [], menuisier: [], manoeuvre: [], chef: '' },
    crewBriefs: {},
    crewRefusedBy: [],
    crewReplies: {},
    crewMessages: {},
    ...values,
  } as unknown as Booking;
}

test('les ajouts rapides à une même équipe sont fusionnés sur la dernière version', () => {
  const original = booking();
  const firstChange = mergeTeamChanges(original, original, {
    crew: { chauffeur: ['driver-a'], menuisier: [], manoeuvre: [], chef: 'driver-a' },
  });
  const savedFirst = booking({ ...original, ...firstChange, version: 2 });
  const secondChange = mergeTeamChanges(savedFirst, original, {
    crew: { chauffeur: ['driver-b'], menuisier: [], manoeuvre: [], chef: 'driver-b' },
  });

  assert.deepEqual(secondChange.crew.chauffeur, ['driver-a', 'driver-b']);
  assert.equal(secondChange.crew.chef, 'driver-b');
});

test('la suppression d’un membre conserve les ajouts reçus pendant la sauvegarde', () => {
  const original = booking({
    crew: { chauffeur: ['driver-a', 'driver-b'], menuisier: [], manoeuvre: [], chef: 'driver-a' },
  });
  const latest = booking({
    ...original,
    version: 2,
    crew: {
      chauffeur: ['driver-a', 'driver-b', 'driver-c'],
      menuisier: [],
      manoeuvre: [],
      chef: 'driver-a',
    },
  });
  const change = mergeTeamChanges(latest, original, {
    crew: { chauffeur: ['driver-b'], menuisier: [], manoeuvre: [], chef: '' },
  });

  assert.deepEqual(change.crew.chauffeur, ['driver-b', 'driver-c']);
  assert.equal(change.crew.chef, '');
});

test('les briefs et réponses de personnes différentes ne se remplacent pas', () => {
  const original = booking();
  const first = mergeTeamChanges(original, original, {
    crewBriefs: { 'employee-a': '2026-11-04T10:00:00.000Z' },
    crewReplies: { 'employee-a': 'ok' },
  });
  const latest = booking({ ...original, ...first, version: 2 });
  const second = mergeTeamChanges(latest, original, {
    crewBriefs: { 'employee-b': '2026-11-04T10:01:00.000Z' },
    crewReplies: { 'employee-b': 'no' },
  });

  assert.deepEqual(second.crewBriefs, {
    'employee-a': '2026-11-04T10:00:00.000Z',
    'employee-b': '2026-11-04T10:01:00.000Z',
  });
  assert.deepEqual(second.crewReplies, { 'employee-a': 'ok', 'employee-b': 'no' });
});

test('les sauvegardes concurrentes utilisent des versions successives de la réservation', async () => {
  const original = booking();
  const queues = new Map<string, Promise<Booking | null>>();
  const confirmed = new Map<string, Booking>();
  const versions: number[] = [];
  let stored = original;
  const persist = async (_id: string, input: CrewUpdateInput) => {
    versions.push(input.version);
    await new Promise((resolve) => setTimeout(resolve, 5));
    stored = booking({ ...stored, ...input, version: input.version + 1 });
    return stored;
  };
  const first = queueTeamSave(
    original,
    { crew: { chauffeur: ['driver-a'], menuisier: [], manoeuvre: [], chef: 'driver-a' } },
    queues,
    confirmed,
    persist,
  );
  const second = queueTeamSave(
    original,
    { crew: { chauffeur: ['driver-b'], menuisier: [], manoeuvre: [], chef: 'driver-b' } },
    queues,
    confirmed,
    persist,
  );
  await Promise.all([first, second]);

  assert.deepEqual(versions, [1, 2]);
  assert.deepEqual(stored.crew?.chauffeur, ['driver-a', 'driver-b']);
  assert.equal(stored.version, 3);
});
