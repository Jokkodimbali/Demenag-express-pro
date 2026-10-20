import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenStreetMaps } from '../src/adapters/out/maps/osrm.js';

test('le fournisseur cartographique borne la file de calcul des itinéraires', async () => {
  const originalFetch = globalThis.fetch;
  let releaseRequests!: () => void;
  let providerCalls = 0;
  const providerBarrier = new Promise<void>((resolve) => {
    releaseRequests = resolve;
  });
  globalThis.fetch = async () => {
    providerCalls++;
    await providerBarrier;
    return Response.json({
      routes: [
        {
          distance: 1200,
          duration: 300,
          geometry: {
            coordinates: [
              [-17.44, 14.69],
              [-17.48, 14.73],
            ],
          },
        },
      ],
    });
  };

  try {
    const provider = new OpenStreetMaps('https://routing.test', 'https://address.test', 'test');
    const requests = Array.from({ length: 40 }, (_, index) =>
      provider.route([14.69 + index / 100_000, -17.44], [14.73, -17.48]),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(providerCalls, 8, 'seules les 8 requêtes actives atteignent le fournisseur');
    await assert.rejects(
      provider.route([14.8, -17.4], [14.9, -17.5]),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 503 &&
        'code' in error &&
        error.code === 'MAP_PROVIDER_BUSY',
    );

    releaseRequests();
    const results = await Promise.allSettled(requests);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 40);
    assert.equal(providerCalls, 40);
  } finally {
    releaseRequests();
    globalThis.fetch = originalFetch;
  }
});
