import assert from 'node:assert/strict';
import test from 'node:test';
import { SignedRouteTicketCodec } from '../src/adapters/out/security/route-ticket-codec.js';

const secret = 'test-route-ticket-secret-that-is-long-enough';
const route = {
  from: [14.69, -17.44] as [number, number],
  to: [14.73, -17.48] as [number, number],
  distanceKm: 20,
  durationMinutes: 35,
  geometry: [[14.69, -17.44] as [number, number], [14.73, -17.48] as [number, number]],
};

test('un ticket signé permet de chiffrer le trajet sans dépendre de la base', () => {
  const codec = new SignedRouteTicketCodec(secret);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const issued = codec.issue(route, expiresAt);

  assert.deepEqual(codec.find(issued.id), {
    from: route.from,
    to: route.to,
    distanceKm: route.distanceKm,
    expiresAt,
  });
  assert.deepEqual(issued.geometry, route.geometry);
});

test('un ticket modifié ou signé avec une autre clé est refusé', () => {
  const ticket = new SignedRouteTicketCodec(secret).issue(
    route,
    new Date(Date.now() + 60_000).toISOString(),
  );

  assert.equal(new SignedRouteTicketCodec(secret).find(`${ticket.id}x`), null);
  assert.equal(new SignedRouteTicketCodec(`${secret}-other`).find(ticket.id), null);
});

test('un ticket expiré est refusé', () => {
  const codec = new SignedRouteTicketCodec(secret);
  const ticket = codec.issue(route, new Date(Date.now() - 60_000).toISOString());

  assert.equal(codec.find(ticket.id), null);
});
