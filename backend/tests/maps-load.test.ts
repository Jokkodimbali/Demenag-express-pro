import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { registerErrorHandler } from '../src/adapters/in/http/error-handler.js';
import { registerMapRoutes } from '../src/adapters/in/http/map-routes.js';
import { registerSecurityMiddleware } from '../src/adapters/in/http/security-middleware.js';
import type { Point, RouteTicket } from '../src/domain/model.js';

test('1000 clients demandent un itinéraire simultanément depuis des IP distinctes', async (t) => {
  const app = express();
  let concurrentRequests = 0;
  let peakConcurrentRequests = 0;
  registerSecurityMiddleware(app, {
    origin: 'http://localhost:5173',
    production: true,
  });
  registerMapRoutes(app, {
    moving: {
      route: async (from: Point, to: Point): Promise<RouteTicket> => {
        concurrentRequests++;
        peakConcurrentRequests = Math.max(peakConcurrentRequests, concurrentRequests);
        await new Promise((resolve) => setTimeout(resolve, 20));
        concurrentRequests--;
        return {
          id: `route-${from[0]}`,
          from,
          to,
          distanceKm: 20,
          durationMinutes: 30,
          geometry: [from, to],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      },
      search: async () => [],
      reverse: async () => 'Dakar',
    },
  });
  registerErrorHandler(app);
  const server = app.listen(0);

  try {
    const startedAt = performance.now();
    const latencies: number[] = [];
    const client = request.agent(server);
    const responses = await Promise.all(
      Array.from({ length: 1000 }, async (_, index) => {
        const requestStartedAt = performance.now();
        const response = await client
          .post('/api/maps/route')
          .set('Origin', 'http://localhost:5173')
          .set('X-Requested-With', 'DemenagExpress')
          .set('X-Forwarded-For', `198.51.${Math.floor(index / 256)}.${index % 256}`)
          .send({
            from: [14.69 + index / 100_000, -17.44],
            to: [14.73, -17.48],
          });
        latencies.push(performance.now() - requestStartedAt);
        return response;
      }),
    );

    const failures = responses.filter((response) => response.status !== 200);
    assert.equal(
      failures.length,
      0,
      failures.map((response) => `${response.status}: ${JSON.stringify(response.body)}`).join('\n'),
    );
    latencies.sort((left, right) => left - right);
    const elapsedMs = performance.now() - startedAt;
    t.diagnostic(`Clients simulés: ${responses.length}`);
    t.diagnostic(`Pic de traitements simultanés: ${peakConcurrentRequests}/1000`);
    t.diagnostic(
      `Débit local avec dépendance simulée: ${(responses.length / (elapsedMs / 1000)).toFixed(1)} requêtes/s`,
    );
    t.diagnostic(
      `Latence observée p95: ${latencies[Math.floor(latencies.length * 0.95)]?.toFixed(1)} ms`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
