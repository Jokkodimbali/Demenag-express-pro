import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpApi, ApiError } from '../src/adapters/http-api.ts';

test('Une session refusée est signalée, contrairement aux identifiants incorrects', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'Refusé' }), { status: 401 });
  try {
    const api = createHttpApi('/api');
    let expired = 0;
    const unsubscribe = api.onSessionExpired!(() => {
      expired++;
    });
    await assert.rejects(api.login('771234567', 'incorrect'), ApiError);
    await assert.rejects(api.changePassword('incorrect', 'nouveau'), ApiError);
    assert.equal(expired, 0);
    await assert.rejects(api.driverProfile(), ApiError);
    assert.equal(expired, 1);
    unsubscribe();
    await assert.rejects(api.driverBookings(), ApiError);
    assert.equal(expired, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Une panne réseau ou un accès interdit ne déconnecte pas la session', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const api = createHttpApi('/api');
    let expired = 0;
    api.onSessionExpired!(() => {
      expired++;
    });
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(api.driverProfile(), ApiError);
    globalThis.fetch = async () => {
      throw new TypeError('offline');
    };
    await assert.rejects(api.driverProfile(), ApiError);
    assert.equal(expired, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
