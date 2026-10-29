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

test('un échec OSRM conserve le trajet direct et la distance du fichier de référence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('OSRM indisponible');
  };
  try {
    const provider = new OpenStreetMaps('https://routing.test', 'https://address.test', 'test');
    const from: [number, number] = [14.6928, -17.4467];
    const to: [number, number] = [14.7492, -17.3797];
    const route = await provider.route(from, to);
    assert.equal(route.fallback, true);
    assert.equal(route.durationMinutes, 0);
    assert.deepEqual(route.geometry, [from, to]);
    assert.ok(route.distanceKm > 10 && route.distanceKm < 15);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('la durée OSRM est arrondie à la minute comme dans le fichier de référence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      routes: [
        {
          distance: 1200,
          duration: 301,
          geometry: {
            coordinates: [
              [-17.44, 14.69],
              [-17.48, 14.73],
            ],
          },
        },
      ],
    });
  try {
    const provider = new OpenStreetMaps('https://routing.test', 'https://address.test', 'test');
    const route = await provider.route([14.69, -17.44], [14.73, -17.48]);
    assert.equal(route.durationMinutes, 5);
    assert.equal(route.fallback, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('le point posé sur la carte enregistre une adresse courte comme dans la référence', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url);
    return Response.json({
      display_name: 'Rue Carnot, Plateau, Dakar, Dakar Region, Senegal',
      address: {
        city: 'Dakar',
        neighbourhood: 'Plateau',
        road: 'Rue Carnot',
      },
    });
  };
  try {
    const provider = new OpenStreetMaps('https://routing.test', 'https://address.test', 'test');
    assert.equal(await provider.reverse([14.67, -17.43]), 'Dakar, Plateau, Rue Carnot');
    assert.equal(requestedUrls[0]?.searchParams.get('zoom'), '17');
    assert.equal(requestedUrls[0]?.searchParams.get('accept-language'), 'fr');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
