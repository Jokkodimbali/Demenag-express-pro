import assert from 'node:assert/strict';
import test from 'node:test';
import type { Booking } from '../src/domain/model';
import {
  mergeTeamChanges,
  needsOf,
  normalizeCrewLead,
  slotKey,
  teamOf,
} from '../src/application/services/team-planning';
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

test('les besoins d’équipe suivent les effectifs et meubles du dernier devis', () => {
  const current = booking({
    options: { labour: 2, bed: 0, wardrobe: 0, desk: 0 },
    quotes: [
      {
        id: 'quote-1',
        reference: 'DEV-1',
        kind: 'provisional',
        createdAt: '2026-11-01T10:00:00.000Z',
        price: {} as Booking['estimate'],
        notes: '',
        options: { labour: 3, bed: 1, wardrobe: 0, desk: 0 },
        providedCrew: 4,
      },
    ],
  });

  assert.deepEqual(needsOf(current), { chauffeur: 1, menuisier: 1, manoeuvre: 4 });
});

test('sans devis, les besoins d’équipe utilisent les options de réservation', () => {
  const current = booking({
    options: { labour: 0, bed: 0, wardrobe: 1, desk: 0 },
    quotes: [],
  });

  assert.deepEqual(needsOf(current), { chauffeur: 1, menuisier: 1, manoeuvre: 0 });
});

test('la location avec chauffeur ne demande pas de manœuvre ni de menuisier', () => {
  const current = booking({
    options: { labour: 4, bed: 2, wardrobe: 1, desk: 0 },
    crew: {
      chauffeur: ['driver-a'],
      menuisier: ['carpenter-a'],
      manoeuvre: ['mover-a'],
      chef: 'driver-a',
    },
    quotes: [{ billingMode: 'driver-rental', providedCrew: 4 }] as Booking['quotes'],
  });
  assert.deepEqual(needsOf(current), { chauffeur: 1, menuisier: 0, manoeuvre: 0 });
  assert.deepEqual(teamOf(current), {
    chauffeur: ['driver-a'],
    menuisier: [],
    manoeuvre: [],
    chef: 'driver-a',
  });
});

test('la composition automatique choisit le chef selon la priorité de la référence', () => {
  const crew = {
    chauffeur: ['chauffeur-1'],
    menuisier: ['menuisier-1'],
    manoeuvre: ['manoeuvre-1'],
    chef: 'supprime-de-lequipe',
  };

  assert.equal(normalizeCrewLead(crew).chef, 'chauffeur-1');
  assert.equal(normalizeCrewLead({ ...crew, chauffeur: [], chef: '' }).chef, 'manoeuvre-1');
  assert.equal(
    normalizeCrewLead({ ...crew, chauffeur: [], manoeuvre: [], chef: '' }).chef,
    'menuisier-1',
  );
  assert.equal(normalizeCrewLead({ ...crew, chef: 'menuisier-1' }).chef, 'menuisier-1');
});

test('la détection du créneau reprend les préfixes reconnus par la référence', () => {
  assert.equal(slotKey('Après-midi'), 'aprem');
  assert.equal(slotKey('aprem'), 'aprem');
  assert.equal(slotKey('apres-midi'), 'aprem');
  assert.equal(slotKey('Matin'), 'matin');
  assert.equal(slotKey('Journée'), 'journee');
});
