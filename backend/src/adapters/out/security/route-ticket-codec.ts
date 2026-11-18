import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { RouteTicketCodec } from '../../../application/ports/index.js';
import type { Point, Route, RouteTicket } from '../../../domain/shared/model.js';

const routeTicketPayloadSchema = z
  .object({
    version: z.literal(1),
    from: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
    to: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
    distanceKm: z.number().min(0).max(100000),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export class SignedRouteTicketCodec implements RouteTicketCodec {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32)
      throw new Error('La clé des tickets de trajet doit faire 32 caractères.');
    this.key = createHash('sha256')
      .update('demenag-express-route-ticket-v1:')
      .update(secret)
      .digest();
  }

  issue(route: Route, expiresAt: string): RouteTicket {
    const payload = routeTicketPayloadSchema.parse({
      version: 1,
      from: route.from,
      to: route.to,
      distanceKm: route.distanceKm,
      expiresAt,
    });
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const id = `${encodedPayload}.${this.signature(encodedPayload)}`;
    return { ...route, id, expiresAt };
  }

  find(id: string) {
    if (id.length > 2048) return null;
    const parts = id.split('.');
    if (parts.length !== 2 || !parts.every((part) => /^[\w-]+$/u.test(part))) return null;
    const [encodedPayload, encodedSignature] = parts;
    const expectedSignature = Buffer.from(this.signature(encodedPayload), 'base64url');
    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    )
      return null;

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    const parsed = routeTicketPayloadSchema.safeParse(decoded);
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) return null;
    return {
      from: parsed.data.from as Point,
      to: parsed.data.to as Point,
      distanceKm: parsed.data.distanceKm,
      expiresAt: parsed.data.expiresAt,
    };
  }

  private signature(payload: string) {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}
